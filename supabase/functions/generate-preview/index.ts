// Kaj System — AI preview generator.
// Takes a project spec / chat transcript, asks Claude to design a self-contained
// HTML preview of the customer's app, stores it, and returns it.
//
// Secrets (set in Supabase → Project → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY   — required for real AI previews (falls back to a
//                         placeholder preview when absent so the flow still works).
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Deployed with verify_jwt = false on purpose: this is a public intake endpoint
// for anonymous visitors. The table is RLS-locked; this function is the only
// writer (service role) and enforces its own per-session rate limit.

import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5";
const RATE_LIMIT = 15;          // generations per session per hour
const RATE_WINDOW_MIN = 60;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

const clamp = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");

function specToBrief(spec: Record<string, unknown>, messages: Array<{ role: string; content: string }>) {
  const parts: string[] = [];
  if (spec.buildType) parts.push(`Type of product: ${clamp(spec.buildType, 80)}`);
  if (spec.projectName) parts.push(`Project / company name: ${clamp(spec.projectName, 120)}`);
  if (spec.problem) parts.push(`Problem & who it's for: ${clamp(spec.problem, 2000)}`);
  if (spec.audience) parts.push(`Audience: ${clamp(spec.audience, 500)}`);
  if (Array.isArray(spec.features) && spec.features.length) parts.push(`Key features: ${spec.features.map((f) => clamp(f, 40)).join(", ")}`);
  if (spec.brand) parts.push(`Brand / style notes: ${clamp(spec.brand, 500)}`);
  if (spec.platform) parts.push(`Platform: ${clamp(spec.platform, 60)}`);
  if (Array.isArray(messages) && messages.length) {
    const convo = messages.slice(-16).map((m) => `${m.role === "user" ? "Customer" : "Assistant"}: ${clamp(m.content, 1200)}`).join("\n");
    parts.push(`Conversation so far:\n${convo}`);
  }
  return parts.join("\n");
}

const SYSTEM = `You are the lead product designer at Kaj System, an app studio. \
A prospective customer has described the app they want. Design a single, \
self-contained HTML PREVIEW (a high-fidelity clickable mockup) of that app's main experience.

Hard rules:
- Output ONE complete HTML document, starting with <!doctype html>.
- Everything inline: one <style> block, small vanilla <script> only if it adds life (tabs, a toggle). NO external resources at all — no external CSS, fonts, images, or scripts. Use system fonts and CSS gradients/SVG for any imagery.
- Mobile-first. Show a realistic primary screen; where it helps, show 2–3 screens or key states stacked, or a bottom tab bar. Use realistic sample content relevant to the customer's domain (not lorem ipsum).
- Modern, polished, accessible. A refined dark UI with a violet/indigo accent unless the customer asked for a specific look. Rounded cards, clear hierarchy, real buttons.
- Keep it under ~900 lines. It is a preview/mockup, not a real backend — buttons can be inert or do light in-page interactions.
- Do NOT include markdown code fences or any XML/framework tags. Plain HTML only.

Respond in EXACTLY this format and nothing else:
<<<MESSAGE>>>
(1–2 warm sentences to the customer describing what you designed and inviting a tweak)
<<<HTML>>>
<!doctype html> ... full document ...`;

