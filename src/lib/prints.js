// Print HTML: rent bill (A5), payment receipt (A5/thermal-friendly), tenant
// statement (A5), defaulter list & monthly collection register (A4), occupancy.
import { fmt, num, tenant, unit, prop, tenantUnit, unitLabel, billPaid, billOutstanding, ym } from './model.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const monthName = m => { const d = new Date(m + '-01'); return d.toLocaleString('en', { month: 'long', year: 'numeric' }); };
const baseCss = extra => `
  body{font:10pt 'Segoe UI',sans-serif;color:#111}
  .co-name{font-size:13pt;font-weight:700;text-align:center}
  .co-sub{text-align:center;font-size:8.5pt;color:#444;margin-bottom:5mm}
  table{width:100%;border-collapse:collapse} td{padding:1.8mm;border-bottom:1px solid #e2e8f0}
  .r{text-align:right}.big{font-size:12pt;font-weight:700}
  .sign{display:flex;justify-content:space-between;margin:14mm 2mm 0;font-size:8pt;color:#444}
  .sign span{border-top:1px solid #555;padding-top:1mm;min-width:26mm;text-align:center}
  .foot{margin-top:8mm;text-align:center;font-size:8pt;color:#666}
  ${extra || ''}`;
const head = (store, label) => {
  const s = store.settings;
  return `<div class="co-name">${esc(s.companyName || 'Property')}</div>
    <div class="co-sub" style="padding-top:${num(s.letterheadOffset)}mm">${esc(s.companyAddress || '')} ${s.companyPhone ? ' · ' + esc(s.companyPhone) : ''}</div>
    ${label ? `<div style="font-size:12pt;font-weight:700">${label}</div>` : ''}`;
};

const tenantLine = (store, t) => `${esc(t?.name || '')} · ${esc(unitLabel(store, tenantUnit(store, t)))}`;

export function billHtml(store, b) {
  const t = tenant(store, b.tenant_id) || {};
  const s = store.settings;
  return `<!doctype html><html><head><style>@page{size:A5;margin:12mm}${baseCss()}</style></head><body>
    ${head(store, `Rent bill — ${esc(monthName(b.month))} — کرایہ بل`)}
    <table>
      <tr><td>Bill #</td><td class="r">${b.no}</td><td>Due date</td><td class="r"><b>${esc(b.due_date)}</b></td></tr>
      <tr><td>Tenant</td><td class="r" colspan="3"><b>${tenantLine(store, t)}</b></td></tr>
      ${(b.lines || []).map(l => `<tr><td colspan="3">${esc(l.name)}</td><td class="r">${num(l.amount).toLocaleString()}</td></tr>`).join('')}
      ${num(b.arrears) ? `<tr><td colspan="3">Arrears / بقایا</td><td class="r">${num(b.arrears).toLocaleString()}</td></tr>` : ''}
      <tr><td colspan="3" class="big">Total / کل</td><td class="r big">${fmt(b.total, s.currency)}</td></tr>
      <tr><td colspan="3">Status</td><td class="r">${esc(b.status)}</td></tr>
    </table>
    <div class="sign"><span>Prepared by</span><span>Tenant signature</span></div>
    <div class="foot">${esc(s.receiptFooter || '')} · Rentory</div>
  </body></html>`;
}

export function receiptHtml(store, r) {
  const t = tenant(store, r.tenant_id) || {};
  const s = store.settings;
  return `<!doctype html><html><head><style>@page{size:A5;margin:12mm}${baseCss()}</style></head><body>
    ${head(store, `Payment receipt — وصولی رسید`)}
    <table>
      <tr><td>Receipt #</td><td class="r">${r.no}</td><td>Date</td><td class="r"><b>${esc(r.date)}</b></td></tr>
      <tr><td>Received from</td><td class="r" colspan="3"><b>${tenantLine(store, t)}</b></td></tr>
      <tr><td>Amount</td><td class="r big" colspan="3">${fmt(r.amount, s.currency)}</td></tr>
      <tr><td>Mode</td><td class="r">${esc(r.mode)}${r.ref ? ' · ' + esc(r.ref) : ''}</td><td>Bill</td><td class="r">${r.bill_id ? '#' + (store.bills.find(x => x.id === r.bill_id)?.no || '') : '—'}</td></tr>
      ${r.status === 'void' ? `<tr><td colspan="4" style="color:#b91c1c"><b>VOID</b> — ${esc(r.void_reason || '')} (${esc(r.voided_on || '')})</td></tr>` : ''}
    </table>
    <div class="sign"><span>Received by</span><span>Paid by</span></div>
    <div class="foot">${esc(s.receiptFooter || '')} · Rentory</div>
  </body></html>`;
}

