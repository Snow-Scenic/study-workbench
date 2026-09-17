# 学习工作台 · Study Workbench

**简体中文** | [English](README.en.md)

> 刷题 + 刷课一体的本地学习平台：导入 JSON 题库即可练习，内置雨课堂课程控制台。
> 本地运行，零依赖数据库，开箱即用。**仓库默认不包含任何题库数据。**

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ 功能总览

### 📚 刷题（题库练习）
- **六种题型**：单选 / 多选 / 中文判断 / 英文判断 / 匹配（点击配对）/ 英语单选
- **错题本**：自动记录错题次数，支持按错误次数筛选复习；连续答对 N 次自动移出
- **进度持久化**：localStorage 保存做题记录，重启后可继续上次进度
- **统计面板**：总题数 / 已做 / 本次正确率 / 错题分布一目了然
- **方向感知切题动画、深浅双主题（宣纸 × 墨夜）、快捷键作答（数字键选option、←→翻页）**
- **解析面板**：答错自动滑出解析/速记/翻译；答对手动展开

### 🎓 刷课（雨课堂控制台）
- 课程参数配置 → 分析课程结构 → 生成任务时间线 → 多线程执行
- 实时进度条、任务状态图例（执行中/完成/跳过/停止/失败）、系统日志
- **双模式**：填入演示参数即离线模拟体验；填真实参数则连接长江雨课堂在线执行（暂只支持长江）
- **真实核心**已集成并经实测验证（视频心跳/图文打卡/多线程并发）

---

## 🚀 快速开始

### 方式一：下载 EXE（Windows，推荐）

前往 [Releases](../../releases) 下载最新的 `StudyWorkbench.Desktop.v1.3.0.exe`。这是原生桌面版：双击后只显示学习工作台窗口，**不会出现命令行黑框**，体验与“启动学习工作台(无黑框).vbs”一致。

> **⚠️ Windows 使用提示**
> - **先选好可写目录**：把 exe 移动到独立文件夹（如 `D:\StudyWorkbench\`）再运行——导入的题库存放在同目录的 `question_banks\`，放在 `C:\Program Files\` 或直接在压缩包里运行可能创建失败。
> - **SmartScreen 警告**：exe 未做代码签名，首次运行请点「更多信息 → 仍要运行」。
> - **桌面运行环境**：桌面版依赖 Microsoft Edge WebView2 Runtime；Windows 10/11 通常已自带。
> - **本地数据**：题库、窗口尺寸和练习进度都保留在本机；发布附件不包含任何题库或课程凭据。

如需浏览器模式，可使用 `StudyWorkbench.v1.3.0.exe`；它会打开默认浏览器，适合不使用桌面窗口的场景。

### 方式二：Python 源码运行
```bash
python -m pip install -r requirements.txt
python main.py      # 浏览器模式，需 Python 3.11+
```

启动后浏览器自动打开 `http://localhost:8000`（端口占用时自动尝试 8001~8009）。如需从源码启动原生桌面窗口，可双击“启动学习工作台(无黑框).vbs”，或运行 `run_desktop.bat`。

桌面启动器统一按以下顺序选择 Python：`STUDY_WORKBENCH_PYTHON` 环境变量 → `desktop-python.txt` 第一行 → `.venv\Scripts\python.exe` → PATH。请确保选中的解释器安装了 `requirements.txt` 中的依赖；`desktop-python.txt` 填完整路径、不带引号，仅保留本机。可运行 `run_desktop.bat --check` 检查解释器与依赖（不启动窗口）。

### 导入题库
> 仓库与程序默认**不带任何题库**，请使用自己的 JSON 题库文件。

1. 在题库选择页点「📥 导入题库」，选择 JSON 题库文件
2. 导入成功后自动存档副本到 `question_banks/` —— **下次启动免重复导入**，做题进度自动恢复
3. 也可以直接把 JSON 放进 `question_banks/` 目录后刷新

JSON 题库格式见界面内「📋 查看导入格式说明」，也可以直接参照仓库自带的测试题 **[`examples/demo-bank.json`](examples/demo-bank.json)** —— 它覆盖了全部六种题型与可选字段，复制修改即可变成你自己的题库。

---

## 📋 题库格式

题库为 UTF-8 编码的 `.json` 文件，顶层结构：

```json
{
  "meta": { "name": "我的题库", "version": "1.0" },
  "categories": {
    "分类key": { "label": "📖 分类显示名", "questions": [ "…题目…" ] }
  }
}
```

### 六种题型

| type 关键字 | 题型 | 题目必填字段 | ans 格式 |
|---|---|---|---|
| `single` | 单选题 | id, q, opts[] | 正确项下标（从 0 开始），如 `1` |
| `judge` | 判断题 | id, q, opts[]（两项） | `0` 或 `1`（如 ["正确","错误"]） |
| `TF` | True/False（英文判断） | 同 judge | 同 judge |
| `multi` | 多选题 | id, q, opts[] | 下标数组，如 `[0,2]` |
| `en_single` | 英语单选 | 同 single | 同 single |
| `matching` | 匹配题 | id, q, left[], right[], ans[] | `ans[i]` = 左第 i 项对应的右项下标 |

