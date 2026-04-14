@echo off
setlocal
cd /d "%~dp0"

echo Stopping Faceburger printer listener...
powershell -NoProfile -NonInteractive -Command ^
  "$root = [regex]::Escape((Get-Location).Path); $p = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'index\.js' -and $_.CommandLine -match $root }; if ($p) { $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('Stopped PID ' + $_.ProcessId) } } else { Write-Host 'No listener process found.' }"

echo Done.
endlocal
