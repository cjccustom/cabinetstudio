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
  /** The rendering that goes out with the quote. */
  quoteId?: string;
}

export const defaultRender: RenderState = { images: [], brief: '', useDesign: true, prompt: '', revision: '', revisionPrompt: '' };
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
