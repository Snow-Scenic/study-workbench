# GitHub 源码与 Windows Release 发布清单

## 1. 上传 GitHub 的内容

通过 Git 推送源码，不要把整个工作目录直接压缩上传。

| 保留内容 | 用途 |
| --- | --- |
| 根目录 Python 文件、`requirements.txt` | 应用入口、服务与课程适配模块 |
| `static/`、`templates/`、`favicon.ico` | 运行时必需的界面资源 |
| `run_desktop.bat`、两个中文启动器、`build.bat` | 源码启动与构建 |
| `tests/` | 回归测试，不要因“精简核心”而删除 |
| `examples/demo-bank.json` | 可公开的格式演示，不是用户题库 |
| README、中英文说明、`CHANGELOG.md`、`LICENSE`、`docs/` | 使用说明、许可证、截图与发布清单 |

以下内容只留在本机，由 `.gitignore` 排除：`question_banks/`、`desktop-python.txt`、`.window_state.json`、虚拟环境、`.env`、日志、缓存、编辑器设置、`design-output/`、`build/`、`dist/`。

忽略规则不会移除已跟踪文件。提交前执行 `git status --short`、`git diff --cached --stat`，并确认没有用户题库、Cookie、课程凭据或本机绝对路径。截图也需要人工确认无敏感内容。

## 2. 推荐 Release 附件

只上传 **`dist\StudyWorkbench.Desktop.v1.3.0.exe`** 即可。

- 原生桌面窗口，无命令行黑框，效果类似“启动学习工作台(无黑框).vbs”。“无窗口”在此指无控制台，不是后台无界面运行。
- 用户无需安装 Python，也不需要源码、VBS 或 `desktop-python.txt`。
- 需要 Windows 的 Microsoft Edge WebView2 Runtime；缺失时请安装微软官方运行时。
- 不包含用户题库；雨课堂真实核心已内嵌，不需要额外的课程源码目录。
- 首次运行会在 EXE 同目录生成 `study_workbench_data.json`，存放题库选择、练习历史、偏好和课程运行参数；导入题库保存在同目录 `question_banks\`。两者都属于用户本地数据，不应作为 Release 附件上传。
- Cookie/会话值默认不保存。用户手动勾选「记住登录凭据」后，凭据会明文写入 `study_workbench_data.json`；发布者和用户均不应分享、提交或上传该文件。

## 3. 使用同一个 Python 安装依赖并构建

在 Windows 项目根目录打开 PowerShell。选择干净的构建环境，不要混用 PATH 中另一个 Python 的 PyInstaller：

```powershell
python -m venv .venv
$python = '.\.venv\Scripts\python.exe'
& $python -m pip install -r requirements.txt
& $python -m pip install pyinstaller
& $python -m PyInstaller --noconfirm --clean --windowed --onefile --name StudyWorkbench.Desktop.v1.3.0 --icon favicon.ico --add-data 'templates;templates' --add-data 'static;static' --add-data 'favicon.ico;.' --hidden-import requests --hidden-import webview --hidden-import clr_loader --hidden-import pythonnet --exclude-module PyQt5 --exclude-module PyQt6 --exclude-module PySide2 --exclude-module PySide6 --exclude-module qtpy desktop_app.py
```

也可以将 `$python` 设为已安装桌面依赖的解释器完整路径。关键是安装与构建均使用 `& $python -m ...`。源码启动器支持在 `desktop-python.txt` 第一行填入该路径（不带引号）；这个文件只用于本机，不要提交。

`build.bat` 仅构建桌面模式，但它使用 PATH 上的 PyInstaller；执行前必须激活正确环境。桌面版固定使用 Edge WebView2，构建命令会排除可选 Qt 后端，避免把开发环境中的整套 Qt WebEngine 误打进 Release。

## 4. 独立验证后再上传

源码窗口成功不等于打包 EXE 成功。本次整理不代表二进制已构建或验收。

1. 将生成的桌面 EXE 复制到一个独立、可写的空文件夹，不能依赖仓库旁边的文件。
2. 双击：确认只有应用窗口，没有命令行黑框，也没有 DLL/模块缺失弹窗。
3. 从界面导入 `examples/demo-bank.json`，验证加载、答题、统计、关闭和再次打开；确认 EXE 同目录已生成 `question_banks\` 和 `study_workbench_data.json`，且历史记录可恢复。
4. 检查目标 Windows 架构与 WebView2 环境；不要直接在压缩包内运行。
5. 确认附件不包含测试时生成的题库、窗口状态、日志或任何凭据。
6. 可执行 `Get-FileHash .\dist\StudyWorkbench.Desktop.v1.3.0.exe -Algorithm SHA256`，把校验值放入 Release 说明。

未签名 EXE 可能触发 SmartScreen。应先核对下载来源与校验值，再决定是否运行，不要关闭系统安全防护。

## 5. 提交、标签与 GitHub Release

现有本地 `v1.3.0` 标签指向之前的存档提交。本轮整理不会自动移动标签或推送远端。如果希望正式 v1.3.0 包含后续整理，发布前需明确选定最终提交和标签，不要悄悄覆盖已经公开的标签。

先审阅并提交源码，再推送所需分支与版本标签。在 GitHub 的 Releases 页面选择对应标签，添加桌面 EXE 附件；EXE 不要提交进 Git 历史。GitHub 会自动提供该标签的源码压缩包。

建议 Release 文案（完成独立验证后使用）：

```text
Study Workbench v1.3.0 · Windows 桌面版

下载 StudyWorkbench.Desktop.v1.3.0.exe，放在可写目录运行。
仅显示学习工作台窗口，无命令行黑框；无需安装 Python。
需要 Microsoft Edge WebView2 Runtime。
不附带用户题库，可在界面导入 JSON；格式演示见源码 examples/。
真实课程功能已内嵌；认证字段仅用于当前内存会话。
```
