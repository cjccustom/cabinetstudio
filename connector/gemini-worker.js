// Cabinet Studio → Gemini image connector.
//
// A tiny MCP server, run as a Cloudflare Worker, that lets Cabinet Studio (on claude.ai) send a
// room photo and a prompt to Google's Gemini image model and get the rendering back.
//
// One secret is set in Cloudflare (Settings → Variables and Secrets), never in this file:
//   GEMINI_API_KEY    your key from aistudio.google.com
// The connector answers only at a private address worked out from that key; open the worker's
// front page and paste the key to get it.
// Optional plain variable:
//   GEMINI_MODEL      which image model to use (default below); the list_models tool shows choices

const DEFAULT_MODEL = 'gemini-2.5-flash-image';
const API = 'https://generativelanguage.googleapis.com/v1beta';

const TOOLS = [
  {
    name: 'render_image',
    description: 'Edit a room photo into a rendering with Gemini. Send the prompt and one or more images (the room photo first; optionally an earlier rendering to revise). Returns the new image.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'What to change in the photo.' },
        images: {
          type: 'array',
          description: 'Images as base64 (no data: prefix), room photo first.',
          items: {
            type: 'object',
            properties: { data: { type: 'string' }, mimeType: { type: 'string' } },
            required: ['data'],
          },
        },
        model: { type: 'string', description: 'Optional Gemini model id; defaults to the connector setting.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'list_models',
    description: 'List the Gemini models this key can use that make images, and which one the connector uses by default.',
    inputSchema: { type: 'object', properties: {} },
  },
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = String(env.GEMINI_API_KEY || '').trim();
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // The front page: shows whether it's set up, and hands out the private connector address
    // to whoever can paste the same Gemini key that's stored in Cloudflare.
    if (path === '/' || path === '/setup') {
      if (!key) return page('Almost there', '<p>The connector is running, but the Gemini key isn’t saved yet. In Cloudflare open this worker’s <b>Settings → Variables and Secrets</b>, add a <b>Secret</b> named <code>GEMINI_API_KEY</code> with your key, then reload this page.</p>');
      if (request.method === 'POST') {
        const form = await request.formData();
        const pasted = String(form.get('key') || '').trim();
        if (pasted && (await connectorCode(pasted)) === (await connectorCode(key))) {
          const address = `${url.origin}/${await connectorCode(key)}`;
          return page('Your connector address', `<p>Copy this whole address. In claude.ai go to <b>Settings → Connectors → Add custom connector</b>, name it <b>Gemini Images</b> and paste it in.</p><input readonly value="${address}" onclick="this.select()"><p><button onclick="navigator.clipboard.writeText('${address}');this.textContent='Copied'">Copy</button></p><p class="note">Keep it private: anyone with it can make images on your Gemini bill.</p>`);
        }
        return page('That key doesn’t match', '<p>Paste the same Gemini key you saved in Cloudflare.</p>' + keyForm());
      }
      return page('Cabinet Studio connector is running', '<p>Gemini key saved in Cloudflare: <b>yes</b>. Paste the same key below to get your private connector address.</p>' + keyForm());
    }

    // The connector itself answers only at its private address
    const code = key ? await connectorCode(key) : '';
    const legacy = String(env.CONNECTOR_SECRET || '').trim();
    let p = path;
    try { p = decodeURIComponent(p); } catch { /* leave it */ }
    if (!code || (p !== `/${code}` && !(legacy && p === `/${legacy}`))) return new Response('Not found', { status: 404 });
    if (request.method === 'GET') {
      return new Response(`Cabinet Studio Gemini connector is running.\nModel: ${env.GEMINI_MODEL || DEFAULT_MODEL}\n`, { headers: { 'content-type': 'text/plain' } });
    }
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    let msg;
    try { msg = await request.json(); } catch { return rpcError(null, -32700, 'Parse error'); }
    // Batches are allowed by the protocol; answer each message
    if (Array.isArray(msg)) {
      const out = (await Promise.all(msg.map((m) => handle(m, env)))).filter(Boolean);
      return out.length ? json(out) : new Response(null, { status: 202 });
    }
    const res = await handle(msg, env);
    return res ? json(res) : new Response(null, { status: 202 });
  },
};

