import React, { useState } from 'react';
import { fmt, num, uid, unitLabel, lastMeterReading, activeTenants, tenantUnit, tenant, today } from '../lib/model.js';

export default function MetersPanel({ store, update }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const cur = store.settings.currency;
  const meteredUnits = (store.units || []).filter(u => u.metered && u.status === 'occupied');
  const rows = meteredUnits.map(u => {
    const t = activeTenants(store).find(x => x.unit_id === u.id);
    const m = (store.meters || []).find(x => x.unit_id === u.id && x.month === month);
    const prev = m ? m.prev : lastMeterReading(store, u.id, month);
    return { u, t, m, prev };
  });

  const setReading = (u, t, curr, rate) => update(s => {
    let m = (s.meters || []).find(x => x.unit_id === u.id && x.month === month);
    const prev = m ? num(m.prev) : lastMeterReading(store, u.id, month);
    const units = Math.max(0, num(curr) - prev);
    const amount = Math.round(units * num(rate));
    if (m) Object.assign(m, { curr: num(curr), rate: num(rate), units, amount });
    else s.meters.push({ id: uid('m'), unit_id: u.id, tenant_id: t?.id || '', month, prev, curr: num(curr), units, rate: num(rate), amount, status: 'open' });
  }, `meter ${u.code} ${month}`);

  return (
    <div className="panel">
      <div className="frow" style={{ alignItems: 'center' }}>
        <h2 className="ptitle" style={{ margin: 0, flex: 1 }}>Electricity meters — {month}</h2>
        <input className="in" type="month" value={month} onChange={e => setMonth(e.target.value)} />
      </div>
      <p className="muted">Reading enter karein — units × rate = amount agle rent bill mein khud line ban jata hai ("billed" mark hone pe lock).</p>
      <table className="grid">
        <thead><tr><th>Unit</th><th>Tenant</th><th className="r">Prev</th><th className="r">Current</th><th className="r">Rate</th><th className="r">Units</th><th className="r">Amount</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map(({ u, t, m, prev }) => (
            <tr key={u.id}>
              <td>{unitLabel(store, u)}</td><td>{t?.name || '—'}</td>
              <td className="r">{m ? m.prev : prev}</td>
              <td className="r">
                {m?.status === 'billed' ? m.curr : (
                  <input className="in" style={{ width: 100 }} type="number" defaultValue={m?.curr ?? ''} placeholder="reading"
                    onBlur={e => e.target.value && setReading(u, t, e.target.value, m?.rate ?? 32)} />
                )}
              </td>
              <td className="r">
                {m?.status === 'billed' ? m.rate : (
                  <input className="in" style={{ width: 70 }} type="number" defaultValue={m?.rate ?? 32}
                    onBlur={e => m && setReading(u, t, m.curr, e.target.value)} />
                )}
              </td>
              <td className="r">{m?.units || '—'}</td>
              <td className="r"><b>{m ? fmt(m.amount, cur) : '—'}</b></td>
              <td><span className={'tag ' + (m?.status === 'billed' ? 'ok' : '')}>{m?.status || '—'}</span></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="8" className="muted">Koi metered occupied unit nahi.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
