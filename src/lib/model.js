// Attendory document model — HR office: employees, shifts, attendance punches,
// leaves, loans/advances khata, payroll runs, final settlement.
// Design rules:
// - punches are never deleted on import — re-importing a date replaces only
//   imported rows for that date.
// - payslips keep their computed lines — later edits to heads don't rewrite
//   history.
// - payslip and settlement numbers are gap-free, allocated at issue time.
// - loan money moves only through loanMoves (issue/emi/payment/waiver).

export const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 10);
export const fmt = (n, cur = 'Rs') => `${cur} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const day = iso => (iso || '').slice(0, 10);
export const today = () => new Date().toISOString().slice(0, 10);
export const ym = iso => (iso || '').slice(0, 7);
export const toMin = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const fromMin = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const dow = dateStr => new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun

export const ROLES = {
  hr: 'HR manager — full access',
  accountant: 'Accountant — payroll & loans, no leave approval',
  supervisor: 'Supervisor — attendance & leaves, no money',
  clerk: 'Clerk — employee records only'
};

export function emptyStore() {
  return {
    version: 1,
    departments: [],   // {id, name}
    employees: [],     // {id, code, name, designation, department_id, cnic, phone, whatsapp, address, doj, status:'active'|'left', left_on, basic, shift_id, bank, photo}
    shifts: [],        // {id, name, start, end, grace_min, off_days:[dow]}
    punches: [],       // {id, employee_id, date, in, out, status:'P'|'A'|'L'|'H'|'P/2', late_min, work_min, ot_min, source, marked_by}
    leaveTypes: [],    // {id, name, quota, paid}
    leaves: [],        // {id, employee_id, type_id, from, to, days, reason, status:'pending'|'approved'|'rejected', decided_by, decided_on}
    loans: [],         // {id, employee_id, kind:'loan'|'advance', principal, taken_on, emi, start_month, status:'open'|'settled'|'waived', note}
    loanMoves: [],     // {id, loan_id, date, kind:'issue'|'emi'|'payment'|'waiver'|'settlement', amount, payslip_id, by}
    salaryHeads: [],   // {id, name, type:'earning'|'deduction', amount}
    payslips: [],      // {id, no, employee_id, month, issued_on, lines:[{name,type,amount}], gross, deduct, net, status:'issued'|'paid'|'void', paid_on}
    settlements: [],   // {id, no, employee_id, date, lines, net, note}
    auditLog: [],
    settings: defaultSettings(),
    updatedAt: Date.now()
  };
}

export function defaultSettings() {
  return {
    companyName: '', companyAddress: '', companyPhone: '',
    currency: 'Rs',
    workingDays: 26,          // denominator for daily wage
    otMultiplier: 1.5,        // OT hour rate = hourly wage × this
    salaryFooter: 'Barah-e-karam salary slip tehwar ke tor par sambhalein.',
    letterheadOffset: 0,
    users: [],
    backupFolder: '', lastBackupAt: '',
    syncFolder: '', syncAuto: true, syncCode: '', hostOn: false,
    uiUrdu: false, printUrdu: true,
    firstRunDone: false, consent: null
  };
}

// ---------- lookups ----------
export function emp(store, id) { return (store.employees || []).find(e => e.id === id) || null; }
export function empByCode(store, code) {
  const c = String(code || '').trim().toLowerCase();
  return (store.employees || []).find(e => String(e.code || '').toLowerCase() === c) || null;
}
export function shift(store, id) { return (store.shifts || []).find(s => s.id === id) || null; }
export function empShift(store, e) { return (e && shift(store, e.shift_id)) || (store.shifts || [])[0] || null; }
export function dept(store, id) { return (store.departments || []).find(d => d.id === id) || null; }
export function activeEmployees(store) { return (store.employees || []).filter(e => e.status !== 'left'); }

// ---------- attendance ----------
export function isOffDay(store, e, dateStr) {
  const sh = empShift(store, e);
  return sh ? (sh.off_days || []).includes(dow(dateStr)) : dow(dateStr) === 0;
}
export function punchFor(store, empId, dateStr) {
  return (store.punches || []).find(p => p.employee_id === empId && p.date === dateStr) || null;
}
export function punchesOn(store, dateStr) { return (store.punches || []).filter(p => p.date === dateStr); }
export function punchesInMonth(store, empId, monthStr) {
  return (store.punches || []).filter(p => p.employee_id === empId && ym(p.date) === monthStr);
}

// Compute status + flags from in/out times against the employee's shift.
export function computePunch(store, e, dateStr, inT, outT) {
  const sh = empShift(store, e);
  let status = 'P', late_min = 0, work_min = 0, ot_min = 0;
  if (!inT && !outT) return { status: 'A', late_min: 0, work_min: 0, ot_min: 0 };
  if (inT && sh && sh.start) {
    const late = toMin(inT) - toMin(sh.start);
    if (late > num(sh.grace_min)) late_min = late;
  }
  if (inT && outT) work_min = Math.max(0, toMin(outT) - toMin(inT));
  else if (inT) { status = 'P/2'; } // forgot to punch out
  if (sh && sh.start && sh.end && work_min) {
    const shiftMin = Math.max(0, toMin(sh.end) - toMin(sh.start));
    if (work_min > shiftMin) ot_min = work_min - shiftMin;
  }
  return { status, late_min, work_min, ot_min };
}

export function setPunch(store, empId, dateStr, fields, by, source = 'manual') {
  store.punches = store.punches || [];
  let row = store.punches.find(p => p.employee_id === empId && p.date === dateStr);
  if (!row) { row = { id: uid('pu'), employee_id: empId, date: dateStr }; store.punches.push(row); }
  Object.assign(row, fields, { source, marked_by: by });
  return row;
}

export function attSummary(store, empId, monthStr) {
  let p = 0, a = 0, l = 0, h = 0, half = 0, ot = 0, late = 0;
  for (const r of punchesInMonth(store, empId, monthStr)) {
    if (r.status === 'P') p++;
    else if (r.status === 'A') a++;
    else if (r.status === 'L') l++;
    else if (r.status === 'H') h++;
    else if (r.status === 'P/2') half++;
    ot += num(r.ot_min); if (num(r.late_min) > 0) late++;
  }
  return { p, a, l, h, half, ot, late, marked: p + a + l + h + half };
}

// Approved leave covering a date → 'L'; applied when marking/importing.
export function leaveOn(store, empId, dateStr) {
  return (store.leaves || []).find(l =>
    l.employee_id === empId && l.status === 'approved' && l.from <= dateStr && l.to >= dateStr) || null;
}

// ---------- leaves ----------
export function leaveBalance(store, empId, typeId, yearStr) {
  const t = (store.leaveTypes || []).find(x => x.id === typeId);
  const quota = t ? num(t.quota) : 0;
  const used = (store.leaves || [])
    .filter(l => l.employee_id === empId && l.type_id === typeId && l.status === 'approved' && ym(l.from) <= (yearStr || today()).slice(0, 7) && String(ym(l.from)).startsWith(String(yearStr || today().slice(0, 4))))
    .reduce((s, l) => s + num(l.days), 0);
  return { quota, used, left: Math.max(0, quota - used) };
}
export function leaveDaysBetween(a, b) {
  return Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1);
}

// ---------- loans ----------
export function loanBalance(store, loanId) {
  const ln = (store.loans || []).find(l => l.id === loanId);
  if (!ln) return 0;
  const moves = (store.loanMoves || []).filter(m => m.loan_id === loanId);
  const issued = moves.filter(m => m.kind === 'issue').reduce((s, m) => s + num(m.amount), 0) || num(ln.principal);
  const repaid = moves.filter(m => m.kind !== 'issue').reduce((s, m) => s + num(m.amount), 0);
  return Math.max(0, issued - repaid);
}
export function loanDueThisMonth(store, loan, monthStr) {
  if (loan.status !== 'open' || !num(loan.emi) || (loan.start_month || monthStr) > monthStr) return 0;
  return Math.min(num(loan.emi), loanBalance(store, loan.id));
}
export function empLoans(store, empId) { return (store.loans || []).filter(l => l.employee_id === empId && l.status === 'open'); }

// ---------- payroll ----------
export function dailyWage(store, e) {
  const days = num(store.settings.workingDays) || 26;
  return num(e.basic) / days;
}
export function hourlyWage(store, e) {
  const sh = empShift(store, e);
  const shiftMin = sh && sh.start && sh.end ? Math.max(1, toMin(sh.end) - toMin(sh.start)) : 480;
  return dailyWage(store, e) / (shiftMin / 60);
}

// The computed slip lines for an employee + month (without writing anything).
export function payrollLines(store, e, monthStr) {
  const lines = [{ name: 'Basic salary', type: 'earning', amount: num(e.basic) }];
  for (const h of (store.salaryHeads || [])) {
    if (num(h.amount)) lines.push({ name: h.name, type: h.type, amount: num(h.amount) });
  }
  const sum = attSummary(store, e.id, monthStr);
  if (sum.ot) {
    const otPay = Math.round(hourlyWage(store, e) * (sum.ot / 60) * (num(store.settings.otMultiplier) || 1));
    if (otPay > 0) lines.push({ name: `Overtime (${Math.round(sum.ot / 60 * 10) / 10}h)`, type: 'earning', amount: otPay });
  }
  if (sum.a) lines.push({ name: `Absent days (${sum.a})`, type: 'deduction', amount: Math.round(dailyWage(store, e) * sum.a) });
  if (sum.half) lines.push({ name: `Half days / missed punch (${sum.half})`, type: 'deduction', amount: Math.round(dailyWage(store, e) * sum.half * 0.5) });
  const unpaidLv = (store.leaves || []).filter(l =>
    l.employee_id === e.id && l.status === 'approved' && ym(l.from) <= monthStr && ym(l.to) >= monthStr &&
    ((store.leaveTypes || []).find(t => t.id === l.type_id) || {}).paid === false);
  for (const l of unpaidLv) {
    const d1 = ym(l.from) === monthStr ? l.from : monthStr + '-01';
    const d2 = ym(l.to) === monthStr ? l.to : monthStr + '-31';
    const d = Math.min(num(l.days), leaveDaysBetween(d1, d2));
    if (d > 0) lines.push({ name: `Unpaid leave (${d}d)`, type: 'deduction', amount: Math.round(dailyWage(store, e) * d) });
  }
  for (const ln of empLoans(store, e.id)) {
    const due = loanDueThisMonth(store, ln, monthStr);
    if (due > 0) lines.push({ name: `${ln.kind === 'advance' ? 'Advance' : 'Loan'} installment`, type: 'deduction', amount: due, loan_id: ln.id });
  }
  return lines;
}
export function slipTotals(lines) {
  const gross = lines.filter(l => l.type === 'earning').reduce((t, l) => t + num(l.amount), 0);
  const deduct = lines.filter(l => l.type === 'deduction').reduce((t, l) => t + num(l.amount), 0);
  return { gross, deduct, net: Math.max(0, gross - deduct) };
}
export function payslipFor(store, empId, monthStr) {
  return (store.payslips || []).find(p => p.employee_id === empId && p.month === monthStr && p.status !== 'void') || null;
}
export function nextSlipNo(store) { return (store.payslips || []).reduce((m, p) => Math.max(m, num(p.no)), 0) + 1; }
export function nextSettleNo(store) { return (store.settlements || []).reduce((m, p) => Math.max(m, num(p.no)), 0) + 1; }

// Run payroll for a month: creates slips (skips issued) and records EMI moves.
export function runPayroll(store, monthStr, by) {
  const made = [];
  for (const e of activeEmployees(store)) {
    if (payslipFor(store, e.id, monthStr)) continue;
    const lines = payrollLines(store, e, monthStr);
    const { gross, deduct, net } = slipTotals(lines);
    const slip = { id: uid('ps'), no: nextSlipNo(store), employee_id: e.id, month: monthStr, issued_on: today(), lines, gross, deduct, net, status: 'issued', paid_on: '', paid_by: '' };
    store.payslips = store.payslips || [];
    store.payslips.push(slip);
    store.loanMoves = store.loanMoves || [];
    for (const l of lines) {
      if (l.loan_id) store.loanMoves.push({ id: uid('lm'), loan_id: l.loan_id, date: today(), kind: 'emi', amount: l.amount, payslip_id: slip.id, by });
    }
    made.push(slip);
  }
  return made;
}

// Final settlement for an employee leaving: unpaid days this month + loan balance.
export function settlementLines(store, e) {
  const lines = [];
  const daysWorked = punchesInMonth(store, e.id, today().slice(0, 7))
    .filter(p => p.status === 'P' || p.status === 'P/2').length;
  const paidThisMonth = (store.payslips || []).some(p => p.employee_id === e.id && p.month === today().slice(0, 7) && p.status === 'paid');
  if (!paidThisMonth && daysWorked) lines.push({ name: `Wages — ${daysWorked} days worked (${today().slice(0, 7)})`, type: 'earning', amount: Math.round(dailyWage(store, e) * daysWorked) });
  for (const ln of empLoans(store, e.id)) {
    const bal = loanBalance(store, ln.id);
    if (bal > 0) lines.push({ name: `${ln.kind === 'advance' ? 'Advance' : 'Loan'} balance`, type: 'deduction', amount: bal });
  }
  return lines;
}

// ---------- sample data: fictional company, fully populated on first launch ----------
export function sampleStore() {
  const st = emptyStore();
  const deptSales = { id: uid('dp'), name: 'Sales' };
  const deptOps = { id: uid('dp'), name: 'Operations' };
  const deptOffice = { id: uid('dp'), name: 'Office' };
  st.departments = [deptSales, deptOps, deptOffice];

  const shDay = { id: uid('sh'), name: 'Day shift', start: '09:00', end: '17:00', grace_min: 10, off_days: [0] };
  const shEve = { id: uid('sh'), name: 'Evening shift', start: '14:00', end: '22:00', grace_min: 10, off_days: [0] };
  st.shifts = [shDay, shEve];

  st.leaveTypes = [
    { id: uid('lt'), name: 'Annual leave', quota: 14, paid: true },
    { id: uid('lt'), name: 'Sick leave', quota: 10, paid: true },
    { id: uid('lt'), name: 'Casual leave', quota: 10, paid: true },
    { id: uid('lt'), name: 'Unpaid leave', quota: 0, paid: false },
  ];
  const LT = n => st.leaveTypes.find(t => t.name.startsWith(n)).id;

  st.salaryHeads = [
    { id: uid('hd'), name: 'House rent', type: 'earning', amount: 5000 },
    { id: uid('hd'), name: 'Conveyance', type: 'earning', amount: 2000 },
    { id: uid('hd'), name: 'EOBI / social', type: 'deduction', amount: 400 },
  ];

  const emps = [
    ['E001', 'Imran Baig', 'Store manager', deptOps.id, '35202-1111111-1', '0301-1111111', 65000, shDay.id],
    ['E002', 'Sana Riaz', 'Sales executive', deptSales.id, '35202-2222222-2', '0302-2222222', 48000, shDay.id],
    ['E003', 'Waqas Ali', 'Technician', deptOps.id, '35202-3333333-3', '0303-3333333', 42000, shEve.id],
    ['E004', 'Hira Shah', 'Accounts assistant', deptOffice.id, '35202-4444444-4', '0304-4444444', 40000, shDay.id],
    ['E005', 'Danish Mirza', 'Driver', deptOps.id, '35202-5555555-5', '0305-5555555', 35000, shEve.id],
    ['E006', 'Rabia Noor', 'Receptionist', deptOffice.id, '35202-6666666-6', '0306-6666666', 32000, shDay.id],
  ];
  st.employees = emps.map(([code, name, designation, department_id, cnic, phone, basic, shift_id], i) => ({
    id: uid('em'), code, name, designation, department_id, cnic, phone, whatsapp: phone,
    address: '', doj: `2024-0${(i % 9) + 1}-1${i}`, status: 'active', basic, shift_id, bank: ''
  }));
  const E = c => st.employees.find(e => e.code === c);

  // Attendance for this month (up to today) + last month full-ish.
  const now = today();
  const thisM = ym(now);
  const lastD = new Date(now + 'T00:00:00'); lastD.setMonth(lastD.getMonth() - 1);
  const lastM = ym(lastD.toISOString());
  const seedPunch = (e, d, inT, outT) => {
    const c = computePunch(st, e, d, inT, outT);
    st.punches.push({ id: uid('pu'), employee_id: e.id, date: d, in: inT, out: outT, ...c, source: 'import', marked_by: 'sample' });
  };
  for (const e of st.employees) {
    for (let mth of [lastM, thisM]) {
      const maxDay = mth === thisM ? Number(now.slice(8, 10)) : new Date(Number(mth.slice(0, 4)), Number(mth.slice(5, 7)), 0).getDate();
      for (let dd = 1; dd <= maxDay; dd++) {
        const d = `${mth}-${String(dd).padStart(2, '0')}`;
        if (isOffDay(st, e, d)) continue;
        const sh = empShift(st, e);
        const r = (dd + Number(e.code.slice(1))) % 10;
        if (r === 9) { seedPunch(e, d, '', ''); continue; }               // an absent day
        const inMin = toMin(sh.start) + (r === 7 ? 18 : r === 8 ? 5 : 0); // occasional late
        const outMin = toMin(sh.end) + (r <= 3 ? 45 : 0);                 // occasional OT
        seedPunch(e, d, fromMin(inMin), fromMin(outMin));
      }
    }
  }

  // One approved leave (sick) + one pending request + one unpaid leave.
  const e3 = E('E003');
  st.leaves.push({ id: uid('lv'), employee_id: e3.id, type_id: LT('Sick'), from: `${thisM}-05`, to: `${thisM}-06`, days: 2, reason: 'Fever', status: 'approved', decided_by: 'sample', decided_on: today() });
  st.leaves.push({ id: uid('lv'), employee_id: E('E002').id, type_id: LT('Casual'), from: now, to: now, days: 1, reason: 'Family work', status: 'pending' });
  st.leaves.push({ id: uid('lv'), employee_id: E('E005').id, type_id: LT('Unpaid'), from: `${lastM}-20`, to: `${lastM}-21`, days: 2, reason: 'Travel', status: 'approved', decided_by: 'sample', decided_on: lastM + '-19' });
  for (const l of st.leaves.filter(l => l.status === 'approved')) {
    for (let d = l.from; d <= l.to; d = new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10)) {
      const row = st.punches.find(p => p.employee_id === l.employee_id && p.date === d);
      if (row) { row.status = 'L'; row.late_min = 0; row.ot_min = 0; }
      else st.punches.push({ id: uid('pu'), employee_id: l.employee_id, date: d, in: '', out: '', status: 'L', late_min: 0, work_min: 0, ot_min: 0, source: 'leave', marked_by: 'sample' });
    }
  }

  // A loan with EMI + one advance repaid manually.
  const ln = { id: uid('ln'), employee_id: E('E002').id, kind: 'loan', principal: 60000, taken_on: lastM + '-05', emi: 10000, start_month: thisM, status: 'open', note: 'Personal loan' };
  st.loans.push(ln);
  st.loanMoves.push({ id: uid('lm'), loan_id: ln.id, date: ln.taken_on, kind: 'issue', amount: 60000, by: 'sample' });
  st.loanMoves.push({ id: uid('lm'), loan_id: ln.id, date: lastM + '-28', kind: 'payment', amount: 10000, by: 'sample' });
  st.loans.push({ id: uid('ln'), employee_id: E('E004').id, kind: 'advance', principal: 15000, taken_on: thisM + '-03', emi: 5000, start_month: thisM, status: 'open', note: 'Salary advance' });
  st.loanMoves.push({ id: uid('lm'), loan_id: st.loans[1].id, date: thisM + '-03', kind: 'issue', amount: 15000, by: 'sample' });

  // Last month's payroll already run + paid.
  runPayroll(st, lastM, 'sample');
  for (const p of st.payslips) { p.status = 'paid'; p.paid_on = lastM + '-30'; p.paid_by = 'sample'; }

  st.settings.companyName = 'Al-Falah Traders';
  st.settings.companyAddress = 'Plot 22, Industrial Area, Lahore';
  st.settings.companyPhone = '042-35201234';
  return st;
}
