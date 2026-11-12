// A job with more than one room: a master closet and two small closets, a kitchen and a pantry. The
// room being worked on lives in the project's own fields, so everything that draws, edits and checks
// one room works as it always has; the others wait in `rooms` and swap in when their tab is picked.
// What's priced, proposed, drawn for the client and ordered covers every room (jobRooms).
import type { Project } from './types';
import { uid } from './defaults';

/** The fields that belong to a room rather than the job. Everything else (client, prices, quote, proposal) is the job's. */
export const ROOM_KEYS = ['room', 'cabinets', 'panels', 'openings', 'roomTrim', 'wallFinishes', 'lights', 'floor', 'ceiling', 'ladder', 'tvs', 'details', 'drawings', 'cabLighting'] as const;
export type RoomKey = (typeof ROOM_KEYS)[number];
export type RoomTab = { id: string; name: string } & Partial<Pick<Project, RoomKey>>;

/** The room on screen: its id and name (a one-room job gets a stable id the first time it's asked). */
export const activeRoomId = (p: Project) => p.roomId ?? 'room-1';
export const activeRoomName = (p: Project) => p.roomName?.trim() || (p.rooms?.length ? 'Room 1' : 'Room');

/** Every room's tab, in order, the one on screen marked. */
export function roomTabs(p: Project): { id: string; name: string; active: boolean }[] {
  const others = p.rooms ?? [];
  const at = Math.min(Math.max(0, p.roomIndex ?? 0), others.length);
  const tabs = others.map((r) => ({ id: r.id, name: r.name, active: false }));
  tabs.splice(at, 0, { id: activeRoomId(p), name: activeRoomName(p), active: true });
  return tabs;
}

/** The room on screen, packed up as a tab. */
function packActive(p: Project): RoomTab {
  const t: RoomTab = { id: activeRoomId(p), name: activeRoomName(p) };
  for (const k of ROOM_KEYS) if (p[k] !== undefined) (t as Record<string, unknown>)[k] = p[k];
  return t;
}

/** Put a tab's room on screen: the current one goes back into the list where its tab is. */
export function switchRoom(p: Project, id: string): Project {
  if (id === activeRoomId(p)) return p;
  const tabs = roomTabs(p);
  const target = (p.rooms ?? []).find((r) => r.id === id);
  if (!target) return p;
  const others = tabs.map((t) => (t.active ? packActive(p) : (p.rooms ?? []).find((r) => r.id === t.id)!)).filter((r) => r.id !== id);
  const next: Project = { ...p, roomId: target.id, roomName: target.name, rooms: others, roomIndex: tabs.findIndex((t) => t.id === id) };
  for (const k of ROOM_KEYS) (next as unknown as Record<string, unknown>)[k] = (target as Record<string, unknown>)[k];
  // A room always has walls and a cabinet list
  if (!next.cabinets) next.cabinets = [];
  return next;
}

/** A new, empty room after the others (walls like the room on screen until it's measured), and it goes on screen. */
export function addRoom(p: Project, name: string, room?: Project['room']): Project {
  const base: Project = { ...p, roomId: activeRoomId(p), roomName: activeRoomName(p), rooms: p.rooms ?? [] };
  const fresh: RoomTab = { id: uid('room'), name: name.trim() || `Room ${(p.rooms?.length ?? 0) + 2}`, room: room ?? { ...p.room, slopes: undefined }, cabinets: [], openings: [] };
  const withNew: Project = { ...base, rooms: [...(base.rooms ?? []), fresh] };
  return switchRoom(withNew, fresh.id);
}

export function renameRoom(p: Project, id: string, name: string): Project {
  const n = name.trim();
  if (!n) return p;
  if (id === activeRoomId(p)) return { ...p, roomId: activeRoomId(p), roomName: n };
  return { ...p, rooms: (p.rooms ?? []).map((r) => (r.id === id ? { ...r, name: n } : r)) };
}

/** Take a room out of the job. The one on screen is replaced by its neighbour; the last room can't go. */
export function removeRoom(p: Project, id: string): Project {
  const tabs = roomTabs(p);
  if (tabs.length < 2) return p;
  if (id !== activeRoomId(p)) {
    const rooms = (p.rooms ?? []).filter((r) => r.id !== id);
    const at = tabs.findIndex((t) => t.active), gone = tabs.findIndex((t) => t.id === id);
    return { ...p, rooms, roomIndex: gone < at ? at - 1 : at };
  }
  const i = tabs.findIndex((t) => t.id === id);
  const neighbour = tabs[i + 1] ?? tabs[i - 1];
  const moved = switchRoom(p, neighbour.id);
  return { ...moved, rooms: (moved.rooms ?? []).filter((r) => r.id !== id), roomIndex: Math.max(0, (moved.roomIndex ?? 0) - (i < (moved.roomIndex ?? 0) ? 1 : 0)) };
}

/**
 * Every room of the job as a project of its own (the job's settings, prices and client, that room's
 * walls and cabinets), in tab order. A one-room job is just itself.
 */
export function jobRooms(p: Project): { id: string; name: string; project: Project }[] {
  if (!p.rooms?.length) return [{ id: activeRoomId(p), name: activeRoomName(p), project: p }];
  return roomTabs(p).map((t) => {
    if (t.active) return { id: t.id, name: t.name, project: { ...p, rooms: undefined } };
    const r = p.rooms!.find((x) => x.id === t.id)!;
    const one: Project = { ...p, rooms: undefined, roomId: r.id, roomName: r.name };
    for (const k of ROOM_KEYS) (one as unknown as Record<string, unknown>)[k] = (r as Record<string, unknown>)[k];
    if (!one.cabinets) one.cabinets = [];
    return { id: t.id, name: t.name, project: one };
  });
}

/** Each room as its own project (the job's settings, that room's walls and cabinets): for totals over the whole job. */
export const roomProjects = (p: Project): Project[] => jobRooms(p).map((r) => r.project);

/** More than one room in the job. */
export const isMultiRoom = (p: Project) => (p.rooms?.length ?? 0) > 0;
