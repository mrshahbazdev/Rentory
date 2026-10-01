# Attendory — Store listing copy

## Product name
Attendory

## Short title
Attendory

## Short description
Offline attendance & payroll register for small businesses — punches, shifts, leaves, loan khata, payslips. No account, no internet.

## Description
Attendory is a complete offline HR office for small businesses — everything runs on one Windows PC with no account, no subscription and no internet.

Track it all:

• Employees & departments — codes, designations, CNIC, salary, shifts; bulk import from Excel/CSV
• Shifts & overtime rules — grace minutes, weekly-off days per shift; late arrivals and OT hours flagged automatically
• Attendance — daily grid, mark-all-present, monthly register print, and CSV/biometric punch import (code, date, in, out)
• Leave management — annual/sick/casual quotas plus unpaid leave; approve/reject flow; per-employee balances
• Loans & advances khata — issue with EMI; installments deduct automatically inside payroll; ledgers for every movement
• Payroll runs — basic + heads + OT − absents − unpaid leave − EMI; printable payslips (A5) and salary sheet (A4); void rolls back loan deductions
• Final settlement — unpaid days + loan balances → printable memo when an employee leaves
• Reports — monthly attendance %, late days, OT hours, payroll cost by department, loans outstanding
• PIN-locked roles — HR, accountant, supervisor, clerk
• LAN sharing — optionally open the same data from a second office PC over your own WiFi with an access code
• Encrypted local database — records never leave your computer; everything is stored in a SQLCipher-encrypted database on your PC
• English & Urdu — bilingual payslips and labels for local offices
• Sample company on first run — a fictional business with 6 employees, punches, leaves, a loan and last month's payroll so every screen is demonstrable
• Works completely offline — no account, no cloud, no tracking

## Product features
1. Offline attendance & payroll — no account, no internet
2. CSV/biometric punch import + daily grid & monthly register
3. Shifts, grace, weekly offs — auto late & overtime flags
4. Loan & advance khata with EMI salary deductions
5. Payslips, salary sheet & final settlement prints
6. PIN-locked roles + encrypted local database + LAN sync

## Search keywords (max 7)
attendance, payroll, employee register, overtime, payslip, leave management, HR software

## Copyright
Copyright © 2026 Muhammad Shahbaz

## Developer / publisher
Muhammad Shahbaz — mrshahbaznns@gmail.com

## Testing notes for certification
- On first launch a consent screen appears; accept it to continue. A sample company (Al-Falah Traders) loads so every screen is populated — or Settings → Reset to start blank.
- Attendance → Import punches accepts CSV columns: code,date,in,out (template downloadable in-app).
- Payroll → Run payroll for the current month issues slips; Payslips tab prints A5 slip / salary sheet. Loans & advances shows EMI auto-deduction.
- The app stores data in a locally encrypted database in the user profile; it makes no network requests.
- runFullTrust is required for the encrypted local SQLite database (better-sqlite3-multiple-ciphers) and for optional opt-in LAN sharing (privateNetworkClientServer capability declared; off by default).
