import { useState } from 'react';
import { num, today, ym, emp, empShift, isOffDay, punchFor, punchesOn, computePunch, leaveOn, attSummary, activeEmployees } from '../lib/model.js';
import { parsePunchesCsv, punchesCsvTemplate } from '../lib/csv.js';
import { registerHtml } from '../lib/prints.js';

export default function AttendancePanel({ store, update, user }) {
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [mode, setMode] = useState('day'); // day | month | import | anomalies
  const [imp, setImp] = useState(null);
  const by = (user && user.name) || 'app';
  const emps = activeEmployees(store);

  const mark = (e, status) => update(s => {
    const p = punchFor(s, e.id, date);
    if (status === '') { if (p) s.punches = s.punches.filter(x => x.id !== p.id); return; }
    if (status === 'P') {
      const sh = empShift(s, e);
      const c = computePunch(s, e, date, sh?.start || '', sh?.end || '');
      Object.assign(p || {}, c);
      const row = p || { id: '', employee_id: e.id, date };
      Object.assign(row, { in: sh?.start || '', out: sh?.end || '', ...c, source: 'manual', marked_by: by });
      if (!p) { row.id = 'pu' + Math.random().toString(36).slice(2, 10); s.punches.push(row); }
    } else {
      const row = p || { id: 'pu' + Math.random().toString(36).slice(2, 10), employee_id: e.id, date };
      Object.assign(row, { status, late_min: 0, ot_min: 0, work_min: 0, source: 'manual', marked_by: by });
      if (!p) s.punches.push(row);
    }
  }, 'mark attendance');

  const setTime = (e, field, val) => update(s => {
    const p = punchFor(s, e.id, date) || { in: '', out: '' };
    const next = { ...p, [field]: val };
    const c = computePunch(s, e, date, next.in, next.out);
    const row = p.id ? s.punches.find(x => x.id === p.id) : null;
    if (row) Object.assign(row, { in: next.in, out: next.out, ...c, source: 'manual', marked_by: by });
    else s.punches.push({ id: 'pu' + Math.random().toString(36).slice(2, 10), employee_id: e.id, date, in: next.in, out: next.out, ...c, source: 'manual', marked_by: by });
  }, 'set time');

  const markAll = () => update(s => {
    for (const e of activeEmployees(s)) {
      if (isOffDay(s, e, date)) continue;
      if (punchFor(s, e.id, date)) continue;
      if (leaveOn(s, e.id, date)) continue;
      const sh = empShift(s, e);
      const c = computePunch(s, e, date, sh?.start || '', sh?.end || '');
      s.punches.push({ id: 'pu' + Math.random().toString(36).slice(2, 10), employee_id: e.id, date, in: sh?.start || '', out: sh?.end || '', ...c, source: 'manual', marked_by: by });
    }
  }, 'mark all present');

  const doImport = async () => {
    const file = await window.api.app.openFile({ filters: [{ name: 'CSV', extensions: ['csv', 'txt', 'tsv'] }] });
    if (!file?.text) return;
    setImp(parsePunchesCsv(store, file.text));
  };
  const applyImport = () => update(s => {
    const dates = [...new Set(imp.rows.map(r => r.date))];
    s.punches = (s.punches || []).filter(p => !(dates.includes(p.date) && p.source === 'import'));
    for (const r of imp.rows) {
      const e = s.employees.find(x => x.id === r.employee_id);
      const lv = leaveOn(s, e.id, r.date);
      if (lv) { s.punches.push({ id: 'pu' + Math.random().toString(36).slice(2, 10), employee_id: e.id, date: r.date, in: '', out: '', status: 'L', late_min: 0, work_min: 0, ot_min: 0, source: 'import', marked_by: by }); continue; }
      if (!r.in && !r.out) { s.punches.push({ id: 'pu' + Math.random().toString(36).slice(2, 10), employee_id: e.id, date: r.date, in: '', out: '', status: 'A', late_min: 0, work_min: 0, ot_min: 0, source: 'import', marked_by: by }); continue; }
      const c = computePunch(s, e, r.date, r.in, r.out);
      s.punches.push({ id: 'pu' + Math.random().toString(36).slice(2, 10), employee_id: e.id, date: r.date, in: r.in, out: r.out, ...c, source: 'import', marked_by: by });
    }
    setImp(null);
  }, 'import punches');

  const anomalies = (store.punches || []).filter(p => num(p.late_min) > 0 && ym(p.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="panel" style={{ maxWidth: 1150 }}>
      <div className="toolbar">
        <h2 className="ptitle" style={{ margin: 0 }}>Attendance — حاضری</h2>
        <span className="spacer" />
        <div className="acts">
          {[['day', 'Daily'], ['month', 'Month register'], ['import', 'Import punches'], ['anomalies', 'Anomalies']].map(([m, l]) =>
            <button key={m} className={'btn small' + (mode === m ? '' : ' ghost')} onClick={() => setMode(m)}>{l}</button>)}
        </div>
      </div>

      {mode === 'day' && (
        <>
          <div className="frow" style={{ marginBottom: 10 }}>
            <input className="in" type="date" value={date} onChange={e => setDate(e.target.value)} />
            <button className="btn small ghost" onClick={markAll}>Mark all present</button>
            <span className="muted" style={{ fontSize: 12 }}>P = present · A = absent · L = leave · H = holiday · ½ = missed out-punch</span>
          </div>
          <table className="grid">
            <thead><tr><th>Code</th><th>Employee</th><th>Shift</th><th>In</th><th>Out</th><th>Status</th><th className="num">Late</th><th className="num">OT</th><th>Mark</th></tr></thead>
            <tbody>
              {emps.map(e => {
                const p = punchFor(store, e.id, date);
                const sh = empShift(store, e);
                const off = isOffDay(store, e, date);
                const lv = leaveOn(store, e.id, date);
                return (
                  <tr key={e.id} style={off ? { opacity: .55 } : undefined}>
                    <td>{e.code}</td><td><b>{e.name}</b></td>
                    <td className="muted">{sh ? `${sh.start}–${sh.end}` : '—'}</td>
                    <td><input className="in" type="time" style={{ width: 90, padding: '2px 4px' }} value={p?.in || ''} onChange={ev => setTime(e, 'in', ev.target.value)} /></td>
                    <td><input className="in" type="time" style={{ width: 90, padding: '2px 4px' }} value={p?.out || ''} onChange={ev => setTime(e, 'out', ev.target.value)} /></td>
                    <td>{off ? 'Off day' : lv ? 'L (leave)' : (p?.status || '—')}</td>
                    <td className="num" style={num(p?.late_min) ? { color: '#dc2626' } : {}}>{num(p?.late_min) ? p.late_min + 'm' : '—'}</td>
                    <td className="num">{num(p?.ot_min) ? Math.round(p.ot_min / 60 * 10) / 10 + 'h' : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {['P', 'A', 'L', 'H'].map(st => (
                        <button key={st} className={'btn small' + (p?.status === st ? '' : ' ghost')} style={{ padding: '1px 7px', marginRight: 2 }} onClick={() => mark(e, st)}>{st}</button>
                      ))}
                    </td>
                  </tr>
                );
              })}
              {!emps.length && <tr><td colSpan="9" className="muted" style={{ padding: 14 }}>No employees yet.</td></tr>}
            </tbody>
          </table>
        </>
      )}

      {mode === 'month' && (
        <>
          <div className="frow" style={{ marginBottom: 10 }}>
            <input className="in" type="month" value={month} onChange={e => setMonth(e.target.value)} />
            <button className="btn small ghost" onClick={() => window.api.export.print({ html: registerHtml(store, month, emps) })}>Print register</button>
          </div>
          <table className="grid">
            <thead><tr><th>Employee</th><th className="num">P</th><th className="num">A</th><th className="num">L</th><th className="num">½</th><th className="num">Late days</th><th className="num">OT hrs</th></tr></thead>
            <tbody>
              {emps.map(e => {
                const s = attSummary(store, e.id, month);
                return <tr key={e.id}><td><b>{e.name}</b> <span className="muted">{e.code}</span></td>
                  <td className="num">{s.p}</td><td className="num" style={s.a ? { color: '#dc2626' } : {}}>{s.a}</td><td className="num">{s.l}</td><td className="num">{s.half}</td>
                  <td className="num" style={s.late ? { color: '#b45309' } : {}}>{s.late}</td><td className="num">{Math.round(s.ot / 60 * 10) / 10}</td></tr>;
              })}
            </tbody>
          </table>
        </>
      )}

      {mode === 'import' && (
        <>
          <p className="muted">Columns: <code>code, date, in, out</code> — date <code>YYYY-MM-DD</code>, times <code>HH:MM</code>. Empty in/out marks absent. Approved leave wins over a punch. Re-importing a date replaces only that date's imported rows.
            {' '}<button className="btn small ghost" onClick={() => window.api.export.text({ text: punchesCsvTemplate(), suggestedName: 'attendory-punches-template.csv' })}>Download template</button>
            {' '}<button className="btn" onClick={doImport}>Choose CSV…</button></p>
          {imp && (
            <div className="pcard">
              <b>{imp.rows.length} rows parsed</b>
              {imp.errors.map((e, i) => <div key={i} style={{ color: '#dc2626', fontSize: 12 }}>{e}</div>)}
              <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8 }}>
                <table className="grid"><thead><tr><th>Code</th><th>Name</th><th>Date</th><th>In</th><th>Out</th></tr></thead>
                  <tbody>{imp.rows.map((r, i) => <tr key={i}><td>{r.code}</td><td>{r.name}</td><td>{r.date}</td><td>{r.in || '—'}</td><td>{r.out || '—'}</td></tr>)}</tbody></table>
              </div>
              <div className="frow" style={{ marginTop: 8 }}>
                <button className="btn" onClick={applyImport}>Apply import</button>
                <button className="btn ghost" onClick={() => setImp(null)}>Cancel</button>
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'anomalies' && (
        <>
          <div className="frow" style={{ marginBottom: 10 }}>
            <input className="in" type="month" value={month} onChange={e => setMonth(e.target.value)} />
            <span className="muted" style={{ fontSize: 12 }}>Late arrivals beyond shift grace</span>
          </div>
          <table className="grid">
            <thead><tr><th>Date</th><th>Employee</th><th>Shift in</th><th>Punched</th><th className="num">Late by</th></tr></thead>
            <tbody>
              {anomalies.map(p => {
                const e = emp(store, p.employee_id);
                return <tr key={p.id}><td>{p.date}</td><td><b>{e?.name}</b> <span className="muted">{e?.code}</span></td>
                  <td>{empShift(store, e)?.start || '—'}</td><td style={{ color: '#dc2626' }}>{p.in}</td><td className="num">{p.late_min} min</td></tr>;
              })}
              {!anomalies.length && <tr><td colSpan="5" className="muted" style={{ padding: 14 }}>No late arrivals in {month}.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
