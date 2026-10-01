import { useState } from 'react';
import { uid, num, fmt, today, dept, shift, loanBalance, empLoans } from '../lib/model.js';
import { parseEmployeesCsv } from '../lib/csv.js';

export default function EmployeesPanel({ store, update }) {
  const [f, setF] = useState({ code: '', name: '', designation: '', department_id: '', cnic: '', phone: '', basic: '', shift_id: '' });
  const [edit, setEdit] = useState(null);
  const [imp, setImp] = useState(null);
  const cur = store.settings.currency || 'Rs';
  const emps = store.employees || [];

  const saveEmp = () => {
    if (!f.name.trim()) return;
    update(s => {
      if (edit) {
        const e = s.employees.find(x => x.id === edit);
        Object.assign(e, { code: f.code.trim(), name: f.name.trim(), designation: f.designation.trim(), department_id: f.department_id, cnic: f.cnic.trim(), phone: f.phone.trim(), whatsapp: f.phone.trim(), basic: num(f.basic), shift_id: f.shift_id });
      } else {
        s.employees.push({ id: uid('em'), code: f.code.trim() || `E${String(s.employees.length + 1).padStart(3, '0')}`, name: f.name.trim(), designation: f.designation.trim(), department_id: f.department_id, cnic: f.cnic.trim(), phone: f.phone.trim(), whatsapp: f.phone.trim(), address: '', doj: today(), status: 'active', basic: num(f.basic), shift_id: f.shift_id, bank: '' });
      }
    }, edit ? 'edit employee' : 'add employee');
    setF({ code: '', name: '', designation: '', department_id: '', cnic: '', phone: '', basic: '', shift_id: '' }); setEdit(null);
  };
  const startEdit = e => { setEdit(e.id); setF({ code: e.code, name: e.name, designation: e.designation || '', department_id: e.department_id || '', cnic: e.cnic || '', phone: e.phone || '', basic: e.basic || '', shift_id: e.shift_id || '' }); };

  const doImport = async () => {
    const file = await window.api.app.openFile({ filters: [{ name: 'CSV', extensions: ['csv', 'txt', 'tsv'] }] });
    if (!file?.text) return;
    setImp(parseEmployeesCsv(file.text));
  };
  const applyImport = () => {
    update(s => {
      for (const r of imp.rows) {
        let d = (s.departments || []).find(x => x.name.toLowerCase() === (r.deptName || '').toLowerCase());
        if (r.deptName && !d) { d = { id: uid('dp'), name: r.deptName }; s.departments.push(d); }
        let sh = (s.shifts || []).find(x => x.name.toLowerCase() === (r.shiftName || '').toLowerCase());
        const ex = r.code && s.employees.find(x => String(x.code).toLowerCase() === r.code.toLowerCase());
        const row = { code: r.code || `E${String(s.employees.length + 1).padStart(3, '0')}`, name: r.name, designation: r.designation || '', department_id: d?.id || '', cnic: r.cnic || '', phone: r.phone || '', whatsapp: r.whatsapp || '', address: r.address || '', doj: r.doj || today(), status: 'active', basic: num(r.basic), shift_id: sh ? sh.id : (s.shifts[0] || {}).id || '', bank: '' };
        if (ex) Object.assign(ex, row);
        else s.employees.push({ id: uid('em'), ...row });
      }
    }, 'import employees');
    setImp(null);
  };

  return (
    <div className="panel" style={{ maxWidth: 1150 }}>
      <div className="toolbar">
        <h2 className="ptitle" style={{ margin: 0 }}>Employees — عملہ</h2>
        <span className="spacer" />
        <div className="acts">
          <button className="btn small ghost" onClick={doImport}>Import CSV/Excel</button>
          <button className="btn small ghost" onClick={() => {
            const name = prompt('New department name'); if (!name?.trim()) return;
            update(s => s.departments.push({ id: uid('dp'), name: name.trim() }), 'add dept');
          }}>+ Department</button>
        </div>
      </div>

      <div className="frow" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
        <input className="in" style={{ width: 70 }} placeholder="Code" value={f.code} onChange={e => setF({ ...f, code: e.target.value })} />
        <input className="in" placeholder="Name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <input className="in" style={{ width: 130 }} placeholder="Designation" value={f.designation} onChange={e => setF({ ...f, designation: e.target.value })} />
        <select className="in" value={f.department_id} onChange={e => setF({ ...f, department_id: e.target.value })}>
          <option value="">— dept —</option>
          {(store.departments || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input className="in" style={{ width: 140 }} placeholder="CNIC" value={f.cnic} onChange={e => setF({ ...f, cnic: e.target.value })} />
        <input className="in" style={{ width: 110 }} placeholder="Phone" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
        <input className="in" style={{ width: 100 }} placeholder="Basic salary" value={f.basic} onChange={e => setF({ ...f, basic: e.target.value })} />
        <select className="in" value={f.shift_id} onChange={e => setF({ ...f, shift_id: e.target.value })}>
          <option value="">— shift —</option>
          {(store.shifts || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn" onClick={saveEmp}>{edit ? 'Save' : '+ Employee'}</button>
        {edit && <button className="btn ghost" onClick={() => { setEdit(null); setF({ code: '', name: '', designation: '', department_id: '', cnic: '', phone: '', basic: '', shift_id: '' }); }}>Cancel</button>}
      </div>

      <table className="grid">
        <thead><tr><th>Code</th><th>Name</th><th>Designation</th><th>Dept</th><th>Shift</th><th>Phone</th><th>Joined</th><th className="num">Basic</th><th className="num">Loan</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {emps.map(e => {
            const loans = empLoans(store, e.id).reduce((t, l) => t + loanBalance(store, l.id), 0);
            return (
              <tr key={e.id}>
                <td>{e.code}</td><td><b>{e.name}</b></td><td className="muted">{e.designation}</td>
                <td>{dept(store, e.department_id)?.name || ''}</td>
                <td className="muted">{shift(store, e.shift_id)?.name || ''}</td>
                <td>{e.phone}</td><td className="muted">{e.doj}</td>
                <td className="num">{fmt(e.basic, cur)}</td>
                <td className="num">{loans ? fmt(loans, cur) : '—'}</td>
                <td>{e.status === 'left' ? `left ${e.left_on || ''}` : 'active'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="icon" title="Edit" onClick={() => startEdit(e)}>✎</button>
                  {e.status !== 'left' && <button className="icon" title="Mark left" onClick={() => { if (confirm(`Mark ${e.name} as left? Attendance/payroll will exclude them.`)) update(s => { const x = s.employees.find(y => y.id === e.id); x.status = 'left'; x.left_on = today(); }, 'employee left'); }}>⏻</button>}
                  <button className="icon" title="Delete" onClick={() => { if (confirm(`Delete ${e.name}? Their punches/payslips remain in history.`)) update(s => { s.employees = s.employees.filter(x => x.id !== e.id); }, 'delete employee'); }}>✕</button>
                </td>
              </tr>
            );
          })}
          {!emps.length && <tr><td colSpan="11" className="muted" style={{ padding: 14 }}>No employees yet — add above or import a CSV.</td></tr>}
        </tbody>
      </table>

      {imp && (
        <div className="pcard" style={{ marginTop: 14 }}>
          <b>Import preview — {imp.rows.length} rows</b>
          {imp.errors.map((e, i) => <div key={i} style={{ color: '#dc2626', fontSize: 12 }}>{e}</div>)}
          <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
            <table className="grid"><thead><tr><th>Code</th><th>Name</th><th>Designation</th><th>Dept</th><th className="num">Basic</th></tr></thead>
              <tbody>{imp.rows.map((r, i) => <tr key={i}><td>{r.code}</td><td>{r.name}</td><td>{r.designation}</td><td>{r.deptName}</td><td className="num">{r.basic}</td></tr>)}</tbody></table>
          </div>
          <div className="frow" style={{ marginTop: 8 }}>
            <button className="btn" onClick={applyImport}>Apply import</button>
            <button className="btn ghost" onClick={() => setImp(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