**所有题型通用可选字段**：

| 字段 | 用途 |
|---|---|
| `analysis` | 解析——答错自动弹出，答对可手动查看 |
| `memo` | 速记口诀 |
| `q_trans` | 中文翻译（英语题目适用） |

**公共规则**：`id` 全库唯一；缺必填字段的题目会被跳过；某分类无有效题目则整类跳过。

> 💡 把 `examples/demo-bank.json` 复制到 `question_banks/` 文件夹（没有就手动创建），重启程序即可直接体验这份覆盖全部题型的演示库。

### 构建 EXE（维护者）
```bash
python -m pip install pyinstaller
build.bat
```

产物：`dist\StudyWorkbench.v1.3.0.exe`（浏览器模式）与 `dist\StudyWorkbench.Desktop.v1.3.0.exe`（无控制台窗口的桌面原生模式，需 WebView2 Runtime）。两者均为纯净空壳，不含题目数据。

发布 GitHub Releases 前请参阅 [发布清单](docs/RELEASE.md)。

---

## 🖥️ 页面预览

**🏠 学习工作台** —— 最近练习、当前题库与常用功能入口

![学习工作台](docs/screenshots/hub.png)

**✍️ 刷题 · 答题与解析** —— 作答后即时展示正误、正确答案与解析速记

![刷题与解析](docs/screenshots/quiz-practice.png)

**📊 详细统计** —— 正确率 / 错题分布一目了然

![详细统计](docs/screenshots/stats.png)

**📌 错题复习** —— 按错误次数筛选复习范围，集中巩固薄弱题目

![错题复习范围](docs/screenshots/progress.png)

**🎓 课程控制台** —— 参数配置、状态概览与操作指引

![刷课配置](docs/screenshots/yuketang-config.png)

---

## 🗂️ 项目结构

```
├── main.py                # 浏览器模式入口：启动 HTTP 服务 + 自动打开浏览器
├── desktop_app.py         # 原生桌面模式入口（pywebview + WebView2）
├── config.py              # 配置常量（端口 8000、目录、雨课堂核心模式）
├── server.py              # HTTP 服务：页面路由 / 题库扫描 / 存档 API / 雨课堂 API
├── templates/             # 页面外壳（工作台 hub / 刷题 quiz / 刷课 yuketang）
├── static/
│   ├── css/               # base(设计令牌·主题) → components(组件) → pages(页面)
│   └── js/                # 前端逻辑模块（状态/存储/渲染/答题/导航/统计…）
├── tests/                 # Python 与 Node.js 回归测试
├── examples/              # 示例题库（覆盖全部题型，可复制修改）
├── build.bat              # 一键打包浏览器版与无控制台桌面版 EXE
├── run_desktop.bat        # 源码桌面版启动器
├── 启动学习工作台(无黑框).vbs # 无命令行窗口的源码桌面版启动器
├── docs/RELEASE.md        # GitHub Releases 发布清单
└── CHANGELOG.md           # 版本变更
```

> 运行后会生成 `question_banks/`（你的题库存放处）等目录，已在 `.gitignore` 中排除。

---

## 🎓 刷课模块来源与说明

刷课（雨课堂控制台）模块基于开源项目 **[Gary-666/yuketang](https://github.com/Gary-666/yuketang)** 修改集成：
重构了其命令行交互为 Web 控制台（参数配置 → 任务时间线 → 多线程执行 → 系统日志），
并接入离线演示核心用于安全调试。

- ⚠️ **暂只支持长江雨课堂**，其他平台接口未适配
- 当前 `config.py → CORE_IMPL = "auto"` 智能路由：`classroom_id` 命中演示哨兵
  （`demo*` / `111` / `test` / `000`）→ 离线 `Mock` 演示核心，全流程离线模拟、
  不产生真实网络请求；**其他参数将直接连接长江雨课堂在线执行**，请确认你有权
  操作对应课程后再使用，勿在日志或截图中公开凭据
- 外部刷课源码（`yuketang-main\`，含 `main.py`）默认放置在 **程序目录的上一级目录**：
  - 源码运行：仓库父目录，即与 `study-workbench-main\` 同级；
  - 打包版：`config.py` 以 exe 所在目录为 `BASE_DIR`，查找其**父目录**下的
    `yuketang-main\`。例如 exe 位于 `D:\StudyWorkbench\app.exe`，默认源码目录是
    `D:\yuketang-main\`，并非 `D:\StudyWorkbench\yuketang-main\`。
    也可以用环境变量 `YK_REAL_SRC_DIR` 直接指定源码目录覆盖默认查找。

## 📄 免责声明

- 本项目仅为**个人学习辅助工具**，本身不包含、不分发任何试题、课程或教学资源
- 你通过「导入题库」等功能添加的一切内容，来源与版权合法性由你本人负责
- 请遵守所在学校 / 平台的服务条款，因使用本项目产生的任何责任与开发者无关

## 📜 版本

当前源码版本为 **v1.3.0**，包含无控制台桌面入口。变更见 [CHANGELOG.md](CHANGELOG.md)；源码上传范围与 EXE 构建、验收步骤见 [发布清单](docs/RELEASE.md)。

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。
