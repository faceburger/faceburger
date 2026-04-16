@echo off
REM Raw printer helper for Windows 7
REM Usage: print-raw.bat "printer_name" "file.prn"

set PRINTER=%~1
set FILE=%~2

REM Try method 1: Copy to printer UNC path
copy /b "%FILE%" "\\localhost\%PRINTER%" >nul 2>&1
if %ERRORLEVEL% EQU 0 exit /b 0

REM Try method 2: Copy to LPT1
copy /b "%FILE%" LPT1 >nul 2>&1
if %ERRORLEVEL% EQU 0 exit /b 0

REM Try method 3: Copy to printer device path
copy /b "%FILE%" "\\.\%PRINTER%" >nul 2>&1
if %ERRORLEVEL% EQU 0 exit /b 0

REM All methods failed
exit /b 1
