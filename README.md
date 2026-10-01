# Attendory

Offline HR attendance & payroll office for small businesses — employees & departments, shifts with grace/OT rules, daily attendance grid + biometric/CSV punch import, leave quota & approvals, loan/advance khata with EMI salary deductions, payroll runs with payslips & salary sheet, final settlement, and reports. No account, no subscription, no internet.

## Features

- **Employees** — codes, designations, departments, CNIC, salary, shift; bulk CSV/Excel import with preview; per-employee loan balance column
- **Shifts** — start/end times, grace minutes, per-shift weekly-off days; late arrivals and overtime flagged automatically
- **Attendance** — daily marking grid (P/A/L/H/½), in/out time fields, mark-all-present, monthly register print, **CSV/biometric punch import** (`code,date,in,out`), anomalies list (late by shift grace)
- **Leaves** — types with yearly quota (annual/sick/casual + unpaid), approve/reject flow that writes leave marks into attendance, per-employee balance view
- **Loans & advances** — issue with EMI + start month; installments auto-deduct inside the payroll run; manual payments, waivers, per-loan ledger; nothing is deleted — movements only
- **Payroll** — month run computes basic + salary heads + OT pay − absent days − half days − unpaid leave − loan EMI; gap-free payslip numbers, print A5 slip, print A4 landscape salary sheet, mark paid, **void rolls back its loan deductions**
- **Final settlement** — one click for a leaving employee: unpaid worked days + open loan balances → printable memo, employee marked left, loans closed
- **Reports** — monthly attendance %, late days, OT hours per employee; payroll cost by department; loans outstanding; leave usage
- **Privacy** — SQLCipher-encrypted local database; PIN-locked roles (hr / accountant / supervisor / clerk); first-run consent screen; nothing leaves the PC unless you opt in to LAN sharing
- **LAN** — opt-in host mode serves the app to office PCs in a browser with an access code, plus pair-code app-to-app sync and a shared-folder sync file
- **Sample data** — fictional "Al-Falah Traders" (6 employees, 2 shifts, punches, leaves, a loan, last month's payroll) so every screen is demonstrable on first launch

## Run

```bash
npm install
npm run dev        # vite + electron
npm run build      # web bundle only
npm run dist:win   # signed-less .appx (Windows)
```

Data lives in an encrypted `attendory.db` in the OS user-data folder. `attendory.json` backups export/import from the sidebar.
