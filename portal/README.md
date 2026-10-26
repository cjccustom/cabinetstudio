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

## QuickBooks Online (deposit and final invoices)

The portal makes the invoices in your QuickBooks company: when a client signs, it adds them as
a customer (or finds them), makes the deposit invoice with card and bank (ACH) payment turned on,
and has QuickBooks email it. Their project page gets a **Pay by card or bank transfer** button
that opens QuickBooks' own payment page. Checks and cash you record from Cabinet Studio, and
they're applied to the invoice in QuickBooks. Card and ACH payments need QuickBooks Payments
turned on for your company (its usual fees apply).

Intuit makes you create an "app" to get keys, even for your own use. It's free. Test on Intuit's
sample company first, then switch to your real one.

1. **Make the app.** Go to developer.intuit.com and sign in with your QuickBooks login. Open the
   Dashboard and create an app for **QuickBooks Online and Payments**. Name it something like
   CJC Portal, and when it asks for scopes, choose **Accounting**.
2. **Test keys.** Under the app's development (sandbox) keys and credentials, copy the
   **Client ID** and **Client Secret**. In the same place, add a **Redirect URI**:
   `https://cjc-portal.<you>.workers.dev/qb/callback`, the exact Worker address.
3. **Give the portal the keys.** In Cloudflare, Worker → Settings → Variables and Secrets:
   add Secret `QB_CLIENT_ID`, Secret `QB_CLIENT_SECRET`, and a plain variable `QB_ENV` with
   value `sandbox`. Deploy.
4. **Connect.** Open `https://cjc-portal.<you>.workers.dev/qb`, paste your SHOP_KEY and click
   Connect. Sign in to Intuit and pick the sandbox company it made for you.
5. In Cabinet Studio, Portal settings → QuickBooks: pick the product/service for invoice
   lines. Then sign a test proposal and check the invoice appears in the sandbox company.
6. **Your real company.** In the Intuit app, fill in what it asks for production keys. These
   pages are on the portal for it:
   - Host domain: `cjc-portal.<you>.workers.dev`
   - Launch URL: `https://cjc-portal.<you>.workers.dev/qb`
   - Disconnect URL: `https://cjc-portal.<you>.workers.dev/qb`
   - End-user agreement: `https://cjc-portal.<you>.workers.dev/legal/eula`
   - Privacy policy: `https://cjc-portal.<you>.workers.dev/legal/privacy`

   Add the same Redirect URI under the production settings. Answer its questionnaire (it's
   your own app, used only by your company). Then put the **production** Client ID and Secret
   in the two Secrets, delete `QB_ENV`, deploy, and connect again at `/qb`, choosing CJC
   Custom Carpentry.

The QuickBooks connection lasts about 100 days at a time and renews itself whenever the portal
uses it. If it ever lapses, Portal settings says so; reconnect at `/qb`.

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
