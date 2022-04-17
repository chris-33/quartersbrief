;-------------------------
; Includes

!include "MUI2.nsh"
!include "logiclib.nsh"



;-------------------------
; Defines

!define NAME "Quartersbrief"
!define SLUG "${NAME} v${VERSION}"
!define APPFILE "${NAME}.cmd"



;-------------------------
; General

Name "${NAME}"
OutFile "Setup ${SLUG}.exe"
InstallDir "$PROGRAMFILES\${NAME}"
InstallDirRegKey HKCU "Software\${NAME}" ""
RequestExecutionLevel admin



;-------------------------
; UI

;!define MUI_ICON ""
;!define MUI_HEADERIMAGE
;!define MUI_WELCOMEFINISHPAGE_BITMAP "assets\welcome.bmp"
;!define MUI_HEADERIMAGE_BITMAP "assets\head.bmp"
;!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "${SLUG} Setup"



;-------------------------
; UI

; Installer pages
!insertmacro MUI_PAGE_WELCOME
;!insertmacro MUI_PAGE_LICENSE "license.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
  
; Set UI language
!insertmacro MUI_LANGUAGE "English"



;-------------------------
; Section - Install

Section "-hidden inst"
	SectionIn RO
	SetOutPath "$INSTDIR"
	File /r "app\*.*" 
	ExecWait '$SYSDIR\cmd.exe /c echo node "$INSTDIR\src\quartersbrief.js" %* > "$INSTDIR\${APPFILE}'
	WriteRegStr HKCU "Software\${NAME}" "" $INSTDIR
	WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd



;--------------------------------
; Section - Install NodeJS

Section "-NodeJS"
	; Check if NodeJS is already installed by trying to call it with the --version argument
	ClearErrors	
	NSExec::ExecToStack "node -v"
	; If this errored, assume it needs to be installed
	;
	; $0: exit code
	; $1: stdout
	pop $0
	pop $1
	${If} $0 == "error"
		DetailPrint "NodeJS is not installed"
		Goto Install
	${EndIf}
	; If it didn't error, make sure we have a version 17 or newer
	;
	; Copy two chars from $1 to $1, starting with the second char
	; This eliminates the leading 'v' from the output
	StrCpy $1 $1 2 1
	; Get the last char as $2, to make sure it is not "." (if NodeJS version is < 10)
	StrCpy $2 $1 1 1	
	StrCmp $2 "." 0 CompareVersions
	StrCpy $1 $1 1
	CompareVersions:
	DetailPrint "NodeJS is already installed, version $1"
	${Unless} $1 < 17
		DetailPrint "We are fine"
		Goto DoesNotNeedInstall
	${EndUnless}
	Install:
	DetailPrint "Installing NodeJS"
	InitPluginsDir
	SetOutPath "$PLUGINSDIR"
	File "redist\nodejs.msi"
	ExecWait '"msiexec" /i "$PLUGINSDIR\nodejs.msi"'
	DoesNotNeedInstall:
SectionEnd



;--------------------------------
; Section - Install Python 3

Section "-Python3"
	; Check if Python 3 is already installed by trying to call it with the --version argument
	ClearErrors	
	ExecWait "python -V"
	; If this errored, we will assume it needs to be installed
	IfErrors Install 0
	DetailPrint "Python 3 is already installed. We are fine." 
	Goto DoesNotNeedInstall
	Install:
	DetailPrint "Python 3 is not installed, installing."
	InitPluginsDir
	SetOutPath "$PLUGINSDIR"
	File "redist\python3.exe"
	ExecWait '"$PLUGINSDIR\python3.exe"'
	DoesNotNeedInstall:
SectionEnd



;--------------------------------
; Section - Run npm install and npm link

Section "-NPM"
	ClearErrors
	; The next two lines are necessary because when the NodeJS installer updates the path, this doesn't get 
	; reflected in the installer's environment. In other words: The installer gets its environment variables
	; at start time, so when the NodeJS installer updates PATH, this installer won't know about it.
	; (See https://stackoverflow.com/questions/4295779/using-updated-nsis-path-within-the-same-installer)
	; 
	; To rectify this, we read the PATH variable's new value from the registry, then set it for the installer's
	; environment using a system call to SetEnvironmentVariable
	; Meaning of parameters:
	; t = Input variable is of type string ("text")
	; "PATH" = Set variable PATH
	; r0 = Means $0
	;
	; See:
	; https://nsis.sourceforge.io/Docs/System/System.html#callfuncs
	; https://stackoverflow.com/questions/47265213/basic-understanding-of-calling-kernel-functions-in-nsis
	ReadRegStr $0 HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "PATH"
	System::Call 'Kernel32::SetEnvironmentVariable(t "PATH",t r0)'

	ClearErrors
	ExecWait '$SYSDIR\cmd.exe /c "cd $INSTDIR && npm install --production --no-package-lock"'
	IfErrors Errors Done

	Errors:
	MessageBox MB_ICONSTOP|MB_OK 'Running NPM commands failed. You may be able to recover from this by running "npm install --production" manually from the Quartersbrief directory with administrator rights.' 

	Done:
SectionEnd



;--------------------------------
; Section - Shortcut

Section "Desktop Shortcut" DeskShort
	CreateShortCut "$DESKTOP\${NAME}.lnk" "$INSTDIR\${APPFILE}"
SectionEnd



;--------------------------------
; Section - Uninstaller

Section "Uninstall"

  ;Delete Shortcut
  Delete "$DESKTOP\${NAME}.lnk"

  ;Delete Uninstall
  Delete "$INSTDIR\uninstall.exe"

  ;Delete Folder
  RMDir /r "$INSTDIR"

  DeleteRegKey /ifempty HKCU "Software\${NAME}"

SectionEnd