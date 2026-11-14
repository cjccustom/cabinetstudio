// The saved 3D views and renderings, put inside the customer set when it leaves the app, so the
// "3D renderings" sheet shows them wherever the file is opened.
import type { Project } from '../model/types';
import { useStore } from '../store';
import { revSnapshot } from '../model/revisions';
import { renderOf } from '../model/rendering';
import { blobToDataUrl, shrinkImage } from '../runtime';

export async function withPictures(p: Project): Promise<Project> {
  const imgs = renderOf(p).images.filter((x) => x.kind === 'rendering').slice(-4);
  if (!imgs.length) return p;
  const views: string[] = [];
  for (const x of imgs) {
    try { views.push(x.url.startsWith('data:') && x.url.length < 700_000 ? x.url : await blobToDataUrl(await shrinkImage(await (await fetch(x.url)).blob(), 1200, 0.82))); } catch { /* left out */ }
  }
  return views.length ? { ...p, drawings: { ...p.drawings, views } } as Project : p;
}

/**
 * The set is going out: if no copy of the design has been kept since the last revision, keep this one,
 * so the next revision can list what changed from what the customer or shop has in hand.
 */
export function markIssued() {
  const st = useStore.getState();
  if (st.project.drawings?.revBase) return;
  st.commit((p) => ({ ...p, drawings: { ...p.drawings, revBase: revSnapshot(p) } }));
}
