import { useEffect, useRef, useState } from 'react';
import { installWebApi } from './lib/webapi.js';
import { emptyStore, sampleStore, defaultSettings } from './lib/model.js';
import { tenantsCsv } from './lib/csv.js';
import PinGate from './components/PinGate.jsx';
import Dashboard from './components/Dashboard.jsx';
import PropertiesPanel from './components/PropertiesPanel.jsx';
import TenantsPanel from './components/TenantsPanel.jsx';
import BillsPanel from './components/BillsPanel.jsx';
import MetersPanel from './components/MetersPanel.jsx';
import ExpensesPanel from './components/ExpensesPanel.jsx';
import ReportsPanel from './components/ReportsPanel.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';

installWebApi();

const NAV = [
  { section: 'Property', items: [
    { id: 'dashboard', label: 'Dashboard', ur: 'ڈیش بورڈ' },
    { id: 'properties', label: 'Properties & units', ur: 'جائیداد' },
    { id: 'tenants', label: 'Tenants', ur: 'کرایہ دار' },
  ]},
  { section: 'Money', items: [
    { id: 'bills', label: 'Rent bills', ur: 'بل' },
    { id: 'meters', label: 'Meters', ur: 'میٹر' },
    { id: 'expenses', label: 'Expenses', ur: 'اخراجات' },
    { id: 'reports', label: 'Reports', ur: 'رپورٹس' },
  ]},
  { section: 'Setup', items: [{ id: 'settings', label: 'Settings', ur: 'ترتیبات' }] },
];
const ROLE_TABS = {
  owner: null,
  manager: ['dashboard', 'properties', 'tenants', 'bills', 'meters', 'expenses', 'reports'],
  collector: ['dashboard', 'tenants', 'bills', 'meters'],
  clerk: ['dashboard', 'properties', 'tenants'],
};

