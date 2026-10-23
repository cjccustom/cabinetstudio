// Renderings for selling a job before it's designed: a photo of the customer's room, a written
// prompt for an AI image editor (ChatGPT, Gemini) describing what to add, and the renderings
// that come back, kept with the job and sent with the quote.
import type { Project } from './types';
import { scopeLine } from './quote';
import { styleById } from './eagle';
import { baseLabel } from './cabinetBase';

export interface RenderImage {
  id: string;
  kind: 'photo' | 'rendering';
  /** Stored asset id, when the page can store files. */
  assetId?: string;
  /** Where to show it from: the stored asset, or (without storage) the image itself, shrunk. */
  url: string;
  name: string;
  note: string;
  at: number;
}

export interface RenderState {
  images: RenderImage[];
  /** What to add to the room, in Cody's words. */
  brief: string;
  /** Pull door style, finish and mouldings from the design, when there is one. */
  useDesign: boolean;
  prompt: string;
  revision: string;
  revisionPrompt: string;
  /** Site measurements typed in for building the room from the photos. */
  measurements: string;
  /** The rendering that goes out with the quote. */
  quoteId?: string;
  /** Which Gemini image model renders. */
  geminiModel?: string;
}

/** Gemini image models, best for selling first. */
export const geminiModels = [
  { id: 'gemini-3-pro-image', label: 'Nano Banana Pro (best quality)' },
  { id: 'gemini-3.1-flash-image', label: 'Nano Banana 2 (faster, cheaper)' },
  { id: 'gemini-2.5-flash-image', label: 'Nano Banana (original)' },
];

export const defaultRender: RenderState = { images: [], brief: '', useDesign: true, prompt: '', revision: '', revisionPrompt: '', measurements: '' };
export const renderOf = (p: Project): RenderState => ({ ...defaultRender, ...p.render });

/** What the design says about the look, for the prompt. Empty when nothing is drawn yet. */
export function designFacts(p: Project): string[] {
  if (!p.cabinets.length) return [];
  const s = p.settings;
  const style = styleById(s.doorStyleId);
  const facts = [
    `Doors: ${style.name} style (${style.profile === 'slab' ? 'flat slab' : 'shaker-type frame and panel'}), ${s.doorMount === 'inset' ? 'inset within the face frame' : 'overlay on the face frame'}.`,
    `Room: ${Math.round(p.room.width)}" × ${Math.round(p.room.depth)}", ${Math.round(p.room.height)}" ceiling.`,
  ];
  const bases = [...new Set(p.cabinets.map(baseLabel).filter(Boolean))];
  if (bases.length) facts.push(`Base: ${bases.join('; ')}.`);
  for (const c of p.cabinets) facts.push(scopeLine(c, p));
  return facts;
}

const RULES = `Edit the attached photo of the customer's room into a photorealistic rendering of new custom built-in cabinetry.
Keep the camera position, lens, perspective, lighting, time of day, walls, ceiling, windows, flooring and anything not mentioned exactly as they are in the photo.
Fit the new work to the room at true scale, using the doors, windows, outlets and furniture in the photo for reference.
Show realistic shadows, reflections and paint sheen so it reads as a real photograph, not an illustration.`;

/** A prompt built without Claude, from the brief and the design. */
export function templatePrompt(r: RenderState, p: Project): string {
  const facts = r.useDesign ? designFacts(p) : [];
  return [
    RULES,
    '',
    `Add: ${r.brief.trim() || '(describe what to add)'}`,
    ...(facts.length ? ['', 'Details from the design:', ...facts.map((f) => `- ${f}`)] : []),
  ].join('\n');
}

