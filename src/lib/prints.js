// Print HTML: payslip, salary sheet, monthly attendance register, settlement memo.
import { fmt, num, today, emp, dept, slipTotals, ym } from './model.js';

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
  return `<div class="co-name">${esc(s.companyName || 'Company')}</div>
    <div class="co-sub" style="padding-top:${num(s.letterheadOffset)}mm">${esc(s.companyAddress || '')} ${s.companyPhone ? ' · ' + esc(s.companyPhone) : ''}</div>
    ${label ? `<div style="font-size:12pt;font-weight:700">${label}</div>` : ''}`;
};

export function payslipHtml(store, slip) {
  const e = emp(store, slip.employee_id) || {};
  const s = store.settings;
  const lines = slip.lines || [];
  const earn = lines.filter(l => l.type === 'earning').reduce((t, l) => t + num(l.amount), 0);
  const ded = lines.filter(l => l.type === 'deduction').reduce((t, l) => t + num(l.amount), 0);
  return `<!doctype html><html><head><style>@page{size:A5;margin:12mm}${baseCss()}</style></head><body>
    ${head(store, `Salary slip — ${esc(monthName(slip.month))} — تنخواہ کی سلپ`)}
    <table>
      <tr><td>Slip #</td><td class="r">${slip.no}</td></tr>
      <tr><td>Employee</td><td class="r"><b>${esc(e.name || '')}</b> (${esc(e.code || '')})</td></tr>
      <tr><td>Designation</td><td class="r">${esc(e.designation || '')} · ${esc(dept(store, e.department_id)?.name || '')}</td></tr>
      ${lines.map(l => `<tr><td>${esc(l.name)}</td><td class="r">${l.type === 'deduction' ? '−' : ''}${num(l.amount).toLocaleString()}</td></tr>`).join('')}
      <tr><td>Gross</td><td class="r">${earn.toLocaleString()}</td></tr>
      <tr><td>Deductions</td><td class="r">${ded.toLocaleString()}</td></tr>
      <tr><td class="big">Net payable</td><td class="r big">${fmt(earn - ded, s.currency)}</td></tr>
      <tr><td>Status</td><td class="r">${esc(slip.status)}${slip.paid_on ? ' · ' + esc(slip.paid_on) : ''}</td></tr>
    </table>
    <div class="sign"><span>Prepared by</span><span>Received by</span></div>
    <div class="foot">${esc(s.salaryFooter || '')} · Attendory</div>
  </body></html>`;
}

export function salarySheetHtml(store, slips, monthStr) {
  const s = store.settings;
  const rows = slips.map((p, i) => {
    const e = emp(store, p.employee_id) || {};
    return `<tr><td>${i + 1}</td><td>${esc(e.code)}</td><td>${esc(e.name)}</td><td>${esc(e.designation || '')}</td>
      <td class="r">${num(p.gross).toLocaleString()}</td><td class="r">${num(p.deduct).toLocaleString()}</td>
      <td class="r"><b>${num(p.net).toLocaleString()}</b></td><td>${esc(p.status)}${p.paid_on ? ' ' + esc(p.paid_on) : ''}</td><td></td></tr>`;
  }).join('');
  const tot = slips.reduce((a, p) => ({ g: a.g + num(p.gross), d: a.d + num(p.deduct), n: a.n + num(p.net) }), { g: 0, d: 0, n: 0 });
  return `<!doctype html><html><head><style>@page{size:A4 landscape;margin:12mm}${baseCss(`
    td,th{border:1px solid #cbd5e1;padding:1.6mm 2.4mm;font-size:9pt;text-align:left}
    th{background:#0c1c33;color:#fff}`)}</style></head><body>
    ${head(store, `Salary sheet — ${esc(monthName(monthStr))}`)}
    <table><thead><tr><th>#</th><th>Code</th><th>Name</th><th>Designation</th><th class="r">Gross</th><th class="r">Deductions</th><th class="r">Net</th><th>Status</th><th>Signature</th></tr></thead>
    <tbody>${rows}<tr><td colspan="4"><b>Total</b></td><td class="r"><b>${tot.g.toLocaleString()}</b></td><td class="r"><b>${tot.d.toLocaleString()}</b></td><td class="r"><b>${tot.n.toLocaleString()}</b></td><td colspan="2"></td></tr></tbody></table>
    <div class="foot">Attendory</div></body></html>`;
}

export function registerHtml(store, monthStr, rows) {
  const s = store.settings;
  const days = [...new Set((store.punches || []).filter(p => ym(p.date) === monthStr).map(p => p.date))].sort();
  const body = rows.map(e => {
    const cells = days.map(d => {
      const p = (store.punches || []).find(x => x.employee_id === e.id && x.date === d);
      return `<td>${p ? esc(p.status === 'P/2' ? '½' : p.status) : '·'}</td>`;
    }).join('');
    return `<tr><td>${esc(e.code)}</td><td style="text-align:left">${esc(e.name)}</td>${cells}</tr>`;
  }).join('');
  return `<!doctype html><html><head><style>@page{size:A4 landscape;margin:10mm}${baseCss(`
    td,th{border:1px solid #cbd5e1;padding:1mm 1.4mm;font-size:7.5pt;text-align:center}
    th{background:#0c1c33;color:#fff}`)}</style></head><body>
    ${head(store, `Attendance register — ${esc(monthName(monthStr))}`)}
    <table><thead><tr><th>Code</th><th style="text-align:left">Employee</th>${days.map(d => `<th>${d.slice(8)}</th>`).join('')}</tr></thead>
    <tbody>${body}</tbody></table>
    <div class="foot">P = present · A = absent · L = leave · H = holiday · ½ = half day · Attendory</div></body></html>`;
}

export function settlementHtml(store, stRow) {
  const e = emp(store, stRow.employee_id) || {};
  const s = store.settings;
  const { gross, deduct, net } = slipTotals(stRow.lines || []);
  return `<!doctype html><html><head><style>@page{size:A5;margin:12mm}${baseCss()}</style></head><body>
    ${head(store, `Final settlement — آخری حساب`)}
    <table>
      <tr><td>Memo #</td><td class="r">${stRow.no}</td></tr>
      <tr><td>Employee</td><td class="r"><b>${esc(e.name || '')}</b> (${esc(e.code || '')})</td></tr>
      <tr><td>Joined</td><td class="r">${esc(e.doj || '')}</td><td></td><td class="r">Left: ${esc(e.left_on || stRow.date)}</td></tr>
      ${(stRow.lines || []).map(l => `<tr><td>${esc(l.name)}</td><td class="r">${l.type === 'deduction' ? '−' : ''}${num(l.amount).toLocaleString()}</td></tr>`).join('')}
      <tr><td>Gross</td><td class="r">${gross.toLocaleString()}</td></tr>
      <tr><td>Deductions</td><td class="r">${deduct.toLocaleString()}</td></tr>
      <tr><td class="big">Net payable</td><td class="r big">${fmt(net, s.currency)}</td></tr>
    </table>
    ${stRow.note ? `<p style="font-size:9pt;color:#444">${esc(stRow.note)}</p>` : ''}
    <div class="sign"><span>Prepared by</span><span>Employee received</span></div>
    <div class="foot">Attendory</div>
  </body></html>`;
}
