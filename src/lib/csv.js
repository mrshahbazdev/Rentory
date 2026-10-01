const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function csvText(rows) {
  return rows.map(r => r.map(q).join(',')).join('\n');
}

export function tenantsCsv(store) {
  const rows = [['tenant', 'property', 'unit', 'phone', 'whatsapp', 'rent', 'deposit', 'moved_in', 'status', 'outstanding']];
  for (const t of store.tenants || []) {
    const u = (store.units || []).find(x => x.id === t.unit_id);
    const p = u && (store.properties || []).find(x => x.id === u.property_id);
    const owes = (store.bills || []).filter(b => b.tenant_id === t.id && b.status !== 'void')
      .reduce((x, b) => x + Math.max(0, (b.total || 0) - (store.receipts || []).filter(r => r.bill_id === b.id && r.status !== 'void').reduce((y, r) => y + (r.amount || 0), 0)), 0);
    rows.push([t.name, p?.name || '', u?.code || '', t.phone || '', t.whatsapp || '', t.rent || 0, t.deposit || 0, t.moved_in || '', t.status || 'active', owes]);
  }
  return csvText(rows);
}

export function parseTenantsCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { rows: [], errors: ['empty file'] };
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
  const head = split(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  const col = n => head.indexOf(n);
  const rows = [], errors = [];
  lines.slice(1).forEach((l, i) => {
    const c = split(l);
    const get = n => col(n) >= 0 ? (c[col(n)] || '') : '';
    if (!get('name') && !get('tenant')) { errors.push(`row ${i + 2}: name missing — skipped`); return; }
    rows.push({
      line: i + 2,
      name: get('name') || get('tenant'), phone: get('phone'), whatsapp: get('whatsapp') || get('phone'),
      unitCode: get('unit') || get('unit_code'), rent: get('rent'), deposit: get('deposit'),
      moved_in: get('moved_in') || get('since'), cnic: get('cnic')
    });
  });
  return { rows, errors };
}
