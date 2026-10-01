const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function csvText(rows) {
  return rows.map(r => r.map(q).join(',')).join('\n');
}

export function employeesCsv(store) {
  const rows = [['code', 'name', 'designation', 'department', 'cnic', 'phone', 'whatsapp', 'doj', 'basic', 'shift', 'status']];
  for (const e of store.employees || []) {
    const d = (store.departments || []).find(x => x.id === e.department_id);
    const sh = (store.shifts || []).find(x => x.id === e.shift_id);
    rows.push([e.code, e.name, e.designation || '', d?.name || '', e.cnic || '', e.phone || '', e.whatsapp || '', e.doj || '', e.basic || 0, sh?.name || '', e.status || 'active']);
  }
  return csvText(rows);
}

export function punchesCsvTemplate() {
  return csvText([['code', 'date', 'in', 'out'], ['E001', '2026-10-01', '09:05', '17:40'], ['E002', '2026-10-01', '09:12', '17:10']]);
}

function splitter(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return null;
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const split = l => {
    if (sep === '\t') return l.split('\t').map(x => x.trim());
    const out = []; let cur = '', inQ = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = !inQ;
      else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur); return out.map(x => x.trim());
  };
  return { lines, split };
}

// Punch import: code,date,in,out — date YYYY-MM-DD, times HH:MM. A row with no
// in/out marks absent. Re-importing a date replaces that date's imported rows.
export function parsePunchesCsv(store, text) {
  const p = splitter(text);
  if (!p) return { rows: [], errors: ['empty file'] };
  const head = p.split(p.lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const col = n => head.indexOf(n);
  const rows = [], errors = [];
  const timeOk = t => !t || /^\d{1,2}:\d{2}$/.test(t);
  p.lines.slice(1).forEach((l, i) => {
    const c = p.split(l);
    const get = n => col(n) >= 0 ? (c[col(n)] || '') : '';
    const e = empLookup(store, get('code') || get('emp') || get('id'));
    if (!e) { errors.push(`row ${i + 2}: unknown employee code "${get('code')}" — skipped`); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(get('date'))) { errors.push(`row ${i + 2}: bad date — skipped`); return; }
    if (!timeOk(get('in')) || !timeOk(get('out'))) { errors.push(`row ${i + 2}: bad time — skipped`); return; }
    rows.push({ employee_id: e.id, code: e.code, name: e.name, date: get('date'), in: get('in'), out: get('out') });
  });
  return { rows, errors };
}
function empLookup(store, code) {
  const c = String(code || '').trim().toLowerCase();
  return (store.employees || []).find(e => String(e.code || '').toLowerCase() === c) || null;
}

export function parseEmployeesCsv(text) {
  const p = splitter(text);
  if (!p) return { rows: [], errors: ['empty file'] };
  const head = p.split(p.lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const col = n => head.indexOf(n);
  const rows = [], errors = [];
  p.lines.slice(1).forEach((l, i) => {
    const c = p.split(l);
    const get = n => col(n) >= 0 ? (c[col(n)] || '') : '';
    if (!get('name')) { errors.push(`row ${i + 2}: name missing — skipped`); return; }
    rows.push({
      line: i + 2,
      code: get('code'), name: get('name'), designation: get('designation'),
      deptName: get('department'), cnic: get('cnic'), phone: get('phone'),
      whatsapp: get('whatsapp') || get('phone'), doj: get('doj'),
      basic: get('basic'), shiftName: get('shift'), address: get('address')
    });
  });
  return { rows, errors };
}
