@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Undertone - Noisewater Labs
if /i "%~1"=="-package" goto packageOnly
set "FAILED=0"
echo Undertone 0.4.11 - Windows build
where node >nul 2>nul
if errorlevel 1 (
 echo [MISSING] Node.js 22.12 or later is required. https://nodejs.org/
 set "FAILED=1"
) else (
 node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)"
 if errorlevel 1 (
  echo [MISSING] Update Node.js to 22.12 or later.
  set "FAILED=1"
 )
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
 echo [MISSING] npm is required; it is included with Node.js.
 set "FAILED=1"
)
if not exist "%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" (
 echo [MISSING] Enable or install Windows .NET Framework 4.8.
 set "FAILED=1"
)
if "%FAILED%"=="1" goto fail
echo [1/5] Preparing dependencies...
if /i "%~1"=="-fast" (
 if exist node_modules\electron\package.json goto installed
)
call npm ci --no-audit --no-fund
if errorlevel 1 goto fail
:installed
echo [2/5] Checking TypeScript...
call npm run typecheck
if errorlevel 1 goto fail
echo [3/5] Running regression tests...
call npm test
if errorlevel 1 goto fail
echo [4/5] Building app and Windows helper...
call npm run build
if errorlevel 1 goto fail
call npm run build:native
if errorlevel 1 goto fail
:package
echo [5/5] Creating installer...
call npx --no-install electron-builder --win --x64
if errorlevel 1 goto fail
echo.
echo Build complete. Your installer is in the release folder.
explorer "%CD%\release"
pause
exit /b 0
:packageOnly
where npm.cmd >nul 2>nul
if errorlevel 1 goto fail
if not exist node_modules\electron-builder\package.json (
 echo Dependencies are missing. Run BUILD.cmd first.
 goto fail
)
if not exist dist\main\index.js (
 echo App build is missing. Run BUILD.cmd -fast first.
 goto fail
)
if not exist dist\renderer\index.html (
 echo Renderer build is missing. Run BUILD.cmd -fast first.
 goto fail
)
if not exist build\native\undertone-helper.exe (
 echo Windows helper is missing. Run BUILD.cmd -fast first.
 goto fail
)
goto package
:fail
echo.
echo Build stopped. Review the error above; this window will stay open.
pause
exit /b 1
