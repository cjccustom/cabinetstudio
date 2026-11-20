// What the client can try on their 3D page: door and drawer-front styles, paint colors and hardware
// finishes. Their picks come back as a note on the Portal tab with a button to put them in the design.
import { useState } from 'react';
import { useStore } from '../store';
import { doorStyles, styleById } from '../model/eagle';
import { colorByCode, searchColors } from '../model/paintColors';
import { pullFinishes } from '../model/pulls';

export function ClientChoices() {
  const project = useStore((s) => s.project);
  const commit = useStore((s) => s.commit);
  const [q, setQ] = useState('');
  const ch = project.clientChoices ?? {};
  const set = (k: 'doors' | 'paints' | 'hardware', list: string[]) => commit((p) => ({ ...p, clientChoices: { ...p.clientChoices, [k]: list.length ? list : undefined } }));
  const toggle = (k: 'doors' | 'paints' | 'hardware', v: string) => { const l = ch[k] ?? []; set(k, l.includes(v) ? l.filter((x) => x !== v) : [...l, v]); };
  const stain = project.settings.finish === 'stain';
  const nowStyle = styleById(project.settings.doorStyleId);
  const found = q.trim() ? searchColors(q, 12) : [];
  return (
    <div className="pgroup">
      <div className="pgroup-head"><span>Options the client can try in 3D</span></div>
      <p className="hint">They switch these on their 3D page and see them on the design, then send you their picks. Nothing changes until you apply them here, so check the price first. The choices go with the next design draft or drawings you send.</p>
      <p className="hint" style={{ marginBottom: 2 }}><b>Door and drawer-front styles</b> (drawn now: {nowStyle.name})</p>
      <div className="chip-list">
        {doorStyles.filter((d) => d.id !== nowStyle.id && d.line === nowStyle.line).map((d) => (
          <label key={d.id} className="chk-row" style={{ display: 'inline-flex', marginRight: 10 }}><input type="checkbox" checked={(ch.doors ?? []).includes(d.id)} onChange={() => toggle('doors', d.id)} /> {d.name}</label>
        ))}
      </div>
      {!stain && (
        <>
          <p className="hint" style={{ marginBottom: 2 }}><b>Paint colors</b>{project.finishes.named?.paint ? ` (drawn now: ${project.finishes.named.paint.name})` : ''}</p>
          <div className="chip-list">
            {(ch.paints ?? []).map((code) => { const c = colorByCode(code); return c ? <button key={code} className="link-btn" title="Take it off the list" onClick={() => toggle('paints', code)} style={{ marginRight: 10 }}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: c.hex, border: '1px solid #aaa', marginRight: 4, verticalAlign: -1 }} />{c.name} ({c.code}) ✕</button> : null; })}
          </div>
          <input aria-label="Find a paint color" placeholder="Add a color: name or number (White Dove, OC-17)" value={q} onChange={(e) => setQ(e.target.value)} />
          {found.length > 0 && (
            <div className="chip-list">
              {found.filter((c) => !(ch.paints ?? []).includes(c.code)).map((c) => (
                <button key={c.code} onClick={() => { toggle('paints', c.code); setQ(''); }} style={{ margin: '4px 6px 0 0' }}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: c.hex, border: '1px solid #aaa', marginRight: 4, verticalAlign: -1 }} />{c.name} ({c.code})</button>
              ))}
            </div>
          )}
        </>
      )}
      <p className="hint" style={{ marginBottom: 2 }}><b>Hardware finishes</b></p>
      <div className="chip-list">
        {pullFinishes.filter((f) => f.v !== (project.settings.pullFinish ?? 'nickel')).map((f) => (
          <label key={f.v} className="chk-row" style={{ display: 'inline-flex', marginRight: 10 }}><input type="checkbox" checked={(ch.hardware ?? []).includes(f.v)} onChange={() => toggle('hardware', f.v)} /> {f.label}</label>
        ))}
      </div>
    </div>
  );
}
