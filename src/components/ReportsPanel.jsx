import React, { useState } from 'react';
import { fmt, num, monthSummary, defaulters, addMonths, ym, prop, today } from '../lib/model.js';
import { defaultersHtml, collectionHtml, occupancyHtml } from '../lib/prints.js';

export default function ReportsPanel({ store }) {
  const cur = store.settings.currency;
  const m0 = today().slice(0, 7);
  const months = [...Array(6)].map((_, i) => addMonths(m0, -i)).reverse();
  const defs = defaulters(store, m0);

  const trend = months.map(m => ({ m, ...monthSummary(store, m) }));
  const perProp = (store.properties || []).map(p => {
    const us = (store.units || []).filter(u => u.property_id === p.id);
    const occ = us.filter(u => u.status === 'occupied');
    const exp = (store.expenses || []).filter(e => e.property_id === p.id && ym(e.date) === m0).reduce((t, e) => t + num(e.amount), 0);
    return { p, units: us.length, occ: occ.length, roll: occ.reduce((t, u) => t + num(u.rent), 0), exp };
  });

  return (
    <div className="panel">
      <h2 className="ptitle">Reports</h2>
      <div className="frow" style={{ marginBottom: 14 }}>
        <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: defaultersHtml(store, m0, defs), suggestedName: `defaulters-${m0}.pdf` })}>Print defaulters</button>
        <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: collectionHtml(store, m0), suggestedName: `collection-${m0}.pdf` })}>Print collection register</button>
        <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: occupancyHtml(store), suggestedName: `occupancy-${m0}.pdf` })}>Print occupancy</button>
      </div>

      <h3 className="ptitle" style={{ fontSize: 14 }}>6-month trend</h3>
      <table className="grid">
        <thead><tr><th>Month</th><th className="r">Billed</th><th className="r">Collected</th><th className="r">Expenses</th><th className="r">Net</th><th className="r">Rate</th></tr></thead>
        <tbody>
          {trend.map(t => (
            <tr key={t.m}>
              <td>{t.m}</td><td className="r">{t.billed.toLocaleString()}</td><td className="r">{t.collected.toLocaleString()}</td>
              <td className="r">{t.expenses.toLocaleString()}</td>
              <td className="r"><b>{(t.collected - t.expenses).toLocaleString()}</b></td>
              <td className="r">{t.billed ? Math.round(t.collected / t.billed * 100) + '%' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="ptitle" style={{ fontSize: 14 }}>Per property — {m0}</h3>
      <table className="grid">
        <thead><tr><th>Property</th><th className="r">Units</th><th className="r">Occupied</th><th className="r">Rent roll</th><th className="r">Expenses</th></tr></thead>
        <tbody>
          {perProp.map(({ p, units, occ, roll, exp }) => (
            <tr key={p.id}><td>{p.name}</td><td className="r">{units}</td><td className="r">{occ}</td>
              <td className="r">{fmt(roll, cur)}</td><td className="r">{fmt(exp, cur)}</td></tr>
          ))}
        </tbody>
      </table>

      <h3 className="ptitle" style={{ fontSize: 14 }}>Defaulters</h3>
      <table className="grid">
        <thead><tr><th>Tenant</th><th>Phone</th><th>Oldest unpaid</th><th className="r">Owes</th></tr></thead>
        <tbody>
          {defs.map(d => (
            <tr key={d.tenant.id}><td>{d.tenant.name}</td><td>{d.tenant.phone}</td><td>{d.oldest}</td>
              <td className="r" style={{ color: '#dc2626', fontWeight: 600 }}>{fmt(d.owes, cur)}</td></tr>
          ))}
          {!defs.length && <tr><td colSpan="4" className="muted">Koi defaulter nahi.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
