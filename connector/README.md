# Gemini connector

Lets Cabinet Studio send a room photo and prompt to Google Gemini and get the rendering back,
through a custom connector on claude.ai. Runs free on Cloudflare Workers.

## Set up

1. Cloudflare → Workers & Pages → Create → Create Worker (Hello World). Name it
   `cabinet-studio-gemini`, Deploy.
2. Edit code → replace everything in `worker.js` with `gemini-worker.js` from this folder → Deploy.
3. Settings → Variables and Secrets → Add, type **Secret**:
   - `GEMINI_API_KEY`: the key from aistudio.google.com
   - `CONNECTOR_SECRET`: a long random code (30+ letters and numbers, from a password generator)
4. Open `https://cabinet-studio-gemini.<your-subdomain>.workers.dev/<CONNECTOR_SECRET>` in a browser.
   It should say the connector is running and the key is set.
5. claude.ai → https://claude.ai/customize/connectors → Add custom connector. Name it
   `Gemini Images`, paste the address from step 4. No sign-in.

Keep the address private: anyone with it can make images on your Gemini bill.
To choose a different model, add a plain variable `GEMINI_MODEL` (the `list_models` tool shows the
image models your key can use).
