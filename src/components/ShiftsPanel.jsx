import { useState } from 'react';
import { uid, num } from '../lib/model.js';

const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ShiftsPanel({ store, update }) {
  const [f, setF] = useState({ name: '', start: '09:00', end: '17:00', grace_min: 10, off_days: [0] });
  const shifts = store.shifts || [];

  const toggleOff = d => setF({ ...f, off_days: f.off_days.includes(d) ? f.off_days.filter(x => x !== d) : [...f.off_days, d] });
  const add = () => {
    if (!f.name.trim()) return;
    update(s => s.shifts.push({ id: uid('sh'), name: f.name.trim(), start: f.start, end: f.end, grace_min: num(f.grace_min), off_days: f.off_days }), 'add shift');
    setF({ name: '', start: '09:00', end: '17:00', grace_min: 10, off_days: [0] });
  };

  return (
    <div className="panel" style={{ maxWidth: 900 }}>
      <h2 className="ptitle">Shifts — شفٹیں</h2>
      <div className="frow" style={{ marginBottom: 10, flexWrap: 'wrap', alignItems: 'end' }}>
        <input className="in" placeholder="Shift name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <label className="lbl">Start<input className="in" type="time" value={f.start} onChange={e => setF({ ...f, start: e.target.value })} /></label>
        <label className="lbl">End<input className="in" type="time" value={f.end} onChange={e => setF({ ...f, end: e.target.value })} /></label>
        <label className="lbl">Grace (min)<input className="in" type="number" min="0" style={{ width: 80 }} value={f.grace_min} onChange={e => setF({ ...f, grace_min: e.target.value })} /></label>
        <span className="muted" style={{ fontSize: 12 }}>Weekly off:</span>
        {DOWS.map((d, i) => (
          <label key={d} className="chk" style={{ fontSize: 12 }}><input type="checkbox" checked={f.off_days.includes(i)} onChange={() => toggleOff(i)} />{d}</label>
        ))}
        <button className="btn" onClick={add}>+ Shift</button>
      </div>
      <table className="grid">
        <thead><tr><th>Shift</th><th>Start</th><th>End</th><th className="num">Grace</th><th>Weekly off</th><th className="num">Employees</th><th></th></tr></thead>
        <tbody>
          {shifts.map(s => (
            <tr key={s.id}>
              <td><b>{s.name}</b></td><td>{s.start}</td><td>{s.end}</td><td className="num">{s.grace_min} min</td>
              <td>{(s.off_days || []).map(d => DOWS[d]).join(', ') || '—'}</td>
              <td className="num">{(store.employees || []).filter(e => e.shift_id === s.id).length}</td>
              <td><button className="icon" onClick={() => { if (confirm(`Delete shift ${s.name}?`)) update(x => { x.shifts = x.shifts.filter(y => y.id !== s.id); }, 'delete shift'); }}>✕</button></td>
            </tr>
          ))}
          {!shifts.length && <tr><td colSpan="7" className="muted" style={{ padding: 14 }}>No shifts — add at least one so attendance can flag late/OT.</td></tr>}
        </tbody>
      </table>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Late arrival = in-time after shift start + grace. Overtime = worked minutes beyond shift end − start.</p>
    </div>
  );
}
