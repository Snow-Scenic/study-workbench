# 学习工作台 · Study Workbench

> 刷题 + 刷课一体的本地学习平台：导入 JSON 题库即可练习，内置雨课堂课程控制台。
> 纯本地运行，零依赖数据库，开箱即用。**仓库默认不包含任何题库数据。**

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ 功能总览

### 📚 刷题（题库练习）
- **多题型**：单选 / 多选 / 不定项 / 判断 / 匹配（点击配对）/ 英语句意翻译
- **错题本**：自动记录错题次数，支持按错误次数筛选复习；连续答对 N 次自动移出
- **进度持久化**：localStorage 保存做题记录，重启后可继续上次进度
- **统计面板**：总题数 / 已做 / 本次正确率 / 错题分布一目了然
- **方向感知切题动画、深浅双主题（宣纸 × 墨夜）、快捷键作答（数字键选option、←→翻页）**
- **解析面板**：答错自动滑出解析/速记/翻译；答对手动展开

### 🎓 刷课（雨课堂控制台）
- 课程参数配置 → 分析课程结构 → 生成任务时间线 → 多线程执行
- 实时进度条、任务状态图例（执行中/完成/跳过/停止/失败）、系统日志
- **当前为离线演示模式（Mock）**：全流程模拟、不访问真实网络

---

## 🚀 快速开始

### 方式一：下载 EXE（Windows）
前往 [Releases](../../releases) 页面下载最新附件 `StudyWorkbench-v1.2-windows-x64.exe`，双击即可运行。

### 方式二：Python 源码运行
```bash
python main.py      # 需 Python 3.11+
```
启动后浏览器自动打开 `http://localhost:8000`（端口占用时自动尝试 8001~8009）。

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

### 打包 EXE（可选）
```bash
build.bat           # 需已安装 PyInstaller（pip install pyinstaller）
```
产物：`dist\学习工作台.exe`（纯净空壳，不含任何题目数据）。

---

## 🖥️ 页面预览

**🏠 学习工作台** —— 启动首页，刷题 / 刷课双入口

![学习工作台](docs/screenshots/hub.png)

**✍️ 刷题 · 答题与解析** —— 答错自动滑出解析面板，正确答案高亮

![刷题与解析](docs/screenshots/quiz-practice.png)

**📊 详细统计** —— 正确率 / 错题分布一目了然

![详细统计](docs/screenshots/stats.png)

**📌 断点续刷** —— 重启后自动发现历史进度，选择继续或重来

![断点续刷](docs/screenshots/progress.png)

**🎓 刷课 · 课程配置** —— 参数配置 + 操作指引 + 状态图例

![刷课配置](docs/screenshots/yuketang-config.png)

**🎮 刷课 · 执行控制台** —— 任务时间线 + 实时进度 + 多线程执行

![执行控制台](docs/screenshots/yuketang-console.png)

---

## 🗂️ 项目结构

```
├── main.py                # 主入口：启动 HTTP 服务 + 自动打开浏览器
├── config.py              # 配置常量（端口 8000、目录、雨课堂核心模式）
├── server.py              # HTTP 服务：页面路由 / 题库扫描 / 存档 API / 雨课堂 API
├── templates/             # 页面外壳（工作台 hub / 刷题 quiz / 刷课 yuketang）
├── static/
│   ├── css/               # base(设计令牌·主题) → components(组件) → pages(页面)
│   └── js/                # 前端逻辑模块（状态/存储/渲染/答题/导航/统计…）
├── tests/                 # pytest 后端测试（28 用例）
├── examples/              # 示例题库（覆盖全部题型，可复制修改）
├── CHANGELOG.md           # 版本变更（当前 v1.2）
└── 学习工作台.spec         # PyInstaller 打包配置
```

> 运行后会生成 `question_banks/`（你的题库存放处）等目录，已在 `.gitignore` 中排除。

---

## 🎓 刷课模块来源与说明

刷课（雨课堂控制台）模块基于开源项目 **[Gary-666/yuketang](https://github.com/Gary-666/yuketang)** 修改集成：
重构了其命令行交互为 Web 控制台（参数配置 → 任务时间线 → 多线程执行 → 系统日志），
并接入离线演示核心用于安全调试。

- ⚠️ **暂只支持长江雨课堂**，其他平台接口未适配
- 当前版本默认运行在 `Mock` 演示模式下（`config.py → CORE_IMPL`），
  全流程离线模拟、不产生真实网络请求；真实执行核心为后续版本规划

## 📄 免责声明

- 本项目仅为**个人学习辅助工具**，本身不包含、不分发任何试题、课程或教学资源
- 你通过「导入题库」等功能添加的一切内容，来源与版权合法性由你本人负责
- 请遵守所在学校 / 平台的服务条款，因使用本项目产生的任何责任与开发者无关

## 📜 版本

查看 [CHANGELOG.md](CHANGELOG.md)。当前版本 **v1.2**（2026-08-23）。

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。
