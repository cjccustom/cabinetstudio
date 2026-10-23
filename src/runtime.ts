// The claude.ai capabilities this page can use, when it's opened there. Each resolves null
// anywhere they aren't available (a plain browser, a viewer who can't edit), so callers hide
// the feature instead of failing.
type Use = (name: string) => Promise<unknown>;
const cache = new Map<string, Promise<unknown>>();

export function capability<T>(name: string): Promise<T | null> {
  const use = (window as unknown as { claude?: { use?: Use } }).claude?.use;
  if (!use) return Promise.resolve(null);
  if (!cache.has(name)) cache.set(name, use(name).catch(() => null));
  return cache.get(name) as Promise<T | null>;
}

export interface Sample {
  (input: string, opts?: { images?: Blob[]; onText?: (u: { text: string }) => void; signal?: AbortSignal; modelTier?: 'quick' | 'default' | 'complex'; cache?: boolean }): Promise<{ text: string; truncated: boolean }>;
  json: (input: string, opts?: { images?: Blob[]; signal?: AbortSignal; modelTier?: 'quick' | 'default' | 'complex'; cache?: boolean }) => Promise<unknown>;
  limits?: () => Promise<{ images?: { maxCount: number } }>;
}
export interface Assets {
  upload(blob: Blob): Promise<{ id: string; url: string }>;
  delete(id: string): Promise<void>;
}
export interface Downloads {
  save(req: { filename: string; data: Blob | string }): Promise<unknown>;
}

/** Shrink a photo so it stores and sends quickly, keeping it sharp enough to show a customer. */
export async function shrinkImage(file: Blob, maxEdge: number, quality = 0.88): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('encode'))), 'image/jpeg', quality));
}

export const blobToDataUrl = (b: Blob) => new Promise<string>((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(r.result as string);
  r.onerror = () => fail(r.error);
  r.readAsDataURL(b);
});

/** The page's connector calls (claude.ai's mcp capability). */
export interface Mcp {
  callTool(server: string, tool: string, input?: unknown, options?: { signal?: AbortSignal; cache?: false }): Promise<{ payload?: unknown; content: { type: string; text?: string; data?: string; mimeType?: string }[] }>;
}

export const base64ToBlob = (b64: string, type: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
};
