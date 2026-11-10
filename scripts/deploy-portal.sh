#!/usr/bin/env bash
# Upload the client portal to its Cloudflare worker (cjc-portal): build it, then replace the
# worker's code, keeping its storage, secrets and settings. The Cloudflare token comes from the
# environment's network settings, never from this repository.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run --silent build:portal
api=https://api.cloudflare.com/client/v4
acct="${CF_ACCOUNT_ID:-$(curl -sS "$api/accounts" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);if(!r.success||!r.result?.length){console.error("Cloudflare: no account found",JSON.stringify(r.errors));process.exit(1)}console.log(r.result[0].id)})')}"
curl -sS -X PUT "$api/accounts/$acct/workers/scripts/cjc-portal" \
  -F "metadata=@portal/deploy-meta.json;type=application/json" \
  -F "portal-worker.js=@portal/portal-worker.js;type=application/javascript+module" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s);if(!r.success){console.error("Upload failed:",JSON.stringify(r.errors));process.exit(1)}console.log("Portal uploaded to Cloudflare")})'
