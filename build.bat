@echo off
chcp 65001 >nul
cd /d "%~dp0"
if errorlevel 1 exit /b 1
echo ==============================
echo   学习工作台 - 打包脚本
echo ==============================
echo.

where pyinstaller >nul 2>nul
if errorlevel 1 (
    echo 未找到 PyInstaller，请先安装：
    echo   pip install pyinstaller
    pause
    exit /b 1
)

echo [1/3] 正在打包 浏览器模式 EXE...
pyinstaller --noconfirm --clean --add-data "templates;templates" --add-data "static;static" --add-data "favicon.ico;." --hidden-import requests --onefile --name StudyWorkbench.v1.3.0 main.py

if errorlevel 1 (
    echo.
    echo 浏览器模式打包失败！请检查错误信息。
    pause
    exit /b 1
)

echo.
echo [2/3] 正在打包 无控制台桌面 EXE...
pyinstaller --noconfirm --clean --windowed --add-data "templates;templates" --add-data "static;static" --add-data "favicon.ico;." --hidden-import requests --hidden-import webview --hidden-import clr_loader --hidden-import pythonnet --onefile --name StudyWorkbench.Desktop.v1.3.0 desktop_app.py

if errorlevel 1 (
    echo.
    echo 桌面模式打包失败！请检查错误信息。
    pause
    exit /b 1
)

echo.
echo [3/3] 打包完成！
echo.
echo 生成文件:
echo   浏览器模式: dist\StudyWorkbench.v1.3.0.exe
echo   桌面原生模式: dist\StudyWorkbench.Desktop.v1.3.0.exe
echo.
echo 注意: 本程序为纯净空壳，不含任何题目数据。
echo       使用时通过界面「导入题库」加载 JSON 文件；
echo       如需预置，可将 JSON 放入 exe 同目录的 question_banks\ 文件夹。
echo       外部源码默认路径: EXE 所在目录的父目录\yuketang-main\main.py（见 README）。
echo.
echo 桌面原生模式为无控制台窗口发布版，效果与“启动学习工作台(无黑框).vbs”一致。
echo 桌面原生模式需要系统安装 WebView2 Runtime（Win10/11 通常已安装）。
echo.
pause
