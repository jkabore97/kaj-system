# Kaj System — website

Marketing site for **Kaj System**, an app & software studio. A single static
site: no build step, no framework, no runtime dependencies. The site lives in
[`public/`](./public); open `public/index.html` in a browser or deploy the
`public/` folder as-is.

## Repository layout

```
public/            ← the site (this is what gets deployed)
  index.html, styles.css, app.js
  config.js        ← contact details, prices, estimator numbers, testimonials
  i18n.js          ← all visible text, English (en) + French (fr)
  privacy.html, 404.html, thanks.html
  favicon.svg, icon-*.png, apple-touch-icon.png, og-image.png
  manifest.webmanifest, robots.txt, sitemap.xml, _headers, .assetsignore
wrangler.jsonc     ← Cloudflare Workers config (serves ./public)
package.json       ← dev + deploy scripts (no runtime dependencies)
og-image.html      ← template used to render the social image
scripts/render-images.mjs  ← regenerates the icons and social card (dev tool)
```

## What is on the page

Hero with an animated phone mock-up, six services, the ELIM case study plus
six ready-to-adapt solution cards, a six-step process timeline, a "why us"
block, four fixed-price packages and a monthly care plan, an **interactive
project estimator** that feeds the contact form, testimonials (hidden until
`config.js` has real quotes), an FAQ, and a contact form. Extras: English +
French (auto-detected, switchable), light/dark theme, SEO/Open Graph/JSON-LD,
sitemap, PWA manifest, security headers, and a 404 / thank-you / privacy page.

## Run it locally

```bash
npm run dev      # serves ./public at http://localhost:5173
```

(Or just open `public/index.html` — there is no build step.)

## Edit the content

* **`public/config.js`** — everything a non-developer changes: email, WhatsApp
  number, booking link, contact-form endpoint, social links, prices, estimator
  numbers, testimonials.
* **`public/i18n.js`** — all visible text, in English (`en`) and French (`fr`).
  Every key must exist in both blocks.
* **`public/index.html`** — structure. Add or remove sections here.
* **`public/styles.css`** — colours live in the `:root` block at the top.

### Make the contact form deliver to your inbox

1. Create a free form at <https://formspree.io> (or any service that accepts a
   JSON POST) and copy the endpoint URL.
2. Paste it into `public/config.js` → `contact.formEndpoint`.

Until an endpoint is set, submitting the form opens the visitor's email client
with the message pre-filled, addressed to `contact.email`.

### Turn on WhatsApp and booking buttons

Fill `contact.whatsapp` (international number, digits only, e.g.
`22670000000`) and/or `contact.bookingUrl` in `public/config.js`. The buttons
and the floating WhatsApp bubble appear automatically.

## Deploy to Cloudflare Workers

This repo is set up for Cloudflare's Git-connected **Workers Builds** with a
static-assets deployment. `wrangler.jsonc` already points the assets directory
at `./public`, so:

* **Deploy command:** `npx wrangler deploy` (the Cloudflare default)
* **Build command:** *(leave empty)*
* No build output directory needs to be set in the dashboard — `wrangler.jsonc`
  is the source of truth.

Because the site is served from `./public`, build-time folders such as
`node_modules/` stay out of the upload. (A previous setup deployed the repo
root and failed with *"Asset too large"* because `node_modules/workerd` is
147 MiB — serving `./public` avoids that entirely.)

Add your domain under the Worker's **Domains & Routes** (or **Custom domains**).

### Any other static host

Netlify, Vercel, GitHub Pages, Firebase Hosting: publish the **`public/`**
folder (set the publish / output directory to `public`).

After choosing the final domain, update the URL in `public/config.js`, the
`<link rel="canonical">` / Open Graph tags in `public/index.html`,
`public/sitemap.xml` and `public/robots.txt`.

## Regenerate the icons and social image

The PNG icons and `public/og-image.png` are rendered from `og-image.html` and
`public/favicon.svg` with headless Chromium (a one-time dev tool — the outputs
are committed):

```bash
npm install --save-dev playwright
npx playwright install chromium
npm run render-images
```