function placeholderPreview(title: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  body{margin:0;font-family:system-ui,sans-serif;background:#0b0b12;color:#f4f6ff;display:grid;place-items:center;min-height:100vh;text-align:center;padding:2rem}
  .c{max-width:420px}.b{width:64px;height:64px;border-radius:18px;margin:0 auto 1.2rem;background:linear-gradient(135deg,#a855f7,#7c3aed)}
  h1{font-size:1.4rem;margin:.4rem 0}p{color:#9aa0b8;line-height:1.6}</style></head>
  <body><div class="c"><div class="b"></div><h1>Preview engine not configured yet</h1>
  <p>Add an <b>ANTHROPIC_API_KEY</b> secret to the Supabase project to turn on live AI previews for “${title || "your app"}”.</p></div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const sessionId = clamp(payload.sessionId, 64);
  if (!sessionId) return json({ error: "Missing sessionId" }, 400);
  const spec = (payload.spec && typeof payload.spec === "object") ? payload.spec : {};
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const projectId = clamp(payload.projectId, 64) || null;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  // Lightweight "send to Kaj System" — record contact + mark contacted, no AI call.
  if (payload.action === "submit") {
    if (!projectId) return json({ error: "no_project" }, 400);
    const c = payload.contact || {};
    await db.from("projects").update({
      contact_name: clamp(c.name, 120) || null,
      contact_email: clamp(c.email, 200) || null,
      contact_phone: clamp(c.phone, 60) || null,
      status: "contacted",
    }).eq("id", projectId).eq("session_id", sessionId);
    return json({ ok: true });
  }

  // Rate limit per session.
  const since = new Date(Date.now() - RATE_WINDOW_MIN * 60_000).toISOString();
  const { count } = await db.from("generation_log").select("*", { count: "exact", head: true })
    .eq("session_id", sessionId).gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT) return json({ error: "rate_limited", message: "You've reached the preview limit for now — please try again later or talk to us directly." }, 429);

  const brief = specToBrief(spec, messages);
  if (brief.trim().length < 8) return json({ error: "Tell me a bit more about the app first." }, 400);

  const title = clamp(spec.projectName, 120) || clamp(spec.buildType, 80) || "Untitled project";

  let previewHtml = "";
  let assistantMessage = "";

  if (!ANTHROPIC_API_KEY) {
    previewHtml = placeholderPreview(title);
    assistantMessage = "Here's a placeholder preview. Once the AI engine is connected, I'll design a real, tailored preview of your app here.";
  } else {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 20000,
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        system: SYSTEM,
        messages: [{ role: "user", content: `Design the app preview from this brief:\n\n${brief}` }],
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      console.error("Anthropic error", aiRes.status, detail);
      return json({ error: "ai_error", message: "The preview engine had a hiccup. Please try again in a moment." }, 502);
    }
    const data = await aiRes.json();
    if (data.stop_reason === "refusal") {
      return json({ error: "refused", message: "I couldn't design that one — try rephrasing the idea." }, 200);
    }
    const raw = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    // Split on our delimiters; tolerate the model omitting the MESSAGE part.
    const htmlIdx = raw.indexOf("<<<HTML>>>");
    if (htmlIdx >= 0) {
      assistantMessage = raw.slice(0, htmlIdx).replace("<<<MESSAGE>>>", "").trim();
      previewHtml = raw.slice(htmlIdx + "<<<HTML>>>".length).trim();
    } else {
      previewHtml = raw.trim();
    }
    // Strip any stray markdown fences.
    previewHtml = previewHtml.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
    const docIdx = previewHtml.toLowerCase().indexOf("<!doctype");
    if (docIdx > 0) previewHtml = previewHtml.slice(docIdx);
    if (!assistantMessage) assistantMessage = "Here's a first preview of your app — tell me what to change and I'll redesign it.";
  }

  // Persist (service role; table is RLS-locked to clients).
  const row: Record<string, unknown> = {
    session_id: sessionId, build_type: clamp(spec.buildType, 80) || null, title,
    spec, messages, preview_html: previewHtml, status: "previewed", ip,
    contact_name: clamp(spec.contactName, 120) || null,
    contact_email: clamp(spec.contactEmail, 200) || null,
    contact_phone: clamp(spec.contactPhone, 60) || null,
  };
  let savedId = projectId;
  try {
    if (projectId) {
      const { data: upd } = await db.from("projects").update({ ...row, preview_count: (payload.previewCount ?? 0) + 1 }).eq("id", projectId).eq("session_id", sessionId).select("id").maybeSingle();
      savedId = upd?.id ?? projectId;
    } else {
      const { data: ins } = await db.from("projects").insert({ ...row, preview_count: 1 }).select("id").single();
      savedId = ins?.id ?? null;
    }
    await db.from("generation_log").insert({ session_id: sessionId, ip });
  } catch (e) {
    console.error("persist error", e);
  }

  return json({ projectId: savedId, previewHtml, assistantMessage });
});
