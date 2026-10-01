import { useState } from 'react';
import { uid, num, today, emp, leaveBalance, leaveDaysBetween, activeEmployees } from '../lib/model.js';

export default function LeavesPanel({ store, update, user }) {
  const [f, setF] = useState({ employee_id: '', type_id: '', from: today(), to: today(), reason: '' });
  const [empId, setEmpId] = useState('');
  const by = (user && user.name) || 'app';
  const emps = activeEmployees(store);
  const types = store.leaveTypes || [];
  const leaves = (store.leaves || []).slice().sort((a, b) => b.from.localeCompare(a.from));

  const add = () => {
    if (!f.employee_id || !f.type_id || !f.from || !f.to) return;
    update(s => s.leaves.push({ id: uid('lv'), employee_id: f.employee_id, type_id: f.type_id, from: f.from, to: f.to, days: leaveDaysBetween(f.from, f.to), reason: f.reason.trim(), status: 'pending' }), 'leave request');
    setF({ employee_id: '', type_id: '', from: today(), to: today(), reason: '' });
  };
  const decide = (l, status) => update(s => {
    const x = s.leaves.find(y => y.id === l.id);
    x.status = status; x.decided_by = by; x.decided_on = today();
    if (status === 'approved') {
      for (let d = l.from; d <= l.to; d = new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10)) {
        const p = s.punches.find(y => y.employee_id === l.employee_id && y.date === d);
        if (p) { p.status = 'L'; p.late_min = 0; p.ot_min = 0; }
        else s.punches.push({ id: uid('pu'), employee_id: l.employee_id, date: d, in: '', out: '', status: 'L', late_min: 0, work_min: 0, ot_min: 0, source: 'leave', marked_by: by });
      }
    }
  }, `leave ${status}`);

  return (
    <div className="panel" style={{ maxWidth: 1050 }}>
      <h2 className="ptitle">Leaves — چھٹیاں</h2>
      <div className="frow" style={{ marginBottom: 10 }}>
        <select className="in" value={f.employee_id} onChange={e => setF({ ...f, employee_id: e.target.value })}>
          <option value="">— employee —</option>
          {emps.map(e => <option key={e.id} value={e.id}>{e.code} · {e.name}</option>)}
        </select>
        <select className="in" value={f.type_id} onChange={e => setF({ ...f, type_id: e.target.value })}>
          <option value="">— type —</option>
          {types.map(t => <option key={t.id} value={t.id}>{t.name}{t.paid ? '' : ' (unpaid)'}</option>)}
        </select>
        <input className="in" type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} />
        <input className="in" type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} />
        <input className="in" placeholder="Reason" value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} />
        <button className="btn" onClick={add}>+ Request</button>
      </div>

      <div className="frow" style={{ marginBottom: 10 }}>
        <span className="muted">Leave types:</span>
        {types.map(t => (
          <span key={t.id} className="pcard" style={{ padding: '3px 8px', margin: 0, fontSize: 12 }}>
            {t.name} · {t.paid ? `${t.quota}d quota` : 'unpaid'}
            <button className="icon" style={{ marginLeft: 4 }} onClick={() => update(s => { s.leaveTypes = s.leaveTypes.filter(x => x.id !== t.id); }, 'delete leave type')}>✕</button>
          </span>
        ))}
        <button className="btn small ghost" onClick={() => {
          const name = prompt('Leave type (e.g. Hajj leave)'); if (!name?.trim()) return;
          const quota = prompt('Quota days per year (0 = unpaid/no quota)', '10'); if (quota === null) return;
          const paid = num(quota) > 0;
          update(s => (s.leaveTypes = s.leaveTypes || []).push({ id: uid('lt'), name: name.trim(), quota: num(quota), paid }), 'add leave type');
        }}>+ Type</button>
      </div>

      <table className="grid">
        <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th className="num">Days</th><th>Reason</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {leaves.map(l => {
            const e = emp(store, l.employee_id), t = types.find(x => x.id === l.type_id);
            return (
              <tr key={l.id}>
                <td><b>{e?.name}</b> <span className="muted">{e?.code}</span></td><td>{t?.name}</td>
                <td>{l.from}</td><td>{l.to}</td><td className="num">{l.days}</td><td className="muted">{l.reason}</td>
                <td>{l.status}{l.decided_on ? ' · ' + l.decided_on : ''}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {l.status === 'pending' && <>
                    <button className="btn small ghost" onClick={() => decide(l, 'approved')}>Approve</button>
                    <button className="btn small ghost" onClick={() => decide(l, 'rejected')}>Reject</button>
                  </>}
                  {l.status === 'approved' && <button className="btn small ghost" onClick={() => { if (confirm('Cancel this approved leave? Attendance marks stay as leave.')) update(s => { const x = s.leaves.find(y => y.id === l.id); x.status = 'rejected'; x.decided_by = by; x.decided_on = today(); }, 'cancel leave'); }}>Cancel</button>}
                </td>
              </tr>
            );
          })}
          {!leaves.length && <tr><td colSpan="8" className="muted" style={{ padding: 14 }}>No leave requests.</td></tr>}
        </tbody>
      </table>

      <h3 className="ptitle" style={{ marginTop: 16 }}>Balances</h3>
      <div className="frow" style={{ marginBottom: 8 }}>
        <select className="in" value={empId} onChange={e => setEmpId(e.target.value)}>
          <option value="">— pick employee —</option>
          {emps.map(e => <option key={e.id} value={e.id}>{e.code} · {e.name}</option>)}
        </select>
      </div>
      {empId && (
        <table className="grid" style={{ maxWidth: 520 }}>
          <thead><tr><th>Type</th><th className="num">Quota</th><th className="num">Used</th><th className="num">Left</th></tr></thead>
          <tbody>
            {types.filter(t => t.paid).map(t => {
              const b = leaveBalance(store, empId, t.id, today().slice(0, 4));
              return <tr key={t.id}><td>{t.name}</td><td className="num">{b.quota}</td><td className="num">{b.used}</td><td className="num"><b>{b.left}</b></td></tr>;
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
