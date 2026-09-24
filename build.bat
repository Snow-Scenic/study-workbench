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

echo [1/2] 正在打包 无控制台桌面 EXE...
rem 桌面版固定使用 Edge WebView2；排除 Anaconda/开发环境中可选的 Qt 后端，避免打入整套 Qt WebEngine。
pyinstaller --noconfirm --clean --windowed --add-data "templates;templates" --add-data "static;static" --add-data "favicon.ico;." --hidden-import requests --hidden-import webview --hidden-import clr_loader --hidden-import pythonnet --exclude-module PyQt5 --exclude-module PyQt6 --exclude-module PySide2 --exclude-module PySide6 --exclude-module qtpy --onefile --name StudyWorkbench.Desktop.v1.3.0 desktop_app.py

if errorlevel 1 (
    echo.
    echo 桌面模式打包失败！请检查错误信息。
    pause
    exit /b 1
)

echo.
echo [2/2] 打包完成！
echo.
echo 生成文件:
echo   桌面原生模式: dist\StudyWorkbench.Desktop.v1.3.0.exe
echo.
echo 注意: 本程序为纯净空壳，不含任何题目数据。
echo       使用时通过界面「导入题库」加载 JSON 文件；
echo       如需预置，可将 JSON 放入 exe 同目录的 question_banks\ 文件夹。
echo       雨课堂真实核心已内置，无需额外下载或放置 yuketang-main 源码。
echo.
echo 桌面原生模式为无控制台窗口发布版，效果与“启动学习工作台(无黑框).vbs”一致。
echo 桌面原生模式需要系统安装 WebView2 Runtime（Win10/11 通常已安装）。
echo.
pause
