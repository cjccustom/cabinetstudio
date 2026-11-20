// The options a client can try on their 3D page: door and drawer-front styles, paint colors and hardware
// finishes, offered by the shop. They ride in the 3D model (glTF extras) with what's drawn now; the page
// swaps them live and sends the client's picks back as a note, for the shop to approve and apply.
import type { Project } from './types';
import { doorStyles, styleById } from './eagle';
import { colorByCode } from './paintColors';
import { pullFinishes } from './pulls';
import { finishLook } from './surfaces';
import { finishColors } from './woodColors';

export interface ChoicesExtras {
  /** What the model shows now. */
  now: { door: string; paint?: { code?: string; name: string; hex: string }; hardware?: string };
  doors: { id: string; name: string; detail?: string }[];
  paints: { code: string; name: string; hex: string }[];
  hardware: { v: string; label: string; color: string; metalness: number; roughness: number }[];
}

/** A client's picks, as the page sends them back. */
export interface ClientPicks { door?: { id: string; name: string }; paint?: { code: string; name: string; hex: string }; hardware?: { v: string; label: string } }

export const hasChoices = (p: Project) => { const c = p.clientChoices; return !!c && ((c.doors?.length ?? 0) + (c.paints?.length ?? 0) + (c.hardware?.length ?? 0)) > 0; };

/** Customer-facing: the style's name alone (no supplier). */
const styleName = (id: string) => styleById(id).name;

export function choicesExtras(p: Project): ChoicesExtras | null {
  if (!hasChoices(p)) return null;
  const c = p.clientChoices!;
  const s = p.settings;
  const stain = s.finish === 'stain';
  const named = p.finishes.named?.paint;
  const paintHex = finishColors(s, p.finishes).paint;
  const nowDoor = s.doorStyleId;
  // The one drawn now is always among the choices, first
  const doors = [...new Set([nowDoor, ...(c.doors ?? [])])].filter((id) => doorStyles.some((d) => d.id === id)).map((id) => ({ id, name: styleName(id), detail: styleById(id).detail }));
  const paints = stain ? [] : [...new Set([...(named ? [named.code] : []), ...(c.paints ?? [])])].map(colorByCode).filter((x): x is NonNullable<typeof x> => !!x).map((x) => ({ code: x.code, name: x.name, hex: x.hex }));
  const nowHw = s.pullFinish ?? 'nickel';
  const hardware = (c.hardware?.length ? [...new Set([nowHw, ...c.hardware])] : []).map((v) => { const f = pullFinishes.find((x) => x.v === v); return f ? { v, label: f.label, ...finishLook(v) } : null; }).filter((x): x is NonNullable<typeof x> => !!x);
  return {
    now: { door: nowDoor, ...(stain ? {} : { paint: { code: named?.code, name: named ? `${named.name} (${named.code})` : 'As drawn', hex: paintHex } }), hardware: hardware.length ? nowHw : undefined },
    doors: doors.length > 1 ? doors : [],
    paints: paints.length > 1 || (paints.length === 1 && !named) ? paints : [],
    hardware: hardware.length > 1 ? hardware : [],
  };
}

/** The picks put into the design: the door style, the paint color (by number) and the hardware finish. */
export function applyPicks(p: Project, k: ClientPicks): Project {
  let out = p;
  if (k.door && doorStyles.some((d) => d.id === k.door!.id)) out = { ...out, settings: { ...out.settings, doorStyleId: k.door.id } };
  if (k.paint) {
    const c = colorByCode(k.paint.code);
    if (c) out = { ...out, finishes: { ...out.finishes, paint: c.hex, named: { ...out.finishes.named, paint: { brand: c.brand, code: c.code, name: c.name } } } };
  }
  if (k.hardware && pullFinishes.some((f) => f.v === k.hardware!.v)) out = { ...out, settings: { ...out.settings, pullFinish: k.hardware.v as typeof out.settings.pullFinish } };
  return out;
}

export const picksText = (k: ClientPicks) => [k.door && `Door style: ${k.door.name}`, k.paint && `Paint: ${k.paint.name}`, k.hardware && `Hardware: ${k.hardware.label}`].filter(Boolean).join(' · ');
