import React, { useState } from 'react';
import { uid, fmt, num, prop, ym, today } from '../lib/model.js';

export default function ExpensesPanel({ store, update, user }) {
  const [form, setForm] = useState({ date: today(), property_id: store.properties[0]?.id || '', head: '', amount: '', note: '' });
  const [month, setMonth] = useState(today().slice(0, 7));
  const cur = store.settings.currency;
  const rows = (store.expenses || []).filter(e => ym(e.date) === month).sort((a, b) => b.date.localeCompare(a.date));

  const add = () => {
    if (!form.head || !num(form.amount)) return;
    update(s => s.expenses.push({ ...form, id: uid('e'), amount: num(form.amount), by: user?.name || 'app' }), 'expense');
    setForm({ ...form, head: '', amount: '', note: '' });
  };

  return (
    <div className="panel">
      <div className="frow" style={{ alignItems: 'center' }}>
        <h2 className="ptitle" style={{ margin: 0, flex: 1 }}>Property expenses — {month}</h2>
        <input className="in" type="month" value={month} onChange={e => setMonth(e.target.value)} />
      </div>
      <div className="frow" style={{ marginBottom: 12 }}>
        <input className="in" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
        <select className="in" value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value })}>
          {(store.properties || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input className="in" style={{ flex: 1 }} placeholder="Head (repair, tax, salary…)" value={form.head} onChange={e => setForm({ ...form, head: e.target.value })} />
        <input className="in" style={{ width: 120 }} type="number" placeholder="Amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        <input className="in" style={{ flex: 1 }} placeholder="Note" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
        <button className="btn small" onClick={add}>+ Add</button>
      </div>
      <table className="grid">
        <thead><tr><th>Date</th><th>Property</th><th>Head</th><th>Note</th><th className="r">Amount</th><th>By</th><th></th></tr></thead>
        <tbody>
          {rows.map(e => (
            <tr key={e.id}>
              <td>{e.date}</td><td>{prop(store, e.property_id)?.name}</td><td>{e.head}</td><td className="muted">{e.note}</td>
              <td className="r">{fmt(e.amount, cur)}</td><td>{e.by}</td>
              <td><button className="icon" onClick={() => { if (confirm('Delete expense?')) update(s => s.expenses = s.expenses.filter(x => x.id !== e.id), 'delete expense'); }}>✕</button></td>
            </tr>
          ))}
          <tr><td colSpan="4"><b>Total</b></td><td className="r"><b>{fmt(rows.reduce((t, e) => t + num(e.amount), 0), cur)}</b></td><td colSpan="2"></td></tr>
        </tbody>
      </table>
    </div>
  );
}
