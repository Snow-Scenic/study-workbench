@echo off
chcp 65001 >nul
cd /d "%~dp0"
if errorlevel 1 (
    echo Cannot open application directory.
    pause
    exit /b 1
)
call "%~dp0run_desktop.bat"
exit /b %errorlevel%
