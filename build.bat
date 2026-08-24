@echo off
chcp 65001 >nul
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

echo [1/2] 正在打包 EXE...
pyinstaller --noconfirm --clean --add-data "templates;templates" --add-data "static;static" --add-data "favicon.ico;." --hiddenimports requests --onefile --name StudyWorkbench main.py

if errorlevel 1 (
    echo.
    echo 打包失败！请检查错误信息。
    pause
    exit /b 1
)

echo.
echo [2/2] 打包完成！
echo.
echo 生成文件: dist\StudyWorkbench.exe
echo.
echo 注意: 本程序为纯净空壳，不含任何题目数据。
echo       使用时通过界面「导入题库」加载 JSON 文件；
echo       如需预置，可将 JSON 放入 exe 同目录的 question_banks\ 文件夹。
echo       刷课真实模式需要同级目录存在 yuketang-main\main.py（见 README）。
echo.
pause
