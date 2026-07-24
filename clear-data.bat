@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0backend"

echo ============================================================
echo   NEO REPORT CN - Clear order data (keep Users + Sessions)
echo ============================================================
echo.
echo   DELETE : orders, items, notes, tracking, area rules, vendors
echo   KEEP   : users and login sessions
echo.
echo   *** This deletion is PERMANENT and cannot be undone ***
echo.

set "CONFIRM="
set /p "CONFIRM=Type YES then Enter to confirm: "
if /i not "!CONFIRM!"=="YES" (
  echo.
  echo Cancelled - no data was deleted.
  echo.
  pause
  exit /b 0
)

echo.
echo Running...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found in PATH. Please install Node.js or run:
  echo         node src\scripts\clearData.js
  echo.
  pause
  exit /b 1
)

call node src\scripts\clearData.js
set "RC=!errorlevel!"

echo.
if "!RC!"=="0" (
  echo Done.
) else (
  echo [ERROR] Script exited with code !RC!. See messages above.
)
echo.
pause
endlocal
