// How a door opening is hung: the Reeb design, hinge side, leaves and whether it's prehung.
// Interior doors are for the design only; they aren't priced or ordered through the app.
import type { Opening } from './types';

export const doorOf = (o: Opening) => ({ hinge: 'left' as const, leaves: 1 as const, prehung: true, ...o.door });
