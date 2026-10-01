import { useState } from 'react';
import { uid, num, fmt, today, ym, emp, loanBalance, activeEmployees } from '../lib/model.js';

export default function LoansPanel({ store, update, user }) {
  const [f, setF] = useState({ employee_id: '', kind: 'loan', principal: '', emi: '', start_month: today().slice(0, 7), note: '' });
  const [payLoan, setPayLoan] = useState(null);
  const [payAmt, setPayAmt] = useState('');
  const cur = store.settings.currency || 'Rs';
  const by = (user && user.name) || 'app';
  const loans = (store.loans || []).slice().sort((a, b) => b.taken_on.localeCompare(a.taken_on));

  const add = () => {
    if (!f.employee_id || !num(f.principal)) return;
    update(s => {
      s.loans.push({ id: uid('ln'), employee_id: f.employee_id, kind: f.kind, principal: num(f.principal), taken_on: today(), emi: num(f.emi), start_month: f.start_month, status: 'open', note: f.note.trim() });
      s.loanMoves.push({ id: uid('lm'), loan_id: s.loans[s.loans.length - 1].id, date: today(), kind: 'issue', amount: num(f.principal), by });
    }, 'loan issued');
    setF({ employee_id: '', kind: 'loan', principal: '', emi: '', start_month: today().slice(0, 7), note: '' });
  };
  const recordPay = () => {
    if (!payLoan || !num(payAmt)) return;
    update(s => {
      s.loanMoves.push({ id: uid('lm'), loan_id: payLoan, date: today(), kind: 'payment', amount: num(payAmt), by });
      const ln = s.loans.find(x => x.id === payLoan);
      if (loanBalance(s, payLoan) <= 0) ln.status = 'settled';
    }, 'loan payment');
    setPayLoan(null); setPayAmt('');
  };
  const waive = l => update(s => {
    const bal = loanBalance(s, l.id);
    s.loanMoves.push({ id: uid('lm'), loan_id: l.id, date: today(), kind: 'waiver', amount: bal, by });
    const x = s.loans.find(y => y.id === l.id); x.status = 'settled';
  }, 'loan waived');

  return (
    <div className="panel" style={{ maxWidth: 1050 }}>
      <h2 className="ptitle">Loans &amp; advances — قرضہ / ایڈوانس</h2>
      <div className="frow" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
        <select className="in" value={f.employee_id} onChange={e => setF({ ...f, employee_id: e.target.value })}>
          <option value="">— employee —</option>
          {activeEmployees(store).map(e => <option key={e.id} value={e.id}>{e.code} · {e.name}</option>)}
        </select>
        <select className="in" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>
          <option value="loan">loan</option><option value="advance">salary advance</option>
        </select>
        <input className="in" style={{ width: 110 }} placeholder="Amount" value={f.principal} onChange={e => setF({ ...f, principal: e.target.value })} />
        <input className="in" style={{ width: 110 }} placeholder="EMI / month" value={f.emi} onChange={e => setF({ ...f, emi: e.target.value })} />
        <label className="lbl" style={{ fontSize: 12 }}>Start month<input className="in" type="month" value={f.start_month} onChange={e => setF({ ...f, start_month: e.target.value })} /></label>
        <input className="in" style={{ width: 140 }} placeholder="Note" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
        <button className="btn" onClick={add}>+ Issue</button>
      </div>

      <table className="grid">
        <thead><tr><th>Employee</th><th>Kind</th><th>Taken</th><th className="num">Principal</th><th className="num">EMI</th><th className="num">Balance</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {loans.map(l => {
            const e = emp(store, l.employee_id), bal = loanBalance(store, l.id);
            return (
              <tr key={l.id}>
                <td><b>{e?.name}</b> <span className="muted">{e?.code}</span></td>
                <td>{l.kind}</td><td className="muted">{l.taken_on}</td>
                <td className="num">{fmt(l.principal, cur)}</td><td className="num">{l.emi ? fmt(l.emi, cur) : '—'}</td>
                <td className="num"><b>{fmt(bal, cur)}</b></td>
                <td>{l.status}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {l.status === 'open' && bal > 0 && <>
                    <button className="btn small ghost" onClick={() => setPayLoan(l.id)}>+ Payment</button>
                    <button className="btn small ghost" onClick={() => { if (confirm(`Waive remaining ${fmt(bal, cur)}?`)) waive(l); }}>Waive</button>
                  </>}
                  <button className="btn small ghost" onClick={() => {
                    const moves = (store.loanMoves || []).filter(m => m.loan_id === l.id).map(m => `${m.date}  ${m.kind.padEnd(10)}  ${fmt(m.amount, cur)}${m.payslip_id ? '  (salary)' : ''}`).join('\n');
                    alert(`${e?.name} — ${l.kind}\n\n${moves || 'no movements'}\n\nBalance: ${fmt(bal, cur)}`);
                  }}>Ledger</button>
                </td>
              </tr>
            );
          })}
          {!loans.length && <tr><td colSpan="8" className="muted" style={{ padding: 14 }}>No loans/advances.</td></tr>}
        </tbody>
      </table>

      {payLoan && (
        <div className="pcard" style={{ marginTop: 14, maxWidth: 420 }}>
          <b>Record payment — {emp(store, loans.find(l => l.id === payLoan)?.employee_id)?.name}</b>
          <div className="frow" style={{ marginTop: 8 }}>
            <input className="in" type="number" min="0" placeholder="Amount" value={payAmt} onChange={e => setPayAmt(e.target.value)} />
            <button className="btn" onClick={recordPay}>Save</button>
            <button className="btn ghost" onClick={() => setPayLoan(null)}>Cancel</button>
          </div>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>EMI deducts automatically in payroll from the start month. Manual payments and salary deductions both reduce the balance.</p>
    </div>
  );
}
