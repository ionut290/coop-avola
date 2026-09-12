@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo ERRORE: Node.js LTS non e installato.
  echo Scaricalo da https://nodejs.org e poi riapri questo file.
  pause
  exit /b 1
)

echo [1/3] Installazione componenti...
call npm install
if errorlevel 1 goto :errore

where makensis >nul 2>nul
if errorlevel 1 (
  echo ERRORE: NSIS non e installato oppure makensis non e nel PATH.
  echo Questo comando serve solo agli sviluppatori. Per installare l'app usa direttamente il file Setup.exe.
  pause
  exit /b 1
)

echo [2/2] Verifica e creazione installer Windows 64 bit...
call npm run setup:win
if errorlevel 1 goto :errore

echo.
echo INSTALLER CREATO CORRETTAMENTE.
echo Lo trovi nella cartella dist con nome:
echo Coop-Avola-Desktop-Setup-1.2.4.exe
start "" "%~dp0dist"
pause
exit /b 0

:errore
echo.
echo ERRORE: operazione interrotta. Leggi il messaggio mostrato sopra.
pause
exit /b 1
