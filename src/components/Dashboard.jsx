import { num, fmt, today, ym, attSummary, punchesOn, activeEmployees, loanBalance } from '../lib/model.js';

export default function Dashboard({ store, update, go }) {
  const cur = store.settings.currency || 'Rs';
  const emps = activeEmployees(store);
  const t = today();
  const rows = punchesOn(store, t);
  const present = rows.filter(r => r.status === 'P').length;
  const absent = rows.filter(r => r.status === 'A').length;
  const onLeave = rows.filter(r => r.status === 'L').length;
  const unmarked = emps.length - rows.length;
  const m = ym(t);
  const slipsThis = (store.payslips || []).filter(p => p.month === m && p.status !== 'void');
  const payrollTotal = slipsThis.reduce((s, p) => s + num(p.net), 0);
  const pendingLeaves = (store.leaves || []).filter(l => l.status === 'pending').length;
  const loansOut = (store.loans || []).filter(l => l.status === 'open').reduce((s, l) => s + loanBalance(store, l.id), 0);
  const lateToday = rows.filter(r => num(r.late_min) > 0).length;
  const monthOt = emps.reduce((s, e) => s + attSummary(store, e.id, m).ot, 0);

  const Card = ({ label, val, sub, warn }) => (
    <div className="pcard" style={{ flex: 1, minWidth: 160 }}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: warn ? '#dc2626' : '#0f172a' }}>{val}</div>
      {sub && <div className="muted" style={{ fontSize: 11 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="panel" style={{ maxWidth: 1100 }}>
      <h2 className="ptitle">Today — {t}</h2>
      <div className="frow" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Card label="Present" val={present} sub={`of ${emps.length} employees`} />
        <Card label="Absent" val={absent} warn={absent > 0} />
        <Card label="On leave" val={onLeave} />
        <Card label="Unmarked" val={unmarked} warn={unmarked > 0} />
        <Card label="Late arrivals" val={lateToday} warn={lateToday > 0} />
      </div>
      <h2 className="ptitle">This month — {m}</h2>
      <div className="frow" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <Card label="Payroll cost" val={fmt(payrollTotal, cur)} sub={`${slipsThis.length} slips`} />
        <Card label="Overtime" val={`${Math.round(monthOt / 60 * 10) / 10}h`} />
        <Card label="Pending leaves" val={pendingLeaves} warn={pendingLeaves > 0} />
        <Card label="Loans outstanding" val={fmt(loansOut, cur)} />
      </div>
      <div className="frow" style={{ gap: 10 }}>
        <button className="btn" onClick={() => go('attendance')}>Mark attendance</button>
        <button className="btn ghost" onClick={() => go('payroll')}>Payroll</button>
        <button className="btn ghost" onClick={() => go('leaves')}>Leave requests</button>
      </div>
    </div>
  );
}
