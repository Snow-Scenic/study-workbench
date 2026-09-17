@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if errorlevel 1 exit /b 1
if not exist "%~dp0desktop_app.py" (
    echo Missing desktop_app.py.
    if /i not "%~1"=="--silent" pause
    exit /b 1
)
rem Priority: explicit environment override, local configuration, project venv, PATH.
if not defined STUDY_WORKBENCH_PYTHON if exist "%~dp0desktop-python.txt" set /p "STUDY_WORKBENCH_PYTHON=" < "%~dp0desktop-python.txt"
if not defined STUDY_WORKBENCH_PYTHON if exist "%~dp0.venv\Scripts\python.exe" set "STUDY_WORKBENCH_PYTHON=%~dp0.venv\Scripts\python.exe"
if not defined STUDY_WORKBENCH_PYTHON set "STUDY_WORKBENCH_PYTHON=python.exe"
echo Python: %STUDY_WORKBENCH_PYTHON%
"%STUDY_WORKBENCH_PYTHON%" -c "import requests, webview, clr_loader, pythonnet" > "%~dp0desktop_startup.log" 2>&1
if errorlevel 1 (
    echo Desktop dependency check failed. See desktop_startup.log.
    echo Set STUDY_WORKBENCH_PYTHON or desktop-python.txt to a Python environment with desktop dependencies.
    type "%~dp0desktop_startup.log"
    if /i not "%~1"=="--silent" pause
    exit /b 1
)
if /i "%~1"=="--check" exit /b 0
rem Keep the console attached so even early import failures are visible.
"%STUDY_WORKBENCH_PYTHON%" "%~dp0desktop_app.py"
if errorlevel 1 (
    echo Startup failed. Check the output above and error.log.
    if /i not "%~1"=="--silent" pause
    exit /b 1
)
exit /b 0
