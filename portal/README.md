# CJC client portal

The customer-facing side of Cabinet Studio: each client gets a private link (no login) showing
their renderings, the proposal with scope and purchase agreement, your terms, licenses,
insurance and an about blurb. They sign on their phone; the page then gives them the signed
agreement and the 3-day Notice of Cancellation, with a cancel button that works until the
deadline (MA G.L. c.93 §48, FTC 16 CFR 429).

It runs as one Cloudflare Worker with one KV namespace. Cloudflare's free plan covers it.
Cabinet Studio talks to it through a claude.ai connector named **CJC Portal**.

## Set it up (once, about 15 minutes)

1. **Cloudflare account.** Sign up at dash.cloudflare.com (free plan).
2. **Storage.** Storage & Databases → KV → Create a namespace named `cjc-portal`.
3. **Worker.** Compute (Workers) → Create → Start with Hello World → name it `cjc-portal` →
   Deploy. Then Edit code, delete what's there, paste all of `portal-worker.js`, and Deploy.
4. **Connect the storage.** In the Worker: Settings → Bindings → Add → KV namespace.
   Variable name `PORTAL`, namespace `cjc-portal`.
5. **The shop key.** Open the Worker's address (`https://cjc-portal.<you>.workers.dev/setup`).
   It suggests a random key. Copy it, then in the Worker: Settings → Variables and Secrets →
   Add → type **Secret**, name `SHOP_KEY`, paste the key. Save it in your password manager;
   never paste it into a chat.
6. **The connector address.** Back on the `/setup` page, enter the key. It shows the
   connector address (the Worker's address plus a long code). That address is itself a
   password: anyone with it can publish to your portal.
7. **Add the connector.** claude.ai → Settings → Connectors → Add custom connector. Name it
   exactly `CJC Portal` and paste the connector address.
8. In Cabinet Studio, open a client and use **Client portal**. The first time, claude.ai asks
   whether the page may use CJC Portal: choose Allow.

Optional: Settings → Domains & Routes lets you use something like `portal.cjccustomcarpentry.com`
instead of the workers.dev address (DNS stays at Squarespace; add the CNAME it gives you).

## Updating

When Cabinet Studio ships a new `portal-worker.js`, paste it over the old code (step 3) and
Deploy. Stored jobs, documents and signatures are kept.

## What is stored

Everything lives in the `cjc-portal` KV namespace: the shop profile and documents, each job
(published proposal, renderings, page views, signature with time, IP, browser and a SHA-256
fingerprint of exactly what was signed, cancellation). A replaced or cancelled signature moves
to the job's history and is never deleted.

## Building

`portal-worker.js` is built from `src/`:

```
node_modules/.bin/esbuild portal/src/worker.ts --bundle --format=esm --platform=neutral --target=es2022 --outfile=portal/portal-worker.js
```
