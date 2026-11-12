// The rooms of a job, as tabs beside its name: the master closet, the shoe closet, the linen closet.
// Picking one puts its walls and cabinets on screen; the quote, proposal and the client's drawings
// cover them all.
import { useStore } from '../store';
import { addRoom, removeRoom, renameRoom, roomTabs, switchRoom } from '../model/rooms';
import { askConfirm } from './Confirm';

export function RoomTabs() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const tabs = roomTabs(project);
  const clear = () => useStore.setState({ selectedId: null, group: [], editing: null });
  const go = (id: string) => { clear(); commit((p) => switchRoom(p, id)); };
  const add = () => {
    const name = window.prompt('Name the new room (Shoe closet, Pantry…):', `Room ${tabs.length + 1}`);
    if (name == null) return;
    clear();
    // The room already here keeps its name (Room 1 until renamed: double-click its tab)
    commit((p) => addRoom(p, name));
  };
  const rename = (id: string, now: string) => {
    const name = window.prompt('Room name:', now);
    if (name?.trim()) commit((p) => renameRoom(p, id, name));
  };
  const remove = async (id: string, name: string) => {
    if (!(await askConfirm(`Take ${name} out of this job? Its walls and cabinets go with it (Undo brings it back).`, 'Remove the room'))) return;
    clear();
    commit((p) => removeRoom(p, id));
  };
  if (tabs.length < 2) return <button className="mini room-add" onClick={add} title="Another room in this job: its own walls and cabinets, priced and proposed with the rest">+ Room</button>;
  return (
    <div className="seg rooms" role="tablist" aria-label="Rooms">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.active} className={t.active ? 'on' : ''} title={t.active ? 'Double-click to rename' : `Show ${t.name}`}
          onClick={() => (t.active ? undefined : go(t.id))} onDoubleClick={() => rename(t.id, t.name)}>
          {t.name}
          {t.active && <span className="room-x" role="button" aria-label={`Remove ${t.name}`} title="Remove this room" onClick={(e) => { e.stopPropagation(); remove(t.id, t.name); }}>×</span>}
        </button>
      ))}
      <button onClick={add} title="Add a room">+</button>
    </div>
  );
}
