# Gemini connector

Lets Cabinet Studio send a room photo and prompt to Google Gemini and get the rendering back,
through a custom connector on claude.ai. Runs free on Cloudflare Workers.

## Set up

1. Cloudflare → the `cabinet-studio-gemini` worker → Edit code → replace everything with
   `gemini-worker.js` from this folder → Deploy.
2. Settings → Variables and Secrets: a **Secret** named `GEMINI_API_KEY` holding your key from
   aistudio.google.com. (`CONNECTOR_SECRET` is no longer needed.)
3. Open the worker's plain address (`https://cabinet-studio-gemini.<you>.workers.dev`). Paste the
   same Gemini key into the box; the page gives back the private connector address.
4. claude.ai → Settings → Connectors → Add custom connector, name it `Gemini Images`, paste that
   address. No sign-in.

Keep the connector address private: anyone with it can make images on your Gemini bill.
To choose a different model, add a plain variable `GEMINI_MODEL`.
