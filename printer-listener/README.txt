Faceburger Printer Listener (Windows)
=====================================

Purpose
-------
This standalone app polls Neon orders and prints 2 separate tickets
for each new order on the same printer:
1) Kitchen ticket
2) Customer receipt

Only after both print successfully, the order is marked as printed.


Setup (restaurant PC)
---------------------
1. Install Node.js
   - For Windows 7, use Node v12.22.12 (x64)
2. Open this folder
3. Copy .env.example to .env
4. Fill .env values:
   - DATABASE_URL
   - PRINTER_NAME (exact Windows printer name)
   - POLL_MS (optional, default 3000)
   - TIMEZONE (optional, default Africa/Casablanca)
5. Double-click start.bat


Notes
-----
- Printing: tries PowerShell ReadAllText + Out-Printer first; if that fails (e.g. PowerShell 2
  without Out-Printer), falls back to Windows PRINT.EXE.
- stop.bat uses Get-WmiObject (works on Windows 7 / PowerShell 2). Do not use Get-CimInstance there.
- Requires Windows PowerShell and a working local printer setup.
- This app prints only orders where printed_at is NULL.
- If printing fails, printed_at remains NULL and will retry.


Control scripts
---------------
- start.bat   : start listener
- stop.bat    : stop listener process
- restart.bat : stop then start
