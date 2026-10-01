import { useState } from 'react';
import { uid, num, fmt, today, emp, payrollLines, slipTotals, payslipFor, nextSlipNo, nextSettleNo, settlementLines, activeEmployees, loanBalance, empLoans } from '../lib/model.js';
import { payslipHtml, salarySheetHtml, settlementHtml } from '../lib/prints.js';

export default function PayrollPanel({ store, update, user }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [settle, setSettle] = useState(null); // employee_id
  const [mode, setMode] = useState('run'); // run | slips | settle
  const cur = store.settings.currency || 'Rs';
  const by = (user && user.name) || 'app';
  const slips = (store.payslips || []).filter(p => p.month === month && p.status !== 'void');

  const run = () => {
    let made = 0;
    update(s => {
      for (const e of activeEmployees(s)) {
        if (payslipFor(s, e.id, month)) continue;
        const lines = payrollLines(s, e, month);
        const { gross, deduct, net } = slipTotals(lines);
        const slip = { id: uid('ps'), no: nextSlipNo(s), employee_id: e.id, month, issued_on: today(), lines, gross, deduct, net, status: 'issued', paid_on: '', paid_by: '' };
        s.payslips = s.payslips || [];
        s.payslips.push(slip);
        s.loanMoves = s.loanMoves || [];
        for (const l of lines) {
          if (l.loan_id) s.loanMoves.push({ id: uid('lm'), loan_id: l.loan_id, date: today(), kind: 'emi', amount: l.amount, payslip_id: slip.id, by });
        }
        made++;
      }
    }, `payroll run ${month}`);
    if (!made) alert('All active employees already have a slip for this month.');
    setMode('slips');
  };

  const voidSlip = p => update(s => {
    const x = s.payslips.find(y => y.id === p.id); x.status = 'void';
    s.loanMoves = s.loanMoves.filter(m => m.payslip_id !== p.id);
  }, 'void slip');

  const doSettle = () => {
    if (!settle) return;
    update(s => {
      const e = s.employees.find(x => x.id === settle);
      const lines = settlementLines(s, e);
      const { gross, deduct, net } = slipTotals(lines);
      s.settlements = s.settlements || [];
      s.settlements.push({ id: uid('st'), no: nextSettleNo(s), employee_id: e.id, date: today(), lines, net, note: f_note });
      e.status = 'left'; e.left_on = today();
      for (const ln of empLoans(s, e.id)) {
        const bal = loanBalance(s, ln.id);
        if (bal > 0) {
          s.loanMoves.push({ id: uid('lm'), loan_id: ln.id, date: today(), kind: 'settlement', amount: bal, by });
          ln.status = 'settled';
        }
      }
    }, 'final settlement');
    setSettle(null); setF_note('');
  };
  const [f_note, setF_note] = useState('');

  return (
    <div className="panel" style={{ maxWidth: 1150 }}>
      <div className="toolbar">
        <h2 className="ptitle" style={{ margin: 0 }}>Payroll — تنخواہ</h2>
        <span className="spacer" />
        <div className="acts">
          {[['run', 'Run payroll'], ['slips', 'Payslips'], ['settle', 'Settlements']].map(([m, l]) =>
            <button key={m} className={'btn small' + (mode === m ? '' : ' ghost')} onClick={() => setMode(m)}>{l}</button>)}
        </div>
      </div>

      <div className="frow" style={{ marginBottom: 10 }}>
        <input className="in" type="month" value={month} onChange={e => setMonth(e.target.value)} />
        {mode === 'run' && <button className="btn" onClick={run}>Run payroll for {month}</button>}
        {mode === 'slips' && slips.length > 0 && <button className="btn small ghost" onClick={() => window.api.export.print({ html: salarySheetHtml(store, slips, month) })}>Print salary sheet</button>}
      </div>

      {mode === 'run' && (
        <>
          <div className="frow" style={{ marginBottom: 10 }}>
            <span className="muted">Salary heads:</span>
            {(store.salaryHeads || []).map(h => (
              <span key={h.id} className="pcard" style={{ padding: '3px 8px', margin: 0, fontSize: 12 }}>
                {h.name} · {h.type === 'deduction' ? '−' : '+'}{fmt(h.amount, cur)}
                <button className="icon" style={{ marginLeft: 4 }} onClick={() => update(s => { s.salaryHeads = s.salaryHeads.filter(x => x.id !== h.id); }, 'delete head')}>✕</button>
              </span>
            ))}
            <button className="btn small ghost" onClick={() => {
              const name = prompt('Head name (e.g. Fuel allowance)'); if (!name) return;
              const type = prompt('earning or deduction?', 'earning'); if (type !== 'earning' && type !== 'deduction') return;
              const amount = prompt('Fixed amount', '0'); if (amount === null) return;
              update(s => (s.salaryHeads = s.salaryHeads || []).push({ id: uid('hd'), name, type, amount: num(amount) }), 'add head');
            }}>+ Head</button>
          </div>
          <table className="grid">
            <thead><tr><th>Employee</th><th className="num">Absent</th><th className="num">OT hrs</th><th className="num">Loans due</th><th className="num">Preview net</th><th></th></tr></thead>
            <tbody>
              {activeEmployees(store).map(e => {
                const existing = payslipFor(store, e.id, month);
                const lines = payrollLines(store, e, month);
                const { net } = slipTotals(lines);
                const loans = lines.filter(l => l.loan_id).reduce((t, l) => t + l.amount, 0);
                const absent = lines.find(l => l.name.startsWith('Absent'));
                const ot = lines.find(l => l.name.startsWith('Overtime'));
                return (
                  <tr key={e.id}>
                    <td><b>{e.name}</b> <span className="muted">{e.code}</span></td>
                    <td className="num">{absent ? absent.name.match(/\d+/)?.[0] : 0}</td>
                    <td className="num">{ot ? ot.name.match(/[\d.]+/)?.[0] : 0}</td>
                    <td className="num">{loans ? fmt(loans, cur) : '—'}</td>
                    <td className="num"><b>{fmt(net, cur)}</b></td>
                    <td>{existing ? <span className="muted">slip #{existing.no}</span> : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
              {!activeEmployees(store).length && <tr><td colSpan="6" className="muted" style={{ padding: 14 }}>No active employees.</td></tr>}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 12 }}>Preview = basic + heads + OT ({num(store.settings.otMultiplier) || 1}×) − absents − unpaid leave − loan EMI. Running payroll writes payslips and posts EMI deductions to each loan ledger.</p>
        </>
      )}

      {mode === 'slips' && (
        <table className="grid">
          <thead><tr><th>#</th><th>Employee</th><th>Month</th><th className="num">Net</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {slips.map(p => {
              const e = emp(store, p.employee_id);
              return (
                <tr key={p.id}>
                  <td>{p.no}</td><td><b>{e?.name}</b> <span className="muted">{e?.code}</span></td><td>{p.month}</td>
                  <td className="num">{fmt(p.net, cur)}</td><td>{p.status}{p.paid_on ? ' · ' + p.paid_on : ''}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn small ghost" onClick={() => window.api.export.print({ html: payslipHtml(store, p) })}>Print</button>
                    {p.status === 'issued' && <>
                      <button className="btn small ghost" onClick={() => update(s => { const x = s.payslips.find(y => y.id === p.id); x.status = 'paid'; x.paid_on = today(); x.paid_by = by; }, 'mark paid')}>Mark paid</button>
                      <button className="btn small ghost" onClick={() => { if (confirm(`Void slip #${p.no}? Its loan deductions are rolled back.`)) voidSlip(p); }}>Void</button>
                    </>}
                  </td>
                </tr>
              );
            })}
            {!slips.length && <tr><td colSpan="6" className="muted" style={{ padding: 14 }}>No payslips for {month} — run payroll first.</td></tr>}
          </tbody>
        </table>
      )}

      {mode === 'settle' && (
        <>
          <div className="frow" style={{ marginBottom: 10 }}>
            <select className="in" value={settle || ''} onChange={e => setSettle(e.target.value)}>
              <option value="">— employee leaving —</option>
              {(store.employees || []).filter(e => e.status !== 'left').map(e => <option key={e.id} value={e.id}>{e.code} · {e.name}</option>)}
            </select>
            <input className="in" style={{ width: 200 }} placeholder="Note (e.g. notice period)" value={f_note} onChange={e => setF_note(e.target.value)} />
            <button className="btn" disabled={!settle} onClick={() => { if (confirm('This marks the employee as left, settles open loans and creates a final settlement memo. Continue?')) doSettle(); }}>Settle &amp; print</button>
          </div>
          {settle && (() => {
            const e = emp(store, settle);
            const lines = settlementLines(store, e);
            const { gross, deduct, net } = slipTotals(lines);
            return (
              <div className="pcard" style={{ maxWidth: 560 }}>
                <b>Preview — {e.name}</b>
                <table className="grid" style={{ marginTop: 8 }}>
                  <tbody>
                    {lines.map((l, i) => <tr key={i}><td>{l.name}</td><td className="num">{l.type === 'deduction' ? '−' : ''}{fmt(l.amount, cur)}</td></tr>)}
                    <tr><td><b>Gross</b></td><td className="num">{fmt(gross, cur)}</td></tr>
                    <tr><td><b>Deductions</b></td><td className="num">{fmt(deduct, cur)}</td></tr>
                    <tr><td className="big"><b>Net payable</b></td><td className="num"><b>{fmt(net, cur)}</b></td></tr>
                  </tbody>
                </table>
                {!lines.length && <p className="muted">Nothing to settle — no worked days this month and no open loans.</p>}
              </div>
            );
          })()}
          <table className="grid" style={{ marginTop: 14 }}>
            <thead><tr><th>#</th><th>Employee</th><th>Date</th><th className="num">Net</th><th></th></tr></thead>
            <tbody>
              {(store.settlements || []).map(st => {
                const e = emp(store, st.employee_id);
                return <tr key={st.id}><td>{st.no}</td><td><b>{e?.name}</b></td><td>{st.date}</td><td className="num">{fmt(st.net, cur)}</td>
                  <td><button className="btn small ghost" onClick={() => window.api.export.print({ html: settlementHtml(store, st) })}>Print memo</button></td></tr>;
              })}
              {!(store.settlements || []).length && <tr><td colSpan="5" className="muted" style={{ padding: 14 }}>No settlements yet.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
