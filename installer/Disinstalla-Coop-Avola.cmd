@echo off
setlocal
set "APPDIR=%LOCALAPPDATA%\Programs\Coop Avola Desktop"
taskkill /IM "Coop Avola Desktop.exe" /F >nul 2>nul
del "%USERPROFILE%\Desktop\Coop Avola Desktop.lnk" >nul 2>nul
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Coop Avola Desktop.lnk" >nul 2>nul
if exist "%APPDIR%" rmdir /S /Q "%APPDIR%"
echo Coop Avola Desktop e stata disinstallata.
echo I dati di accesso salvati sono rimasti sul PC per sicurezza.
pause
