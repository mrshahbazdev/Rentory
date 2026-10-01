// Rentory document model — rent/property register: properties → units → tenants,
// monthly rent bills, payment receipts, deposit khata, meters, expenses.
// Design rules:
// - bill numbers are gap-free, allocated at generation time (per month).
// - receipt numbers are gap-free; a voided receipt keeps its row (never deleted).
// - a paid bill is never rewritten — arrears roll into the NEXT bill.
// - tenant balances live only in receipts/bills/deposit moves; no cached totals
//   are ever trusted as truth — always recompute.

export const uid = (p = 'x') => p + Math.random().toString(36).slice(2, 10);
export const fmt = (n, cur = 'Rs') => `${cur} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const today = () => new Date().toISOString().slice(0, 10);
export const ym = iso => (iso || '').slice(0, 7);
export const addMonths = (m, k) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export const ROLES = {
  owner: 'Owner — full access',
  manager: 'Manager — bills, receipts & meters, no user management',
  collector: 'Collector — receive payments & mark meters only',
  clerk: 'Clerk — units & tenant records only'
};

export function emptyStore() {
  return {
    version: 1,
    properties: [],   // {id, name, address}
    units: [],        // {id, property_id, code, kind:'shop'|'flat'|'house'|'room'|'plot'|'other', floor, size, rent, status:'vacant'|'occupied', metered:bool}
    tenants: [],      // {id, unit_id, name, father, cnic, phone, whatsapp, address, rent, deposit, advance, moved_in, moved_out, status:'active'|'left', note}
    bills: [],        // {id, no, tenant_id, month, issued_on, lines:[{name,amount}], arrears, total, due_date, status:'unpaid'|'partial'|'paid'|'void', void_reason}
    receipts: [],     // {id, no, tenant_id, bill_id|null, date, amount, mode:'cash'|'bank'|'online'|'cheque', ref, status:'received'|'void', void_reason, voided_on, by}
    depositMoves: [], // {id, tenant_id, date, kind:'received'|'refund'|'forfeit'|'adjust', amount, note, receipt_no}
    meters: [],       // {id, unit_id, tenant_id, month, prev, curr, units, rate, amount, status:'open'|'billed'}
    expenses: [],     // {id, date, property_id, head, amount, note, by}
    auditLog: [],
    settings: defaultSettings(),
    counters: { bill: 0, receipt: 0 },
    updatedAt: Date.now()
  };
}

export function defaultSettings() {
  return {
    companyName: '', companyAddress: '', companyPhone: '',
    currency: 'Rs',
    dueDay: 10,             // bills due by this day of month
    lateFee: 0,             // flat late fee added to next bill when unpaid past due
    receiptFooter: 'Barah-e-karam receipt sambhal kar rakhein.',
    letterheadOffset: 0,
    users: [],
    backupFolder: '', lastBackupAt: '',
    syncFolder: '', syncAuto: true, syncCode: '', hostOn: false,
    uiUrdu: false, printUrdu: true,
    firstRunDone: false, consent: null
  };
}

// ---------- lookups ----------
export const prop = (s, id) => (s.properties || []).find(p => p.id === id) || null;
export const unit = (s, id) => (s.units || []).find(u => u.id === id) || null;
export const tenant = (s, id) => (s.tenants || []).find(t => t.id === id) || null;
export const bill = (s, id) => (s.bills || []).find(b => b.id === id) || null;
export const activeTenants = s => (s.tenants || []).filter(t => t.status === 'active');
export const tenantUnit = (s, t) => (t && unit(s, t.unit_id)) || null;
export const unitLabel = (s, u) => u ? `${prop(s, u.property_id)?.name || ''} — ${u.code}` : '';
export const tenantLabel = (s, t) => t ? `${t.name} (${unitLabel(s, tenantUnit(s, t))})` : '';

// ---------- money flows ----------
export function receiptsFor(s, tenantId) { return (s.receipts || []).filter(r => r.tenant_id === tenantId && r.status !== 'void'); }
export function billsFor(s, tenantId) { return (s.bills || []).filter(b => b.tenant_id === tenantId && b.status !== 'void'); }

export function billPaid(s, b) {
  return receiptsFor(s, b.tenant_id).filter(r => r.bill_id === b.id).reduce((t, r) => t + num(r.amount), 0);
}
export function billOutstanding(s, b) {
  if (b.status === 'void') return 0;
  return Math.max(0, num(b.total) - billPaid(s, b));
}
export function refreshBillStatus(b, paid) {
  if (b.status === 'void') return b;
  b.status = paid <= 0 ? 'unpaid' : paid >= num(b.total) ? 'paid' : 'partial';
  return b;
}

// arrears carried into a new bill = outstanding on all previous bills
export function tenantArrears(s, tenantId, beforeMonth) {
  return billsFor(s, tenantId)
    .filter(b => b.month < beforeMonth)
    .reduce((t, b) => t + billOutstanding(s, b), 0);
}

// unallocated credit: receipts not tied to a bill, minus nothing — shown as balance
export function tenantBalance(s, tenantId) {
  const billed = billsFor(s, tenantId).reduce((t, b) => t + num(b.total), 0);
  const received = receiptsFor(s, tenantId).reduce((t, r) => t + num(r.amount), 0);
  return received - billed; // negative = owes
}

export function depositBalance(s, tenantId) {
  return (s.depositMoves || []).filter(m => m.tenant_id === tenantId)
    .reduce((t, m) => t + (m.kind === 'received' ? num(m.amount) : -num(m.amount)), 0);
}

// ---------- month-end: generate bills ----------
export function generateMonthBills(store, month, opts = {}) {
  const made = [], skipped = [];
  for (const t of activeTenants(store)) {
    if ((store.bills || []).some(b => b.tenant_id === t.id && b.month === month && b.status !== 'void')) {
      skipped.push(t.name); continue;
    }
    const u = tenantUnit(store, t);
    const arrears = tenantArrears(store, t.id, month);
    const lines = [{ name: `Rent ${month}`, amount: num(t.rent ?? u?.rent) }];
    // meter bill for this month if open reading exists
    const m = (store.meters || []).find(x => x.tenant_id === t.id && x.month === month && x.status === 'open');
    if (m && num(m.amount) > 0) { lines.push({ name: `Electricity ${m.units} units`, amount: num(m.amount) }); m.status = 'billed'; }
    if (arrears > 0 && num(store.settings.lateFee) > 0) lines.push({ name: 'Late fee', amount: num(store.settings.lateFee) });
    const total = lines.reduce((x, l) => x + num(l.amount), 0) + arrears;
    store.counters.bill = (store.counters.bill || 0) + 1;
    const b = {
      id: uid('b'), no: store.counters.bill, tenant_id: t.id, month,
      issued_on: today(), lines, arrears, total,
      due_date: `${month}-${String(store.settings.dueDay || 10).padStart(2, '0')}`,
      status: 'unpaid'
    };
    store.bills.push(b); made.push(b);
  }
  return { made, skipped };
}

// receive a payment: allocate to a bill if given; returns receipt
export function receivePayment(store, { tenant_id, bill_id, amount, mode, ref, date }, by) {
  store.counters.receipt = (store.counters.receipt || 0) + 1;
  const r = {
    id: uid('r'), no: store.counters.receipt, tenant_id, bill_id: bill_id || null,
    date: date || today(), amount: num(amount), mode: mode || 'cash', ref: ref || '',
    status: 'received', by: by || ''
  };
  store.receipts.push(r);
  if (bill_id) { const b = bill(store, bill_id); if (b) refreshBillStatus(b, billPaid(store, b)); }
  return r;
}

export function voidReceipt(store, receiptId, reason) {
  const r = (store.receipts || []).find(x => x.id === receiptId);
  if (!r || r.status === 'void') return null;
  r.status = 'void'; r.void_reason = reason || ''; r.voided_on = today();
  if (r.bill_id) { const b = bill(store, r.bill_id); if (b) refreshBillStatus(b, billPaid(store, b)); }
  return r;
}

export function voidBill(store, billId, reason) {
  const b = bill(store, billId);
  if (!b || b.status === 'void' || billPaid(store, b) > 0) return null;
  b.status = 'void'; b.void_reason = reason || '';
  return b;
}

// ---------- meters ----------
export function lastMeterReading(store, unitId, beforeMonth) {
  const ms = (store.meters || []).filter(m => m.unit_id === unitId && m.month < beforeMonth).sort((a, b) => b.month.localeCompare(a.month));
  return ms[0] ? num(ms[0].curr) : 0;
}

// ---------- reports ----------
export function monthSummary(store, month) {
  const bills = (store.bills || []).filter(b => b.month === month && b.status !== 'void');
  const receipts = (store.receipts || []).filter(r => ym(r.date) === month && r.status !== 'void');
  const expenses = (store.expenses || []).filter(e => ym(e.date) === month);
  return {
    billed: bills.reduce((t, b) => t + num(b.total), 0),
    collected: receipts.reduce((t, r) => t + num(r.amount), 0),
    expenses: expenses.reduce((t, e) => t + num(e.amount), 0),
    billCount: bills.length
  };
}

export function defaulters(store, asOfMonth) {
  const out = [];
  for (const t of activeTenants(store)) {
    const owes = billsFor(store, t.id).filter(b => b.month <= asOfMonth).reduce((x, b) => x + billOutstanding(store, b), 0);
    if (owes > 0) out.push({ tenant: t, owes, oldest: billsFor(store, t.id).find(b => billOutstanding(store, b) > 0)?.month || '' });
  }
  return out.sort((a, b) => b.owes - a.owes);
}

export function waLink(phone, text) {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  const intl = d.startsWith('92') ? d : d.startsWith('0') ? '92' + d.slice(1) : d;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

// ---------- sample data ----------
export function sampleStore() {
  const s = emptyStore();
  s.settings.companyName = 'Al-Falah Properties';
  s.settings.companyAddress = 'Main Bazaar, Gujranwala';
  s.settings.companyPhone = '055-5550100';
  const p1 = { id: 'p1', name: 'Falah Plaza', address: 'Shop line, Main Bazaar' };
  const p2 = { id: 'p2', name: 'Rehman House', address: 'Street 4, Model Town' };
  s.properties = [p1, p2];
  const u = (id, pid, code, kind, rent, metered) => ({ id, property_id: pid, code, kind, floor: 'ground', size: '', rent, metered: !!metered, status: 'occupied' });
  s.units = [
    u('u1', 'p1', 'Shop 1', 'shop', 25000, true), u('u2', 'p1', 'Shop 2', 'shop', 25000, true),
    u('u3', 'p1', 'Office 3', 'room', 15000, false),
    { ...u('u4', 'p2', 'Ground floor', 'house', 40000, true), status: 'vacant' },
    u('u5', 'p2', 'First floor', 'house', 35000, true)
  ];
  const t = (id, uid_, name, phone, rent, dep, moved) => ({ id, unit_id: uid_, name, father: '', cnic: '', phone, whatsapp: phone, address: '', rent, deposit: dep, advance: 0, moved_in: moved, status: 'active', note: '' });
  s.tenants = [
    t('t1', 'u1', 'Riaz Ahmed — General Store', '0300-1112233', 25000, 50000, '2025-06-01'),
    t('t2', 'u2', 'Khan Mobile Zone', '0321-5556677', 25000, 50000, '2025-09-01'),
    t('t3', 'u3', 'Adv. Shahid (office)', '0333-8889900', 15000, 30000, '2026-01-15'),
    t('t5', 'u5', 'Bilal Family', '0345-7778889', 35000, 70000, '2025-11-01')
  ];
  s.depositMoves = s.tenants.map((x, i) => ({ id: 'dm' + i, tenant_id: x.id, date: x.moved_in, kind: 'received', amount: x.deposit, note: 'Security deposit', receipt_no: i + 1 }));
  const m0 = addMonths(today().slice(0, 7), -1);
  const m1 = today().slice(0, 7);
  // last month: bills all paid except t2 owes 10k
  const mkBill = (ten, month, no, rent, arrears, status) => {
    const b = { id: uid('b'), no, tenant_id: ten, month, issued_on: month + '-01', lines: [{ name: `Rent ${month}`, amount: rent }], arrears, total: rent + arrears, due_date: month + '-10', status };
    s.bills.push(b); return b;
  };
  let n = 0;
  const b1 = mkBill('t1', m0, ++n, 25000, 0, 'paid');
  const b2 = mkBill('t2', m0, ++n, 25000, 0, 'partial');
  const b3 = mkBill('t3', m0, ++n, 15000, 0, 'paid');
  const b5 = mkBill('t5', m0, ++n, 35000, 0, 'paid');
  s.counters.bill = n;
  const rc = (ten, bill_, amt, date, mode) => { s.counters.receipt++; s.receipts.push({ id: uid('r'), no: s.counters.receipt, tenant_id: ten, bill_id: bill_, date, amount: amt, mode: mode || 'cash', ref: '', status: 'received', by: 'owner' }); };
  rc('t1', b1.id, 25000, m0 + '-05'); rc('t2', b2.id, 15000, m0 + '-07');
  rc('t3', b3.id, 15000, m0 + '-03', 'bank'); rc('t5', b5.id, 35000, m0 + '-04');
  // this month bills generated for all
  mkBill('t1', m1, ++n, 25000, 0, 'paid'); rc('t1', s.bills[s.bills.length - 1].id, 25000, m1 + '-04');
  mkBill('t2', m1, ++n, 25000, 10000, 'unpaid');   // arrears carried
  mkBill('t3', m1, ++n, 15000, 0, 'unpaid');
  mkBill('t5', m1, ++n, 35000, 0, 'unpaid');
  s.counters.bill = n;
  s.meters = [
    { id: uid('m'), unit_id: 'u1', tenant_id: 't1', month: m1, prev: 1200, curr: 1345, units: 145, rate: 32, amount: 4640, status: 'open' },
    { id: uid('m'), unit_id: 'u5', tenant_id: 't5', month: m1, prev: 3410, curr: 3570, units: 160, rate: 32, amount: 5120, status: 'open' }
  ];
  s.expenses = [{ id: uid('e'), date: m0 + '-12', property_id: 'p1', head: 'Repair — plumbing', amount: 4500, note: '', by: 'owner' }];
  s.settings.firstRunDone = false;
  return s;
}
