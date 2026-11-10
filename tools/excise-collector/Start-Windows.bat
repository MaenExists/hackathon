@echo off
setlocal
cd /d "%~dp0"
set "COLLECTOR_ROOT=%~dp0"
set "COLLECTOR_ARCH=x86"
if /I "%PROCESSOR_ARCHITECTURE%"=="AMD64" set "COLLECTOR_ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "COLLECTOR_ARCH=arm64"
if /I "%PROCESSOR_ARCHITEW6432%"=="AMD64" set "COLLECTOR_ARCH=x64"
if /I "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "COLLECTOR_ARCH=arm64"
set "COLLECTOR_RUNTIME=%COLLECTOR_ROOT%.runtime\windows-%COLLECTOR_ARCH%"
set "COLLECTOR_ARCHIVE=%COLLECTOR_ROOT%runtimes\windows-%COLLECTOR_ARCH%.zip"
if not exist "%COLLECTOR_ARCHIVE%" goto systempython
if exist "%COLLECTOR_RUNTIME%\.ready" goto runbundled
echo Preparing the bundled Python runtime. This only happens once.
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:COLLECTOR_ARCHIVE -DestinationPath $env:COLLECTOR_RUNTIME -Force; [System.IO.File]::WriteAllText((Join-Path $env:COLLECTOR_RUNTIME '.ready'),'ready')"
if errorlevel 1 goto failed
:runbundled
"%COLLECTOR_RUNTIME%\python.exe" "%COLLECTOR_ROOT%start.py"
goto finished
:systempython
where py >nul 2>nul
if errorlevel 1 goto trypython
py -3 "%COLLECTOR_ROOT%start.py"
goto finished
:trypython
where python >nul 2>nul
if errorlevel 1 goto missing
python "%COLLECTOR_ROOT%start.py"
goto finished
:missing
echo Use the complete portable copy, which includes Python, or install Python 3.10 or newer.
goto failed
:finished
if errorlevel 1 goto failed
exit /b 0
:failed
echo The collector stopped. Read the message above for details.
pause
exit /b 1
