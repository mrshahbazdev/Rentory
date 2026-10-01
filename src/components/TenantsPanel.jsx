import React, { useState } from 'react';
import { uid, fmt, num, tenant, unitLabel, tenantUnit, depositBalance, billsFor, billOutstanding, waLink, today } from '../lib/model.js';
import { statementHtml } from '../lib/prints.js';
import { parseTenantsCsv } from '../lib/csv.js';

export default function TenantsPanel({ store, update }) {
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(null); // tenant detail
  const [importRows, setImportRows] = useState(null);
  const [dep, setDep] = useState(null);   // deposit move form
  const cur = store.settings.currency;

  const vacantUnits = (store.units || []).filter(u => u.status === 'vacant' || u.id === edit?.unit_id);

  const save = () => update(s => {
    if (edit.id) {
      const t = s.tenants.find(x => x.id === edit.id);
      const oldUnit = t.unit_id;
      Object.assign(t, edit);
      if (oldUnit !== edit.unit_id) {
        const ou = s.units.find(x => x.id === oldUnit); if (ou) ou.status = 'vacant';
        const nu = s.units.find(x => x.id === edit.unit_id); if (nu) nu.status = 'occupied';
      }
    } else {
      const id = uid('t');
      s.tenants.push({ ...edit, id, status: 'active' });
      const nu = s.units.find(x => x.id === edit.unit_id); if (nu) nu.status = 'occupied';
      if (num(edit.deposit) > 0) s.depositMoves.push({ id: uid('dm'), tenant_id: id, date: edit.moved_in || today(), kind: 'received', amount: num(edit.deposit), note: 'Security deposit', receipt_no: 0 });
    }
  }, 'save tenant');

  const moveOut = (t) => {
    if (!confirm(`${t.name} ko move-out mark karein? Unit vacant ho jayegi.`)) return;
    update(s => {
      const x = s.tenants.find(z => z.id === t.id);
      x.status = 'left'; x.moved_out = today();
      const u = s.units.find(z => z.id === x.unit_id); if (u) u.status = 'vacant';
    }, 'tenant moved out');
  };

  const addDeposit = () => update(s => {
    s.depositMoves.push({ id: uid('dm'), tenant_id: dep.tenant_id, date: dep.date || today(), kind: dep.kind, amount: num(dep.amount), note: dep.note || '', receipt_no: 0 });
  }, `deposit ${dep.kind}`);

  const doImport = async () => {
    const f = await window.api.app.openFile({ filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }] });
    if (!f?.text) return;
    const { rows, errors } = parseTenantsCsv(f.text);
    setImportRows({ rows, errors });
  };
  const applyImport = () => update(s => {
    for (const r of importRows.rows) {
      const u = (s.units || []).find(x => String(x.code).toLowerCase() === String(r.unitCode).toLowerCase());
      const id = uid('t');
      s.tenants.push({ id, unit_id: u?.id || '', name: r.name, phone: r.phone, whatsapp: r.whatsapp, cnic: r.cnic || '', rent: num(r.rent) || num(u?.rent), deposit: num(r.deposit), advance: 0, moved_in: r.moved_in || today(), status: 'active', note: '', address: '' });
      if (u) u.status = 'occupied';
      if (num(r.deposit) > 0) s.depositMoves.push({ id: uid('dm'), tenant_id: id, date: r.moved_in || today(), kind: 'received', amount: num(r.deposit), note: 'Deposit (import)', receipt_no: 0 });
    }
  }, `import ${importRows.rows.length} tenants`);

  const detail = open ? tenant(store, open) : null;
  const remind = (t) => {
    const owes = billsFor(store, t.id).reduce((x, b) => x + billOutstanding(store, b), 0);
    const url = waLink(t.whatsapp || t.phone, `Assalam-o-alaikum ${t.name}, aap ka ${store.settings.companyName || ''} rent outstanding ${fmt(owes, cur)} hai. Barah-e-karam jald ada karein. Shukriya.`);
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="panel">
      <h2 className="ptitle">Tenants — کرایہ دار</h2>
      <div className="frow" style={{ marginBottom: 10 }}>
        <button className="btn small ghost" onClick={() => setEdit({ unit_id: vacantUnits[0]?.id || '', name: '', phone: '', whatsapp: '', cnic: '', rent: vacantUnits[0]?.rent || 0, deposit: 0, advance: 0, moved_in: today(), note: '', address: '', father: '' })}>+ New tenant</button>
        <button className="btn small ghost" onClick={doImport}>Import CSV/Excel</button>
      </div>
      <table className="grid">
        <thead><tr><th>Tenant</th><th>Unit</th><th>Phone</th><th className="r">Rent</th><th className="r">Deposit</th><th className="r">Owes</th><th></th></tr></thead>
        <tbody>
          {(store.tenants || []).map(t => {
            const u = tenantUnit(store, t);
            const owes = billsFor(store, t.id).reduce((x, b) => x + billOutstanding(store, b), 0);
            return (
              <tr key={t.id} className={t.status === 'left' ? 'muted' : ''}>
                <td><a href="#" onClick={e => { e.preventDefault(); setOpen(t.id); }}>{t.name}</a>{t.status === 'left' ? ' (left)' : ''}</td>
                <td>{unitLabel(store, u)}</td><td>{t.phone}</td>
                <td className="r">{fmt(t.rent, cur)}</td><td className="r">{fmt(depositBalance(store, t.id), cur)}</td>
                <td className="r" style={{ color: owes > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{owes ? fmt(owes, cur) : '✓'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {t.status === 'active' && <>
                    <button className="btn small ghost" onClick={() => remind(t)}>WhatsApp</button>
                    <button className="btn small ghost" onClick={() => setEdit({ ...t })}>Edit</button>
                    <button className="btn small ghost" onClick={() => moveOut(t)}>Move-out</button>
                  </>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {edit && (
        <div className="pcard" style={{ marginTop: 12 }}>
          <div className="frow">
            <select className="in" value={edit.unit_id} onChange={e => { const u = store.units.find(x => x.id === e.target.value); setEdit({ ...edit, unit_id: e.target.value, rent: edit.rent || u?.rent || 0 }); }}>
              <option value="">— unit —</option>
              {vacantUnits.map(u => <option key={u.id} value={u.id}>{unitLabel(store, u)}</option>)}
            </select>
            <input className="in" style={{ flex: 1 }} placeholder="Tenant name / business" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
            <input className="in" placeholder="Phone" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} />
            <input className="in" placeholder="WhatsApp" value={edit.whatsapp} onChange={e => setEdit({ ...edit, whatsapp: e.target.value })} />
          </div>
          <div className="frow" style={{ marginTop: 8 }}>
            <input className="in" placeholder="CNIC" value={edit.cnic} onChange={e => setEdit({ ...edit, cnic: e.target.value })} />
            <label className="lbl">Rent <input className="in" style={{ width: 110 }} type="number" value={edit.rent || ''} onChange={e => setEdit({ ...edit, rent: num(e.target.value) })} /></label>
            <label className="lbl">Deposit <input className="in" style={{ width: 110 }} type="number" value={edit.deposit || ''} onChange={e => setEdit({ ...edit, deposit: num(e.target.value) })} /></label>
            <label className="lbl">Moved in <input className="in" type="date" value={edit.moved_in || ''} onChange={e => setEdit({ ...edit, moved_in: e.target.value })} /></label>
          </div>
          <div className="frow" style={{ marginTop: 8 }}>
            <button className="btn small" onClick={() => { save(); setEdit(null); }}>Save</button>
            <button className="btn small ghost" onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </div>
      )}

      {importRows && (
        <div className="pcard" style={{ marginTop: 12 }}>
          <b>{importRows.rows.length} tenants</b> parse hue — apply karein?
          {importRows.errors.map((e, i) => <div key={i} style={{ color: '#b45309', fontSize: 12 }}>⚠ {e}</div>)}
          <div className="frow" style={{ marginTop: 8 }}>
            <button className="btn small" onClick={() => { applyImport(); setImportRows(null); }}>Apply import</button>
            <button className="btn small ghost" onClick={() => setImportRows(null)}>Cancel</button>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Columns: name, phone, whatsapp, unit, rent, deposit, moved_in, cnic</div>
        </div>
      )}

      {detail && (
        <div className="pcard" style={{ marginTop: 14 }}>
          <div className="frow" style={{ justifyContent: 'space-between' }}>
            <b>{detail.name} — khata</b>
            <span>
              <button className="btn small ghost" onClick={() => setDep({ tenant_id: detail.id, kind: 'received', amount: '', date: today(), note: '' })}>+ Deposit move</button>
              <button className="btn small ghost" onClick={() => window.api.export.pdf({ html: statementHtml(store, detail.id), suggestedName: `statement-${detail.name}.pdf` })}>Print statement</button>
              <button className="btn small ghost" onClick={() => setOpen(null)}>Close</button>
            </span>
          </div>
          <table className="grid" style={{ marginTop: 8 }}>
            <thead><tr><th>Month</th><th className="r">Billed</th><th className="r">Paid</th><th className="r">Outstanding</th><th>Status</th></tr></thead>
            <tbody>
              {billsFor(store, detail.id).map(b => (
                <tr key={b.id}><td>{b.month}</td><td className="r">{num(b.total).toLocaleString()}</td>
                  <td className="r">{num(b.total - billOutstanding(store, b)).toLocaleString()}</td>
                  <td className="r">{billOutstanding(store, b).toLocaleString()}</td><td>{b.status}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>Deposit balance: <b>{fmt(depositBalance(store, detail.id), cur)}</b>
            {' '}({(store.depositMoves || []).filter(m => m.tenant_id === detail.id).map(m => `${m.date} ${m.kind} ${num(m.amount).toLocaleString()}`).join(' · ') || 'none'})</div>
        </div>
      )}

      {dep && (
        <div className="pcard" style={{ marginTop: 10 }}>
          <div className="frow">
            <select className="in" value={dep.kind} onChange={e => setDep({ ...dep, kind: e.target.value })}>
              {['received', 'refund', 'forfeit', 'adjust'].map(k => <option key={k}>{k}</option>)}
            </select>
            <input className="in" type="date" value={dep.date} onChange={e => setDep({ ...dep, date: e.target.value })} />
            <input className="in" style={{ width: 130 }} type="number" placeholder="Amount" value={dep.amount} onChange={e => setDep({ ...dep, amount: e.target.value })} />
            <input className="in" style={{ flex: 1 }} placeholder="Note" value={dep.note} onChange={e => setDep({ ...dep, note: e.target.value })} />
            <button className="btn small" onClick={() => { addDeposit(); setDep(null); }}>Save</button>
            <button className="btn small ghost" onClick={() => setDep(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
