Unicode true
RequestExecutionLevel user
SetCompressor /SOLID lzma

!include "MUI2.nsh"

!define APP_NAME "Coop Avola Desktop"
!define APP_VERSION "1.2.4"
!define APP_EXE "Coop Avola Desktop.exe"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\CoopAvolaDesktop"

Name "${APP_NAME}"
Caption "Installazione ${APP_NAME}"
OutFile "../dist/Coop-Avola-Desktop-Setup-1.2.4.exe"
InstallDir "$LOCALAPPDATA\Programs\Coop Avola Desktop"
InstallDirRegKey HKCU "Software\Coop Avola Desktop" "InstallLocation"

VIProductVersion "1.2.4.0"
VIAddVersionKey /LANG=1040 "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=1040 "ProductVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1040 "CompanyName" "Coop Avola"
VIAddVersionKey /LANG=1040 "FileDescription" "Setup ${APP_NAME}"
VIAddVersionKey /LANG=1040 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1040 "LegalCopyright" "Copyright 2026 Coop Avola"

!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Avvia Coop Avola Desktop"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Italian"

Section "Installa" SEC_MAIN
  SetShellVarContext current
  nsExec::ExecToLog 'taskkill /IM "${APP_EXE}" /F'
  Sleep 500

  SetOutPath "$INSTDIR"
  File /r "../dist/win-unpacked/*.*"

  WriteUninstaller "$INSTDIR\Disinstalla Coop Avola Desktop.exe"
  WriteRegStr HKCU "Software\Coop Avola Desktop" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "Coop Avola"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Disinstalla Coop Avola Desktop.exe"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1

  CreateDirectory "$SMPROGRAMS\Coop Avola Desktop"
  CreateShortcut "$SMPROGRAMS\Coop Avola Desktop\Coop Avola Desktop.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$SMPROGRAMS\Coop Avola Desktop\Disinstalla.lnk" "$INSTDIR\Disinstalla Coop Avola Desktop.exe"
  CreateShortcut "$DESKTOP\Coop Avola Desktop.lnk" "$INSTDIR\${APP_EXE}"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::ExecToLog 'taskkill /IM "${APP_EXE}" /F'
  Sleep 500
  Delete "$DESKTOP\Coop Avola Desktop.lnk"
  RMDir /r "$SMPROGRAMS\Coop Avola Desktop"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  DeleteRegKey HKCU "Software\Coop Avola Desktop"
  RMDir /r "$INSTDIR"
SectionEnd
