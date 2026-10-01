import React from 'react';
import { fmt, num, activeTenants, monthSummary, defaulters, tenantUnit, unitLabel, billsFor, billOutstanding, today, ym } from '../lib/model.js';

export default function Dashboard({ store, update, go }) {
  const m = today().slice(0, 7);
  const sum = monthSummary(store, m);
  const defs = defaulters(store, m);
  const units = store.units || [];
  const occ = units.filter(u => u.status === 'occupied').length;
  const rentRoll = activeTenants(store).reduce((t, x) => t + num(x.rent), 0);
  const dueSoon = (store.bills || []).filter(b => b.status === 'unpaid' && b.due_date <= today());
  return (
    <div className="panel">
      <h2 className="ptitle">Dashboard — {m}</h2>
      <div className="cards">
        <div className="pcard"><div className="clabel">Collected this month</div><div className="cval">{fmt(sum.collected, store.settings.currency)}</div></div>
        <div className="pcard"><div className="clabel">Billed this month</div><div className="cval">{fmt(sum.billed, store.settings.currency)}</div><div className="muted">{sum.billCount} bills</div></div>
        <div className="pcard"><div className="clabel">Occupancy</div><div className="cval">{occ}/{units.length}</div><div className="muted">{units.length - occ} vacant</div></div>
        <div className="pcard"><div className="clabel">Rent roll / month</div><div className="cval">{fmt(rentRoll, store.settings.currency)}</div></div>
        <div className="pcard" style={{ borderColor: defs.length ? '#f59e0b' : undefined }}><div className="clabel">Defaulters</div><div className="cval">{defs.length}</div><div className="muted">owe {fmt(defs.reduce((t, d) => t + d.owes, 0), store.settings.currency)}</div></div>
        <div className="pcard"><div className="clabel">Expenses this month</div><div className="cval">{fmt(sum.expenses, store.settings.currency)}</div></div>
      </div>

      {dueSoon.length > 0 && (
        <div className="pcard" style={{ marginTop: 14, borderLeft: '3px solid #dc2626' }}>
          <b>{dueSoon.length} bill(s) past due date</b> — collect karne ke liye Bills pe jayen.
        </div>
      )}

      <h3 className="ptitle" style={{ fontSize: 15, marginTop: 18 }}>Top defaulters</h3>
      <table className="grid">
        <thead><tr><th>Tenant</th><th>Unit</th><th>Oldest unpaid</th><th className="r">Owes</th><th></th></tr></thead>
        <tbody>
          {defs.slice(0, 8).map(d => (
            <tr key={d.tenant.id}>
              <td>{d.tenant.name}</td><td>{unitLabel(store, tenantUnit(store, d.tenant))}</td>
              <td>{d.oldest}</td><td className="r">{fmt(d.owes, store.settings.currency)}</td>
              <td><button className="btn small ghost" onClick={() => go('bills')}>Collect</button></td>
            </tr>
          ))}
          {!defs.length && <tr><td colSpan="5" className="muted">Koi defaulter nahi — sab clear.</td></tr>}
        </tbody>
      </table>
      <div className="frow" style={{ marginTop: 14 }}>
        <button className="btn" onClick={() => go('bills')}>Month-end: generate bills</button>
        <button className="btn ghost" onClick={() => go('reports')}>Reports</button>
      </div>
    </div>
  );
}
