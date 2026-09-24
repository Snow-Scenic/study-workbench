# 学习工作台 · Study Workbench

**简体中文** · [English](README.en.md)

面向雨课堂课程进度管理的 Windows 桌面工具。已验证可使用真实账号接入「长江雨课堂」与「南京农业大学雨课堂」，完成课程结构分析、任务查看与进度执行；另附带本地题库练习、错题复习和统计功能。

> **真实接入平台：长江雨课堂、南京农业大学雨课堂。** 请在程序中选择与你账号所属平台一致的选项；两个平台的参数与 Cookie 获取位置不同，以页面内提示为准。

![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D4?logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-2ea44f)

![雨课堂课程控制台参数配置](docs/screenshots/yuketang-config.png)

## 功能一览

| 模块 | 能力 |
| --- | --- |
| 雨课堂课程控制台 | 已验证真实接入长江雨课堂、南京农业大学雨课堂；课程结构分析、任务时间线、进度状态与本地日志；支持离线演示 |
| 题库练习 | 单选、多选、判断、英语单选、匹配题；键盘作答与解析面板 |
| 错题复习 | 自动累计错误次数，按范围筛选；连续答对后可自动移出 |
| 数据统计 | 覆盖率、正确率、题型掌握度与错题分布 |
| 本地存档 | 导入题库、做题记录、界面偏好和运行参数可在下次启动恢复 |

## 快速开始

### Windows EXE（推荐）

从 [Releases](../../releases) 下载 `StudyWorkbench.Desktop.v1.3.0.exe`，放到单独的可写目录后双击运行。

- 只显示应用窗口，不会出现命令行黑框
- 无需安装 Python；需要 Microsoft Edge WebView2 Runtime（Windows 10/11 通常已包含）
- 首次启动会在 EXE 同目录创建 `study_workbench_data.json` 和 `question_banks\`，用于保存本地数据
- EXE 未签名时，Windows 可能显示 SmartScreen 提示；请仅从可信 Release 下载并核对校验值

> 不要在压缩包内或 `C:\Program Files\` 下直接运行；这类目录可能无法创建本地数据文件。

### 使用雨课堂课程控制台

1. 打开应用中的「课程控制台」，在「平台」中选择「长江雨课堂」或「南京农业大学雨课堂」。
2. 按右侧的对应平台提示，从课程页面和浏览器 Cookie 中填写课程参数；两个平台的填写内容不能混用。
3. 点击「分析课程结构」，确认课程任务后再开始执行。任务状态和运行日志会显示在控制台内。

> `demo*`、`111`、`test`、`000` 等演示课堂 ID 只会执行离线模拟；要连接真实课程，请填写实际课程参数。请仅操作自己有权限访问的课程，并遵守学校和平台规则。

### 源码运行

```powershell
python -m pip install -r requirements.txt
run_desktop.bat
```

也可以双击 [启动学习工作台(无黑框).vbs](启动学习工作台(无黑框).vbs)。启动器按以下顺序选择 Python：`STUDY_WORKBENCH_PYTHON` → `desktop-python.txt` → `.venv\Scripts\python.exe` → PATH。使用 `run_desktop.bat --check` 可只检查解释器和依赖。

## 附加功能：导入题库

1. 打开「题库管理」，点击「导入题库」并选择 UTF-8 JSON 文件。
2. 程序会将题库副本保存至 `question_banks\`；下次启动无需重复导入。
3. 可从 [`examples/demo-bank.json`](examples/demo-bank.json) 开始。它覆盖全部支持题型，适合复制后改成自己的题库。

```json
{
  "meta": { "name": "我的题库", "version": "1.0" },
  "categories": {
    "chapter-1": { "label": "第一章", "questions": [] }
  }
}
```

支持的 `type`：`single`、`multi`、`judge`、`TF`、`en_single`、`matching`。每题 `id` 必须全库唯一；可选字段 `analysis`、`memo`、`q_trans` 分别用于解析、速记和翻译。

## 题库练习界面

![作答与解析界面](docs/screenshots/quiz-practice.png)

## 本地数据与隐私

- 默认不保存 Cookie、会话 ID 等认证字段；它们只在当前运行中使用。
- 只有手动勾选「记住登录凭据」后，认证字段才会以明文写入 `study_workbench_data.json`。仅应在受保护的个人电脑启用，切勿提交、分享或上传该文件。
- `question_banks/`、`study_workbench_data.json`、日志、构建产物和本机 Python 配置均被 `.gitignore` 排除。

## 课程控制台说明

课程控制台改造自 [Gary-666/yuketang](https://github.com/Gary-666/yuketang) 的命令行项目，并在本项目中内置运行所需的客户端逻辑；源码运行和 Release EXE 都不需要额外下载 `main.py` 或配置 `.env`。

- 演示课堂 ID（如 `demo*`、`111`、`test`、`000`）始终走离线模拟，不会发起真实请求。
- 非演示课堂会按所选平台以真实账号参数连接；认证信息只会发往这两个受支持的平台。
- 请自行确认拥有课程访问权限，并遵守学校和平台规则。请勿在截图、Issue 或日志中公开 Cookie。

## 开发说明与已知限制

本项目使用 **Vibe Coding** 辅助开发与迭代。虽然已包含自动化测试，但不同 Windows、WebView2、网络环境及课程平台接口可能存在兼容问题，也仍可能出现功能或界面 Bug。

遇到问题时，建议在 [Issues](../../issues) 中说明复现步骤、应用版本、系统版本和不含凭据的错误截图；请不要上传 Cookie、会话 ID、题库或个人课程信息。

## 开发与发布

```powershell
python -m pip install pyinstaller
build.bat
```

产物为 `dist\StudyWorkbench.Desktop.v1.3.0.exe`。发布前请按 [Release 发布清单](docs/RELEASE.md) 在独立可写目录中验证 EXE、导入演示题库并检查附件不含本地数据。

## 项目结构

```text
├── desktop_app.py          # Windows 桌面入口（pywebview + WebView2）
├── server.py               # 本地 HTTP 服务与 API
├── portable_state.py       # EXE 同目录的便携数据读写
├── yuketang_core.py        # 课程任务状态与演示核心
├── yuketang_adapter.py     # 平台适配层
├── yuketang_native.py      # 内置课程 HTTP 客户端
├── templates/              # 题库工作台与课程控制台页面
├── static/                 # 样式与前端交互脚本
├── examples/               # 公开演示题库
├── tests/                  # 回归测试
└── docs/                   # 截图与 Release 说明
```

## 许可证

本项目基于 [MIT License](LICENSE) 发布。导入的题库、课程资料及账号数据由使用者自行负责其来源、权限和合规性。
