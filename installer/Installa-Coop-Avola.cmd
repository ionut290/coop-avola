@echo off
setlocal
set "APPDIR=%LOCALAPPDATA%\Programs\Coop Avola Desktop"
set "SOURCE=%~dp0app"

if not exist "%SOURCE%\Coop Avola Desktop.exe" (
  echo ERRORE: cartella dell'app non trovata.
  echo Estrai completamente il file ZIP prima di eseguire l'installazione.
  pause
  exit /b 1
)

echo Installazione di Coop Avola Desktop...
taskkill /IM "Coop Avola Desktop.exe" /F >nul 2>nul
if not exist "%APPDIR%" mkdir "%APPDIR%"
xcopy "%SOURCE%\*" "%APPDIR%\" /E /I /Y /Q >nul
if errorlevel 1 (
  echo ERRORE: non e stato possibile copiare l'applicazione.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $exe=Join-Path $env:LOCALAPPDATA 'Programs\Coop Avola Desktop\Coop Avola Desktop.exe'; $d=$ws.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Coop Avola Desktop.lnk')); $d.TargetPath=$exe; $d.WorkingDirectory=(Split-Path $exe); $d.Save(); $sdir=Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'; $s=$ws.CreateShortcut((Join-Path $sdir 'Coop Avola Desktop.lnk')); $s.TargetPath=$exe; $s.WorkingDirectory=(Split-Path $exe); $s.Save()"

echo.
echo Installazione completata.
start "" "%APPDIR%\Coop Avola Desktop.exe"
exit /b 0
