# Study Workbench

[简体中文](README.md) | **English**

> A local study platform combining **quiz practice** and a **Yuketang course console**: import JSON question banks to practice, and drive supported Yuketang courses from a web console.
> Runs locally on your machine with no database. **This repository ships with NO question-bank data.** Demo mode is offline; real course mode uses a selected supported Yuketang platform.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

### 📚 Quiz Practice
- **Six question types**: single choice / true-false / multiple choice / matching (click-to-pair) / English single choice with translation
- **Wrong-answer book**: tracks mistake counts per question, filter reviews by error count, auto-removes questions after N consecutive correct answers
- **Progress persistence**: localStorage keeps your history; resume exactly where you left off
- **Statistics panel**: totals, accuracy, wrong-question distribution at a glance
- **Directional slide animations, light & dark themes (paper × ink), keyboard shortcuts (number keys to answer, ← → to navigate)**
- **Analysis panel**: slides out automatically when you answer wrong; manual toggle otherwise

### 🎓 Course Console (Yuketang)
- Configure course credentials → analyze structure → task timeline → multi-threaded execution
- Live progress bars, per-task states (running / done / skipped / stopped / failed), system log terminal
- **Dual mode**: use demo parameters for a full offline simulation, or select Changjiang Yuketang / Nanjing Agricultural University Yuketang for real mode

---

## 🚀 Quick Start

### Option 1: Download the EXE (Windows, recommended)

Download the latest `StudyWorkbench.Desktop.v1.3.0.exe` from [Releases](../../releases). This native desktop build opens only the Study Workbench window — **no command prompt window** — matching the experience of the bundled hidden-window launcher.

> **⚠️ Windows tips**
> - **Move it to a writable folder first** (e.g. `D:\StudyWorkbench\`) before running — imported banks are saved to `question_banks\` next to the exe, which can fail inside `C:\Program Files\` or straight from an un-extracted zip.
> - **SmartScreen notice**: the EXE is not code-signed. On first launch click *More info → Run anyway*.
> - **Desktop runtime**: Microsoft Edge WebView2 Runtime is required; it is normally included with Windows 10/11.
> - **Local data**: first launch creates `study_workbench_data.json` next to the exe for the selected bank, practice history, UI preferences, and course run settings. Imported banks are stored in the neighboring `question_banks\` folder, so both are restored on the next launch.
> - **Credential safety**: Cookie/session fields are memory-only by default. They are written in plain text to that JSON only after you explicitly tick 「记住登录凭据」 (Remember login credentials). Enable it only on your own protected PC; never share or upload the file.

### Option 2: Run from source
```bash
python -m pip install -r requirements.txt
run_desktop.bat                   # Desktop window mode; Python 3.11+
```
For a hidden console, launch the bundled VBS launcher; `run_desktop.bat` is also available. The desktop window uses a local loopback service internally (ports 8001–8009 are tried if busy), but never opens an external browser.

### Importing question banks
> The repository and the app ship **without any question data** — bring your own JSON bank.

1. Click 「📥 导入题库」(Import bank) on the bank-selection screen and pick a JSON file
2. Imported banks are archived to `question_banks/` automatically — they reappear after restart, progress included
3. You can also drop JSON files into `question_banks/` directly and refresh

The in-app 「📋 查看导入格式说明」 explains the format. A complete reference covering **all six question types** lives in [`examples/demo-bank.json`](examples/demo-bank.json) — copy it and make it yours.

---

## 📋 Question bank format

Banks are UTF-8 `.json` files:

```json
{
  "meta": { "name": "My Bank", "version": "1.0" },
  "categories": {
    "key": { "label": "📖 Chapter", "questions": [ … ] }
  }
}
```

| type | Meaning | Required fields | ans format |
|---|---|---|---|
| `single` | Single choice | id, q, opts[] | index of correct option (0-based) |
| `judge` | True/False (Chinese) | id, q, opts[] (two items) | `0` or `1` |
| `TF` | True/False (English) | same as judge | same as judge |
| `multi` | Multiple choice | id, q, opts[] | array of indices, e.g. `[0,2]` |
| `en_single` | English single choice | same as single | same as single |
| `matching` | Matching | id, q, left[], right[], ans[] | `ans[i]` = right-index paired with left item i |

Optional fields on every question: `analysis` (shown when you answer wrong), `memo`, `q_trans`.

Rules: `id` must be unique across the whole bank; invalid questions are skipped; categories without valid questions are dropped.

---

## 🖥️ Screenshots

| Workbench home | Quiz practice |
|---|---|
| ![hub](docs/screenshots/hub.png) | ![quiz](docs/screenshots/quiz-practice.png) |

| Statistics | Wrong-answer review |
|---|---|
| ![stats](docs/screenshots/stats.png) | ![progress](docs/screenshots/progress.png) |

**Course console · setup**

![Course console setup](docs/screenshots/yuketang-config.png)

*(Interface text is Chinese-first; an English UI is on the roadmap.)*

---

## 🗂️ Project layout

```
├── desktop_app.py         # Native desktop entry point (pywebview + WebView2)
├── config.py              # Constants (port 8000, paths, core mode)
├── server.py              # HTTP: pages / bank scan / archive API / Yuketang API
├── templates/             # Page shells (hub / quiz / yuketang console)
├── static/
│   ├── css/               # base(design tokens·themes) → components → pages
│   └── js/                # Front-end modules (state/storage/render/answer/nav/stats…)
├── tests/                 # Python and Node.js regression tests
├── examples/              # demo-bank.json covering every question type
├── build.bat              # packages the windowless desktop EXE
├── run_desktop.bat        # desktop source launcher
├── docs/RELEASE.md        # GitHub Releases checklist
├── CHANGELOG.md           # Changelog
└── LICENSE                # MIT license
```

Runtime folders (git-ignored): `question_banks/`, `dist/`, `build/`.

`build.bat` requires PyInstaller on PATH and produces
`dist\StudyWorkbench.Desktop.v1.3.0.exe` (windowless native desktop mode; requires WebView2 Runtime).
It does not include question data.
See the [release checklist](docs/RELEASE.md) before publishing an asset.

---

## 🎓 Course console attribution

The console is based on **[Gary-666/yuketang](https://github.com/Gary-666/yuketang)** (upstream CLI script),
rebuilt here as a web console (credential setup → task timeline → threaded execution → live logs).

- Real-mode profiles: **Changjiang Yuketang** and **Nanjing Agricultural University Yuketang**. Select a profile in the console; credentials are never sent to arbitrary custom domains.
- Ships with an offline **Mock** demo core; the **real execution core is integrated** and drives the live service when real credentials are provided (`config.CORE_IMPL = 'auto'`)
- The real-mode client is embedded in this project. Source runs and Release EXEs do **not** require an external `yuketang-main\main.py` directory or `YK_REAL_SRC_DIR`. Authentication fields are used only for the current in-memory session; no `.env` file is read.

## 📄 Disclaimer

- Personal study aid only — this project contains and distributes **no** exam or course content
- You are responsible for the origin and licensing of anything you import
- Follow your school's / platform's terms of service; the authors take no liability for misuse

## 📜 Version

See [CHANGELOG.md](CHANGELOG.md). The next planned release is **v1.3.0**, which adds the windowless desktop release artifact.

## 📄 License

Released under the [MIT License](LICENSE).