/** Instructions for Claude to write the image editor's prompt, looking at the photo. */
export function promptRequest(r: RenderState, p: Project): string {
  const facts = r.useDesign ? designFacts(p) : [];
  return `You write prompts for an AI image editor (ChatGPT or Gemini) for a custom cabinet shop. The shop owner will attach the photo you are looking at and paste your prompt; the editor will turn the photo into a photorealistic rendering to show the customer with a quote.

Look at the photo and write one prompt that:
- says to keep the camera angle, lens, lighting, walls, ceiling, windows, floor and everything not being changed exactly as in the photo;
- names where the new work goes using things visible in the photo (which wall, between which window and corner, what it replaces or what furniture moves out);
- describes the cabinetry concretely: layout, proportions, door and drawer style, mouldings, base, countertop or top, hardware, finish and color, at realistic scale for the room;
- asks for true-to-life shadows, reflections and sheen so it reads as a real photograph.

What the shop owner wants added:
${r.brief.trim() || '(nothing given: suggest tasteful built-ins suited to the room)'}
${facts.length ? `\nDetails from the shop's design (use them; they override guesses):\n${facts.map((f) => `- ${f}`).join('\n')}\n` : ''}
Reply with only the prompt text, 120 to 250 words, no heading or commentary.`;
}

/** Instructions for Claude to write a short revision for the image editor. */
export function revisionRequest(r: RenderState, hasImage: boolean): string {
  return `You help a custom cabinet shop revise an AI rendering (ChatGPT or Gemini image editing) of new cabinetry in a customer's photo.${hasImage ? ' The attached image is the current rendering.' : ''}

The original prompt was:
${r.prompt || '(not recorded)'}

The shop owner wants these changes:
${r.revision.trim()}

Write the follow-up message to send the image editor: say exactly what to change, by location in the image, and tell it to keep everything else in the image the same. Reply with only that message, under 90 words.`;
}

/** A few plain words for a color, so the image model doesn't have to read hex. */
export function colorWords(hex?: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '');
  if (!m) return '';
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const tone = l > 0.88 ? 'very light' : l > 0.7 ? 'light' : l > 0.45 ? 'medium' : l > 0.25 ? 'dark' : 'very dark';
  if (l > 0.84 && sat < 0.45) return `${l > 0.95 ? 'bright white' : `${h < 70 || h > 300 ? 'warm' : 'cool'} off-white`} (${hex})`;
  if (sat < 0.12) return `${tone} ${l > 0.88 ? 'white' : 'gray'}${sat > 0.04 ? (h < 70 || h > 300 ? ', warm' : ', cool') : ''} (${hex})`;
  const hue = h < 15 || h >= 345 ? 'red' : h < 40 ? 'orange-brown' : h < 65 ? 'tan / yellow' : h < 160 ? 'green' : h < 200 ? 'teal' : h < 255 ? 'blue' : h < 290 ? 'purple' : 'pink';
  return `${tone} ${sat < 0.3 ? 'muted ' : ''}${hue} (${hex})`;
}

/** The prompt for turning a screenshot of the 3D design (and maybe a photo of the room) into a photograph. */
export function designRenderPrompt(p: Project, notes: string, withPhoto: boolean): string {
  const f = p.finishes;
  const s = p.settings;
  const style = styleById(s.doorStyleId);
  const facts = designFacts(p).slice(1);
  return [
    `The ${withPhoto ? 'first ' : ''}image is a screenshot of a 3D model of custom built-in cabinetry from a cabinet shop's design software. Turn it into a photorealistic interior photograph of the finished work.`,
    'Keep exactly: the camera angle and framing, the layout, the number and position of every cabinet, door, drawer, shelf and opening, their proportions and sizes. Do not add or remove cabinets, doors or drawers.',
    'Replace the flat model look with real materials, soft natural light, true shadows and reflections. Ignore the thin outline lines of the model; they are not part of the design.',
    `Cabinets: painted ${colorWords(f.paint)}, ${style.name} style ${style.profile === 'slab' ? 'flat slab doors' : 'frame-and-panel (shaker type) doors'}, ${s.doorMount === 'inset' ? 'inset within the face frame' : 'overlay on the face frame'}, face-frame construction.`,
    `Countertops shown in dark: stone, ${colorWords(f.counter)}. Solid wood tops or shelves shown in wood tones: real wood, ${colorWords(f.wood)}. Open cabinet interiors: ${colorWords(f.box)} prefinished wood.`,
    `Walls ${colorWords(f.wall ?? '#ece8e0')}, room trim ${colorWords(f.trim ?? '#f4f1ea')}.`,
    ...(withPhoto ? ['The second image is a photo of the customer’s actual room: match its flooring, wall color, windows, lighting and character, so it looks like the cabinetry was built in that room. Keep the camera angle of the first image.'] : []),
    ...(facts.length ? ['Details from the design:', ...facts.map((x) => `- ${x}`)] : []),
    ...(notes.trim() ? [`Also: ${notes.trim()}`] : []),
  ].join('\n');
}
