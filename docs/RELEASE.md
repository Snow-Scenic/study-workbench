# GitHub Releases 发布清单

本文档用于发布 Windows 桌面版，不包含题库或任何课程凭据。

## 推荐附件

上传 `dist\StudyWorkbench.Desktop.v1.3.0.exe`。

这是原生桌面版：双击后只显示学习工作台窗口，不显示命令行窗口，体验与项目中的“启动学习工作台(无黑框).vbs”一致。它需要 Windows 10/11 的 Microsoft Edge WebView2 Runtime；多数系统已自带。

`dist\StudyWorkbench.v1.3.0.exe` 是浏览器模式，会启动默认浏览器，不建议作为唯一 Releases 附件。

## 构建

在 Windows 的项目根目录执行：

```bat
python -m pip install -r requirements.txt
python -m pip install pyinstaller
build.bat
```

构建后先在 `dist\` 中双击桌面版 EXE。确认能正常打开、切换题库页面和关闭窗口后，再上传附件。

## 发布前检查

- 不要将 `question_banks\`、`.window_state.json`、`desktop-python.txt`、日志或本地题目数据提交或上传。
- Releases 附件应在独立、可写的文件夹中测试；不要直接在压缩包内运行。
- 未签名 EXE 首次运行可能被 SmartScreen 提示，需要用户自行确认“更多信息 → 仍要运行”。
- 演示参数完全离线；使用真实课程参数前，请确认符合课程平台和学校的规定。

## 建议的 Release 文案

```text
Windows 桌面版（无命令行窗口）。

下载后解压到可写目录再运行。程序不附带题库；可在界面中导入自己的 JSON 题库。
```
