import React, { useState } from 'react';
import { fmt, num, tenant, tenantUnit, unitLabel, billPaid, billOutstanding, generateMonthBills, receivePayment, voidBill, voidReceipt, today } from '../lib/model.js';
import { billHtml, receiptHtml, collectionHtml } from '../lib/prints.js';

export default function BillsPanel({ store, update, user }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [pay, setPay] = useState(null);       // {bill}
  const [tab, setTab] = useState('bills');
  const cur = store.settings.currency;
  const canMoney = !user || ['owner', 'manager', 'collector'].includes(user.role);

  const bills = (store.bills || []).filter(b => b.month === month).sort((a, b) => a.no - b.no);
  const receipts = (store.receipts || []).filter(r => r.date.startsWith(month)).sort((a, b) => b.no - a.no);

  const gen = () => update(s => { const { made, skipped } = generateMonthBills(s, month); alert(`${made.length} bills generate hue${skipped.length ? `, ${skipped.length} already existed` : ''}.`); }, `generate bills ${month}`);

  const doPay = () => {
    if (!num(pay.amount)) return;
    update(s => receivePayment(s, { tenant_id: pay.bill.tenant_id, bill_id: pay.bill.id, amount: num(pay.amount), mode: pay.mode, ref: pay.ref, date: pay.date }, user?.name || 'app'), `receipt for bill #${pay.bill.no}`);
    setPay(null);
  };

  const printAll = () => bills.forEach(b => window.api.export.pdf({ html: billHtml(store, b), suggestedName: `bill-${b.no}.pdf` }));

  return (
    <div className="panel">
      <div className="frow" style={{ alignItems: 'center' }}>
        <h2 className="ptitle" style={{ margin: 0, flex: 1 }}>Rent bills — {month}</h2>
        <input className="in" type="month" value={month} onChange={e => setMonth(e.target.value)} />
        <button className="btn" onClick={gen}>Generate bills</button>
        <button className="btn ghost" onClick={printAll} disabled={!bills.length}>Print all</button>
        <button className="btn ghost" onClick={() => window.api.export.pdf({ html: collectionHtml(store, month), suggestedName: `collection-${month}.pdf` })}>Collection register</button>
      </div>
      <div className="frow" style={{ margin: '10px 0' }}>
        <button className={'btn small' + (tab === 'bills' ? '' : ' ghost')} onClick={() => setTab('bills')}>Bills</button>
        <button className={'btn small' + (tab === 'receipts' ? '' : ' ghost')} onClick={() => setTab('receipts')}>Receipts</button>
      </div>

      {tab === 'bills' && (
        <table className="grid">
          <thead><tr><th>#</th><th>Tenant</th><th>Lines</th><th className="r">Arrears</th><th className="r">Total</th><th className="r">Paid</th><th className="r">Due</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {bills.map(b => {
              const t = tenant(store, b.tenant_id) || {};
              const paid = billPaid(store, b), out = billOutstanding(store, b);
              return (
                <tr key={b.id} className={b.status === 'void' ? 'muted' : ''}>
                  <td>{b.no}</td>
                  <td>{t.name}<div className="muted" style={{ fontSize: 11 }}>{unitLabel(store, tenantUnit(store, t))}</div></td>
                  <td className="muted" style={{ fontSize: 11 }}>{(b.lines || []).map(l => `${l.name} ${num(l.amount).toLocaleString()}`).join(' + ')}</td>
                  <td className="r">{num(b.arrears) ? num(b.arrears).toLocaleString() : '—'}</td>
                  <td className="r"><b>{fmt(b.total, cur)}</b></td>
                  <td className="r">{paid.toLocaleString()}</td>
                  <td className="r" style={{ color: out ? '#dc2626' : '#16a34a' }}>{out ? out.toLocaleString() : '✓'}</td>
                  <td><span className={'tag ' + (b.status === 'paid' ? 'ok' : b.status === 'void' ? '' : 'warn')}>{b.status}{b.due_date < today() && out ? ' · overdue' : ''}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {b.status !== 'void' && <>
                      <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: billHtml(store, b), suggestedName: `bill-${b.no}.pdf` })}>Print</button>
                      {canMoney && out > 0 && <button className="btn small" onClick={() => setPay({ bill: b, amount: out, date: today(), mode: 'cash', ref: '' })}>Collect</button>}
                      {canMoney && paid === 0 && <button className="icon" title="Void bill" onClick={() => { const r = prompt('Void reason:'); if (r !== null) update(s => voidBill(s, b.id, r), `void bill #${b.no}`); }}>✕</button>}
                    </>}
                    {b.status === 'void' && <span className="muted" style={{ fontSize: 11 }}>void — {b.void_reason}</span>}
                  </td>
                </tr>
              );
            })}
            {!bills.length && <tr><td colSpan="9" className="muted">Is month ke liye bills nahi — "Generate bills" dabayen.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'receipts' && (
        <table className="grid">
          <thead><tr><th>#</th><th>Date</th><th>Tenant</th><th>Mode</th><th className="r">Amount</th><th>By</th><th></th></tr></thead>
          <tbody>
            {receipts.map(r => {
              const t = tenant(store, r.tenant_id) || {};
              return (
                <tr key={r.id} className={r.status === 'void' ? 'muted' : ''}>
                  <td>{r.no}</td><td>{r.date}</td><td>{t.name}</td>
                  <td>{r.mode}{r.ref ? ' · ' + r.ref : ''}</td>
                  <td className="r">{r.status === 'void' ? 'VOID' : fmt(r.amount, cur)}</td><td>{r.by}</td>
                  <td>
                    <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: receiptHtml(store, r), suggestedName: `receipt-${r.no}.pdf` })}>Print</button>
                    {r.status !== 'void' && canMoney && <button className="icon" title="Void receipt" onClick={() => { const x = prompt('Void reason (receipt row kept):'); if (x !== null) update(s => voidReceipt(s, r.id, x), `void receipt #${r.no}`); }}>✕</button>}
                  </td>
                </tr>
              );
            })}
            {!receipts.length && <tr><td colSpan="7" className="muted">No receipts this month.</td></tr>}
          </tbody>
        </table>
      )}

      {pay && (
        <div className="pcard" style={{ marginTop: 12 }}>
          <b>Collect — bill #{pay.bill.no} ({tenant(store, pay.bill.tenant_id)?.name})</b>
          <div className="frow" style={{ marginTop: 8 }}>
            <label className="lbl">Amount <input className="in" style={{ width: 120 }} type="number" value={pay.amount} onChange={e => setPay({ ...pay, amount: e.target.value })} /></label>
            <label className="lbl">Date <input className="in" type="date" value={pay.date} onChange={e => setPay({ ...pay, date: e.target.value })} /></label>
            <select className="in" value={pay.mode} onChange={e => setPay({ ...pay, mode: e.target.value })}>
              {['cash', 'bank', 'online', 'cheque'].map(m => <option key={m}>{m}</option>)}
            </select>
            <input className="in" placeholder="Ref / cheque #" value={pay.ref} onChange={e => setPay({ ...pay, ref: e.target.value })} />
            <button className="btn small" onClick={doPay}>Receive</button>
            <button className="btn small ghost" onClick={() => setPay(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
