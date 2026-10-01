import React, { useState } from 'react';
import { uid, fmt, num, prop } from '../lib/model.js';

export default function PropertiesPanel({ store, update }) {
  const [editP, setEditP] = useState(null);
  const [editU, setEditU] = useState(null);
  const kinds = ['shop', 'flat', 'house', 'room', 'plot', 'other'];

  const saveP = () => update(s => {
    if (editP.id) Object.assign(s.properties.find(x => x.id === editP.id), editP);
    else s.properties.push({ ...editP, id: uid('p') });
  }, editP.id ? 'edit property' : 'new property');
  const saveU = () => update(s => {
    if (editU.id) Object.assign(s.units.find(x => x.id === editU.id), editU);
    else s.units.push({ ...editU, id: uid('u'), status: 'vacant' });
  }, editU.id ? 'edit unit' : 'new unit');

  return (
    <div className="panel">
      <h2 className="ptitle">Properties</h2>
      <table className="grid">
        <thead><tr><th>Name</th><th>Address</th><th className="r">Units</th><th></th></tr></thead>
        <tbody>
          {(store.properties || []).map(p => (
            <tr key={p.id}>
              <td>{p.name}</td><td>{p.address}</td>
              <td className="r">{(store.units || []).filter(u => u.property_id === p.id).length}</td>
              <td>
                <button className="btn small ghost" onClick={() => setEditP({ ...p })}>Edit</button>
                <button className="icon" onClick={() => { if (confirm('Delete property? (units must be deleted first)')) update(s => s.properties = s.properties.filter(x => x.id !== p.id), 'delete property'); }}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="frow" style={{ margin: '8px 0 18px' }}>
        <button className="btn small ghost" onClick={() => setEditP({ name: '', address: '' })}>+ Property</button>
      </div>
      {editP && (
        <div className="pcard">
          <div className="frow">
            <input className="in" style={{ flex: 1 }} placeholder="Property name" value={editP.name} onChange={e => setEditP({ ...editP, name: e.target.value })} />
            <input className="in" style={{ flex: 2 }} placeholder="Address" value={editP.address} onChange={e => setEditP({ ...editP, address: e.target.value })} />
          </div>
          <div className="frow" style={{ marginTop: 8 }}>
            <button className="btn small" onClick={() => { saveP(); setEditP(null); }}>Save</button>
            <button className="btn small ghost" onClick={() => setEditP(null)}>Cancel</button>
          </div>
        </div>
      )}

      <h2 className="ptitle">Units</h2>
      <table className="grid">
        <thead><tr><th>Code</th><th>Property</th><th>Kind</th><th className="r">Rent</th><th>Metered</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {(store.units || []).map(u => (
            <tr key={u.id}>
              <td>{u.code}</td><td>{prop(store, u.property_id)?.name}</td><td>{u.kind}</td>
              <td className="r">{fmt(u.rent, store.settings.currency)}</td>
              <td>{u.metered ? '✓' : '—'}</td>
              <td><span className={u.status === 'occupied' ? 'tag ok' : 'tag'}>{u.status}</span></td>
              <td>
                <button className="btn small ghost" onClick={() => setEditU({ ...u })}>Edit</button>
                <button className="icon" onClick={() => { if (confirm('Delete unit?')) update(s => s.units = s.units.filter(x => x.id !== u.id), 'delete unit'); }}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="frow" style={{ margin: '8px 0 18px' }}>
        <button className="btn small ghost" onClick={() => setEditU({ property_id: store.properties[0]?.id || '', code: '', kind: 'shop', floor: '', size: '', rent: 0, metered: false })}>+ Unit</button>
      </div>
      {editU && (
        <div className="pcard">
          <div className="frow">
            <select className="in" value={editU.property_id} onChange={e => setEditU({ ...editU, property_id: e.target.value })}>
              {(store.properties || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className="in" placeholder="Code (Shop 1)" value={editU.code} onChange={e => setEditU({ ...editU, code: e.target.value })} />
            <select className="in" value={editU.kind} onChange={e => setEditU({ ...editU, kind: e.target.value })}>
              {kinds.map(k => <option key={k}>{k}</option>)}
            </select>
            <input className="in" style={{ width: 100 }} placeholder="Floor" value={editU.floor} onChange={e => setEditU({ ...editU, floor: e.target.value })} />
            <input className="in" style={{ width: 120 }} type="number" placeholder="Rent" value={editU.rent || ''} onChange={e => setEditU({ ...editU, rent: num(e.target.value) })} />
            <label className="chk"><input type="checkbox" checked={!!editU.metered} onChange={e => setEditU({ ...editU, metered: e.target.checked })} /> Metered</label>
          </div>
          <div className="frow" style={{ marginTop: 8 }}>
            <button className="btn small" onClick={() => { saveU(); setEditU(null); }}>Save</button>
            <button className="btn small ghost" onClick={() => setEditU(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
