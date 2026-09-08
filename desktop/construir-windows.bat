@echo off
REM ============================================================
REM  Construir instalador para Windows (.exe)
REM  Doble clic sobre este archivo. Requiere Node.js instalado
REM  (https://nodejs.org). Genera el instalador en la carpeta
REM  "instaladores".
REM ============================================================
cd /d "%~dp0"

echo.
echo   Control Finanzas Studio - generando instalador para Windows
echo   -----------------------------------------------------------

where node >nul 2>nul
if errorlevel 1 (
  echo   [!] No se encontro Node.js. Instalalo desde https://nodejs.org y vuelve a intentar.
  echo.
  pause
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do echo   - Node.js: %%v
echo   - Instalando dependencias (la primera vez tarda unos minutos)...
call npm install
if errorlevel 1 ( echo   [x] Fallo npm install & pause & exit /b 1 )

echo   - Construyendo el instalador...
call npm run dist:win
if errorlevel 1 ( echo   [x] Fallo la construccion & pause & exit /b 1 )

echo.
echo   [OK] Listo. El instalador esta en la carpeta "instaladores".
start "" "instaladores"
pause