export default function App() {
  const [store, setStore] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [saveState, setSaveState] = useState('saved');
  const [syncNote, setSyncNote] = useState('');
  const rev = useRef(0);
  const saveTimer = useRef(null);
  const idle = useRef(null);
  const st = store?.settings || {};

  useEffect(() => {
    (async () => {
      try {
        const { doc, rev: r } = await window.api.store.load();
        rev.current = r || 0;
        setStore(doc && doc.version && doc.updatedAt ? doc : sampleStore());
      } catch (e) {
        console.error('load failed', e);
        setStore(sampleStore());
      }
    })();
    window.api.sync?.onApply?.((doc) => { setStore(doc); setSyncNote('Synced from another PC'); setTimeout(() => setSyncNote(''), 4000); });
  }, []);

  useEffect(() => {
    if (!store) return;
    clearTimeout(saveTimer.current);
    setSaveState('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        const r = await window.api.store.save(store, rev.current);
        rev.current = r?.rev ?? rev.current + 1;
        setSaveState('saved');
      } catch (e) { setSaveState('error'); console.error(e); }
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [store]);

  useEffect(() => {
    const reset = () => {
      clearTimeout(idle.current);
      idle.current = setTimeout(() => { if ((st.users || []).length) setUser(null); }, 10 * 60 * 1000);
    };
    for (const ev of ['click', 'keydown', 'mousemove', 'wheel']) window.addEventListener(ev, reset, { passive: true });
    reset();
    return () => { for (const ev of ['click', 'keydown', 'mousemove', 'wheel']) window.removeEventListener(ev, reset); clearTimeout(idle.current); };
  }, [st.users]);

  const update = (fn, what) => setStore(s => {
    const next = JSON.parse(JSON.stringify(s));
    fn(next);
    next.updatedAt = Date.now();
    next.auditLog = [...(next.auditLog || []), { at: new Date().toISOString(), user: user?.name || 'app', what: what || 'edit' }];
    return next;
  });

  const backup = async () => {
    const r = await window.api.export.json({ doc: store, suggestedName: `rentory-backup-${new Date().toISOString().slice(0, 10)}.json` });
    if (r?.ok) alert('Backup saved.');
  };
  const restore = async () => {
    const f = await window.api.app.openFile({ filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!f?.text) return;
    try {
      const doc = JSON.parse(f.text);
      if (!doc || !doc.version) throw 0;
      if (confirm('Replace all current data with this backup?')) setStore(doc);
    } catch { alert('Not a valid Rentory backup file.'); }
  };
  const exportCsv = () => window.api.export.text({ text: tenantsCsv(store), suggestedName: 'rentory-tenants.csv' });

  if (!store) return <div style={{ padding: 40 }}>Loading…</div>;
  if (st.firstRunDone === false) {
    return (
      <div style={{ maxWidth: 560, margin: '8vh auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px #0002' }}>
        <h2 style={{ marginTop: 0 }}>Rentory — offline rent register</h2>
        <p>Rentory keeps your units, tenants, rent bills, receipts and deposits <b>on this computer only</b> — nothing is uploaded anywhere. Data stays in an encrypted database on this PC.</p>
        <ul style={{ lineHeight: 1.8, fontSize: 14 }}>
          <li>Tenant data you enter (names, CNIC, rent, deposits) is stored locally.</li>
          <li>Optional LAN sharing syncs data only between PCs on your own network.</li>
          <li>A sample property is loaded so you can try every feature — reset it anytime in Settings.</li>
          <li>Keep a backup in Settings before uninstalling.</li>
        </ul>
        <button className="btn" onClick={() => update(s => { s.settings.firstRunDone = true; s.settings.consent = { accepted_on: new Date().toISOString(), version: 1 }; }, 'consent accepted')}>I understand — shuru karein</button>
      </div>
    );
  }
  if ((st.users || []).length && !user) return <PinGate store={store} onLogin={setUser} />;

  const allowed = user ? (ROLE_TABS[user.role] || null) : null;
  const pages = {
    dashboard: <Dashboard store={store} update={update} go={setPage} />,
    properties: <PropertiesPanel store={store} update={update} />,
    tenants: <TenantsPanel store={store} update={update} />,
    bills: <BillsPanel store={store} update={update} user={user} />,
    meters: <MetersPanel store={store} update={update} />,
    expenses: <ExpensesPanel store={store} update={update} user={user} />,
    reports: <ReportsPanel store={store} update={update} />,
    settings: <SettingsPanel store={store} update={update} setStore={setStore} />,
  };
  const active = allowed && !allowed.includes(page) ? allowed[0] : page;

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <div className="logo">R</div>
          <div><div className="bname">Rentory</div><div className="bsub">{st.companyName || 'Rent register'}</div></div>
        </div>
        {NAV.map(g => (
          <div key={g.section} className="ngroup">
            <div className="glabel">{g.section}</div>
            {g.items.filter(i => !allowed || allowed.includes(i.id)).map(i => (
              <button key={i.id} className={'nitem' + (active === i.id ? ' on' : '')} onClick={() => setPage(i.id)}>
                <span>{i.label}</span>{st.uiUrdu && <span className="ur">{i.ur}</span>}
              </button>
            ))}
          </div>
        ))}
        <div className="sidefoot">
          {user && <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>{user.name} · {user.role} <button className="btn small ghost" onClick={() => setUser(null)}>Lock</button></div>}
          <div className="frow" style={{ gap: 6 }}>
            <button className="btn small ghost" onClick={backup}>Backup</button>
            <button className="btn small ghost" onClick={restore}>Import</button>
            <button className="btn small ghost" onClick={exportCsv}>CSV</button>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{saveState === 'saved' ? '✓ Saved' : saveState === 'saving' ? 'Saving…' : '⚠ Save error'}{syncNote ? ' · ' + syncNote : ''}</div>
        </div>
      </aside>
      <main className="main">{pages[active]}</main>
    </div>
  );
}