/** The private part of the connector's address, worked out from the Gemini key so there's nothing else to set. */
async function connectorCode(key) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cabinet-studio-connector:${key}`));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

const keyForm = () => '<form method="post" action="/setup"><input name="key" type="password" placeholder="Gemini API key" autocomplete="off" required><button>Get my connector address</button></form>';

function page(title, body) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font:16px/1.5 -apple-system,system-ui,sans-serif;max-width:560px;margin:10vh auto;padding:0 16px;color:#1d2127;background:#fbfbfc}
input{width:100%;box-sizing:border-box;padding:10px;font:inherit;border:1px solid #c9ced6;border-radius:6px;margin:6px 0}
button{padding:9px 16px;font:inherit;border:0;border-radius:6px;background:#2f62d6;color:#fff;cursor:pointer}.note{color:#646d78;font-size:14px}code{background:#eef0f2;padding:1px 4px;border-radius:4px}</style>
</head><body><h1>${title}</h1>${body}</body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

async function handle(msg, env) {
  const { id, method, params } = msg || {};
  // Notifications (no id) get no reply
  if (id === undefined || id === null) return null;
  try {
    switch (method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: params?.protocolVersion || '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'cabinet-studio-gemini', version: '1.0.0' },
        });
      case 'ping':
        return ok(id, {});
      case 'tools/list':
        return ok(id, { tools: TOOLS });
      case 'tools/call':
        return ok(id, await callTool(params?.name, params?.arguments || {}, env));
      default:
        return err(id, -32601, `Unknown method ${method}`);
    }
  } catch (e) {
    return ok(id, { isError: true, content: [{ type: 'text', text: String(e?.message || e) }] });
  }
}

async function callTool(name, args, env) {
  if (!env.GEMINI_API_KEY) throw new Error('The GEMINI_API_KEY secret is not set in Cloudflare.');
  const headers = { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY };

  if (name === 'list_models') {
    const r = await fetch(`${API}/models?pageSize=1000`, { headers });
    if (!r.ok) throw new Error(`Gemini said ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const { models = [] } = await r.json();
    const image = models.filter((m) => /image/i.test(m.name) && (m.supportedGenerationMethods || []).includes('generateContent'));
    const text = [`Default: ${env.GEMINI_MODEL || DEFAULT_MODEL}`, 'Image models for this key:', ...image.map((m) => `- ${m.name.replace('models/', '')}: ${m.displayName || ''}`)].join('\n');
    return { content: [{ type: 'text', text }] };
  }

  if (name === 'render_image') {
    const prompt = String(args.prompt || '').trim();
    if (!prompt) throw new Error('A prompt is needed.');
    const images = Array.isArray(args.images) ? args.images.slice(0, 4) : [];
    const model = String(args.model || env.GEMINI_MODEL || DEFAULT_MODEL);
    const parts = [
      ...images.map((im) => ({ inlineData: { mimeType: im.mimeType || 'image/jpeg', data: String(im.data).replace(/^data:[^,]+,/, '') } })),
      { text: prompt },
    ];
    const r = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
    });
    if (!r.ok) throw new Error(`Gemini said ${r.status}: ${(await r.text()).slice(0, 400)}`);
    const data = await r.json();
    const out = data.candidates?.[0]?.content?.parts || [];
    const img = out.find((p) => p.inlineData?.data);
    const note = out.filter((p) => p.text).map((p) => p.text).join('\n').trim();
    if (!img) {
      const why = data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || 'no image returned';
      throw new Error(`Gemini didn’t return an image (${why}). ${note}`.trim());
    }
    return {
      content: [
        { type: 'image', data: img.inlineData.data, mimeType: img.inlineData.mimeType || 'image/png' },
        ...(note ? [{ type: 'text', text: note }] : []),
      ],
    };
  }

  throw new Error(`Unknown tool ${name}`);
}

const json = (body) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const err = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const rpcError = (id, code, message) => json(err(id, code, message));