export function statementHtml(store, tenantId) {
  const t = tenant(store, tenantId) || {};
  const s = store.settings;
  const bills = (store.bills || []).filter(b => b.tenant_id === tenantId && b.status !== 'void').sort((a, b) => a.month.localeCompare(b.month));
  const rows = bills.map(b => {
    const paid = billPaid(store, b), out = billOutstanding(store, b);
    return `<tr><td>${esc(monthName(b.month))}</td><td class="r">${num(b.total).toLocaleString()}</td>
      <td class="r">${paid.toLocaleString()}</td><td class="r">${out ? out.toLocaleString() : '—'}</td><td>${esc(b.status)}</td></tr>`;
  }).join('');
  const balance = bills.reduce((x, b) => x + billOutstanding(store, b), 0);
  const dep = (store.depositMoves || []).filter(m => m.tenant_id === tenantId)
    .reduce((x, m) => x + (m.kind === 'received' ? num(m.amount) : -num(m.amount)), 0);
  return `<!doctype html><html><head><style>@page{size:A5;margin:12mm}${baseCss(`
    td,th{border:1px solid #cbd5e1;padding:1.6mm;font-size:8.5pt;text-align:left}
    th{background:#0c1c33;color:#fff}`)}</style></head><body>
    ${head(store, `Tenant statement — کھاتہ`)}
    <table><tbody><tr><td><b>${tenantLine(store, t)}</b></td><td class="r">Phone: ${esc(t.phone || '')} · Since ${esc(t.moved_in || '')}</td></tr></tbody></table>
    <table><thead><tr><th>Month</th><th class="r">Billed</th><th class="r">Paid</th><th class="r">Outstanding</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
    <table><tbody>
      <tr><td>Outstanding rent</td><td class="r big">${fmt(balance, s.currency)}</td></tr>
      <tr><td>Security deposit held</td><td class="r">${fmt(dep, s.currency)}</td></tr>
    </tbody></table>
    <div class="sign"><span>Prepared by</span><span>Tenant</span></div>
    <div class="foot">Rentory</div>
  </body></html>`;
}

export function defaultersHtml(store, asOfMonth, rows) {
  return `<!doctype html><html><head><style>@page{size:A4;margin:12mm}${baseCss(`
    td,th{border:1px solid #cbd5e1;padding:1.8mm 2.4mm;font-size:9pt;text-align:left}
    th{background:#0c1c33;color:#fff}`)}</style></head><body>
    ${head(store, `Defaulters — outstanding up to ${esc(monthName(asOfMonth))}`)}
    <table><thead><tr><th>#</th><th>Tenant</th><th>Unit</th><th>Phone</th><th>Oldest unpaid</th><th class="r">Owes</th></tr></thead>
    <tbody>${rows.map((d, i) => {
      const u = tenantUnit(store, d.tenant);
      return `<tr><td>${i + 1}</td><td>${esc(d.tenant.name)}</td><td>${esc(unitLabel(store, u))}</td><td>${esc(d.tenant.phone || '')}</td><td>${esc(d.oldest)}</td><td class="r">${d.owes.toLocaleString()}</td></tr>`;
    }).join('')}
    <tr><td colspan="5"><b>Total</b></td><td class="r"><b>${rows.reduce((t, d) => t + d.owes, 0).toLocaleString()}</b></td></tr></tbody></table>
    <div class="foot">Rentory</div></body></html>`;
}

export function collectionHtml(store, month) {
  const s = store.settings;
  const receipts = (store.receipts || []).filter(r => ym(r.date) === month).sort((a, b) => a.date.localeCompare(b.date));
  const rows = receipts.map(r => {
    const t = tenant(store, r.tenant_id) || {};
    return `<tr${r.status === 'void' ? ' style="color:#b91c1c;text-decoration:line-through"' : ''}>
      <td>${esc(r.date)}</td><td>#${r.no}</td><td>${esc(t.name || '')}</td><td>${esc(unitLabel(store, tenantUnit(store, t)))}</td>
      <td>${esc(r.mode)}${r.ref ? ' · ' + esc(r.ref) : ''}</td><td class="r">${r.status === 'void' ? 'VOID' : num(r.amount).toLocaleString()}</td><td>${esc(r.by || '')}</td></tr>`;
  }).join('');
  const total = receipts.filter(r => r.status !== 'void').reduce((t, r) => t + num(r.amount), 0);
  return `<!doctype html><html><head><style>@page{size:A4 landscape;margin:12mm}${baseCss(`
    td,th{border:1px solid #cbd5e1;padding:1.6mm 2.4mm;font-size:9pt;text-align:left}
    th{background:#0c1c33;color:#fff}`)}</style></head><body>
    ${head(store, `Collection register — ${esc(monthName(month))}`)}
    <table><thead><tr><th>Date</th><th>Rcpt</th><th>Tenant</th><th>Unit</th><th>Mode</th><th class="r">Amount</th><th>By</th></tr></thead>
    <tbody>${rows}<tr><td colspan="5"><b>Total received</b></td><td class="r"><b>${total.toLocaleString()}</b></td><td></td></tr></tbody></table>
    <div class="foot">Rentory</div></body></html>`;
}

export function occupancyHtml(store) {
  const s = store.settings;
  const rows = (store.properties || []).map(p => {
    const us = (store.units || []).filter(u => u.property_id === p.id);
    const occ = us.filter(u => u.status === 'occupied');
    const rent = us.filter(u => u.status === 'occupied').reduce((t, u) => t + num(u.rent), 0);
    return `<tr><td><b>${esc(p.name)}</b><br><span style="font-size:8pt;color:#555">${esc(p.address || '')}</span></td>
      <td class="r">${us.length}</td><td class="r">${occ.length}</td><td class="r">${us.length - occ.length}</td>
      <td class="r">${us.length ? Math.round(occ.length / us.length * 100) : 0}%</td><td class="r">${rent.toLocaleString()}</td></tr>`;
  }).join('');
  return `<!doctype html><html><head><style>@page{size:A4;margin:12mm}${baseCss(`
    td,th{border:1px solid #cbd5e1;padding:2mm 2.6mm;font-size:9pt;text-align:left}
    th{background:#0c1c33;color:#fff}`)}</style></head><body>
    ${head(store, `Occupancy report — ${esc(new Date().toISOString().slice(0, 10))}`)}
    <table><thead><tr><th>Property</th><th class="r">Units</th><th class="r">Occupied</th><th class="r">Vacant</th><th class="r">Occupancy</th><th class="r">Monthly rent roll</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="foot">Rentory</div></body></html>`;
}
