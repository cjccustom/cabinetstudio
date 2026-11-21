/// <reference types="vite/client" />
// The door style photos built into the app (as data), so the door style sheet shows its photo wherever
// the drawings are opened: in the app on a phone, on the client's page, downloaded. Without the build
// step (the checks) there are none, and the sheet falls back to the file published next to the page.
let photos: Record<string, string> = {};
try {
  photos = import.meta.glob('/vendor/doors/*.webp', { eager: true, query: '?inline', import: 'default' }) as Record<string, string>;
} catch { /* not built by Vite */ }

/** A door style photo by file name ("hartford-raised"), as data, or null. */
export const doorPhotoData = (name: string): string | null => photos[`/vendor/doors/${name}.webp`] ?? null;
