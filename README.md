# Rentory

Offline rent & property register for landlords and property dealers — properties & units, tenants with deposit khata, monthly rent bills with arrears, payment receipts, electricity meters, expenses, and reports. No account, no subscription, no internet.

## Features

- **Properties & units** — multiple properties; units with kind (shop/flat/house/room/plot), rent, floor, metered flag; vacant/occupied tracked automatically on move-in/move-out
- **Tenants** — contact, CNIC, WhatsApp, rent & security deposit, move-in/out; bulk CSV/Excel import; per-tenant khata (billed vs paid vs outstanding), printable statement, WhatsApp reminder (wa.me link, message pre-filled)
- **Rent bills** — one-click month-end generation for every active tenant: rent + open meter amount + arrears carried from earlier unpaid bills + optional late fee; gap-free bill numbers; void-with-reason (row kept, never deleted)
- **Receipts** — cash/bank/online/cheque with reference; gap-free receipt numbers; **void rolls back the bill status but keeps the receipt row**; printable receipt (A5) and bill
- **Meters** — per-unit monthly electricity readings: prev auto-fills from last month, units × rate becomes a line on the next rent bill and locks
- **Expenses** — per-property expense register feeding the day-book/net report
- **Reports** — 6-month billed/collected/net trend, per-property occupancy & rent roll, defaulter list with oldest unpaid month, printable collection register & occupancy report
- **Privacy** — SQLCipher-encrypted local database; PIN-locked roles (owner / manager / collector / clerk); first-run consent; nothing leaves the PC unless you opt in to LAN sharing
- **LAN** — opt-in host mode serves the app to other PCs in a browser with an access code, plus pair-code app-to-app sync and shared-folder sync
- **Sample data** — fictional "Al-Falah Properties" (2 properties, 5 units, 4 tenants, bills, receipts, a partial defaulter, meters) so every screen works on first launch

## Run

```bash
npm install
npm run dev        # vite + electron
npm run build      # web bundle only
npm run dist:win   # unsigned .appx (Windows)
```

Data lives in an encrypted `rentory.db` in the OS user-data folder. JSON backups export/import from the sidebar.
