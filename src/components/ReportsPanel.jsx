import { useState } from 'react';
import { num, fmt, today, ym, dept, attSummary, activeEmployees, loanBalance } from '../lib/model.js';

export default function ReportsPanel({ store }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const cur = store.settings.currency || 'Rs';
  const emps = store.employees || [];

  const attRows = activeEmployees(store).map(e => ({ e, s: attSummary(store, e.id, month) }));
  const payrollCost = {};
  for (const p of (store.payslips || []).filter(x => x.status !== 'void')) {
    const e = emps.find(x => x.id === p.employee_id);
    const d = dept(store, e?.department_id)?.name || '—';
    payrollCost[d] = payrollCost[d] || { dept: d, months: {} };
    payrollCost[d].months[p.month] = (payrollCost[d].months[p.month] || 0) + num(p.net);
  }
  const months = [...new Set((store.payslips || []).map(p => p.month))].sort().slice(-6);
  const openLoans = (store.loans || []).filter(l => l.status === 'open').map(l => ({ l, bal: loanBalance(store, l.id) })).filter(x => x.bal > 0);
  const leaveUse = {};
  for (const l of (store.leaves || []).filter(x => x.status === 'approved')) {
    const t = (store.leaveTypes || []).find(x => x.id === l.type_id);
    const k = t?.name || 'leave';
    leaveUse[k] = (leaveUse[k] || 0) + num(l.days);
  }

  return (
    <div className="panel" style={{ maxWidth: 1100 }}>
      <div className="toolbar"><h2 className="ptitle" style={{ margin: 0 }}>Reports — رپورٹس</h2><span className="spacer" />
        <input className="in" type="month" value={month} onChange={e => setMonth(e.target.value)} /></div>

      <h3 className="ptitle" style={{ marginTop: 6 }}>Attendance % — {month}</h3>
      <table className="grid">
        <thead><tr><th>Employee</th><th className="num">Present</th><th className="num">Absent</th><th className="num">Leave</th><th className="num">Attendance %</th><th className="num">Late</th><th className="num">OT hrs</th></tr></thead>
        <tbody>
          {attRows.map(({ e, s }) => {
            const denom = s.p + s.a + s.half;
            const pct = denom ? Math.round((s.p + s.half * 0.5) / denom * 100) : null;
            return <tr key={e.id}><td><b>{e.name}</b> <span className="muted">{e.code}</span></td>
              <td className="num">{s.p}</td><td className="num">{s.a}</td><td className="num">{s.l}</td>
              <td className="num"><b>{pct === null ? '—' : pct + '%'}</b></td>
              <td className="num" style={s.late ? { color: '#b45309' } : {}}>{s.late}</td>
              <td className="num">{Math.round(s.ot / 60 * 10) / 10}</td></tr>;
          })}
          {!attRows.length && <tr><td colSpan="7" className="muted" style={{ padding: 14 }}>No employees.</td></tr>}
        </tbody>
      </table>

      <h3 className="ptitle" style={{ marginTop: 16 }}>Payroll cost by department</h3>
      <table className="grid">
        <thead><tr><th>Department</th>{months.map(m => <th key={m} className="num">{m}</th>)}</tr></thead>
        <tbody>
          {Object.values(payrollCost).map(r => (
            <tr key={r.dept}><td><b>{r.dept}</b></td>{months.map(m => <td key={m} className="num">{r.months[m] ? num(r.months[m]).toLocaleString() : '—'}</td>)}</tr>
          ))}
          {!months.length && <tr><td colSpan={7} className="muted" style={{ padding: 14 }}>No payroll run yet.</td></tr>}
        </tbody>
      </table>

      <div className="frow" style={{ gap: 24, marginTop: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3 className="ptitle">Loans outstanding</h3>
          <table className="grid">
            <thead><tr><th>Employee</th><th>Kind</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {openLoans.map(({ l, bal }) => {
                const e = emps.find(x => x.id === l.employee_id);
                return <tr key={l.id}><td><b>{e?.name}</b> <span className="muted">{e?.code}</span></td><td>{l.kind}</td><td className="num">{fmt(bal, cur)}</td></tr>;
              })}
              {!openLoans.length && <tr><td colSpan="3" className="muted" style={{ padding: 14 }}>Nothing outstanding.</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1 }}>
          <h3 className="ptitle">Leave usage (all time)</h3>
          <table className="grid">
            <thead><tr><th>Type</th><th className="num">Days taken</th></tr></thead>
            <tbody>
              {Object.entries(leaveUse).map(([k, v]) => <tr key={k}><td>{k}</td><td className="num">{v}</td></tr>)}
              {!Object.keys(leaveUse).length && <tr><td colSpan="2" className="muted" style={{ padding: 14 }}>No leaves approved.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
