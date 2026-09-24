# Study Workbench

[简体中文](README.md) · **English**

A Windows desktop tool centered on Yuketang course-progress management. It has been verified with real-account access to Changjiang Yuketang and Nanjing Agricultural University Yuketang for course analysis, task inspection, and progress execution. Local question-bank practice, mistake review, and statistics are included as companion features.

> **Verified real-access platforms: Changjiang Yuketang and Nanjing Agricultural University Yuketang.** Select the platform that matches your account in the application. The required parameters and where to obtain cookies differ between the platforms; follow the platform-specific guidance in the interface.

The project ships with no question-bank data, course material, or account data.

![Yuketang course console configuration](docs/screenshots/yuketang-config.png)

## Highlights

| Feature | What it does |
| --- | --- |
| Yuketang course console | Verified for real-account access to Changjiang Yuketang and Nanjing Agricultural University Yuketang; provides course analysis, task progress, logs, and an offline demonstration flow. |
| Question practice | Supports single-choice, multiple-choice, true/false, English single-choice, and matching questions. |
| Mistake review | Saves incorrect answers locally for focused review and retry. |
| Statistics | Shows accuracy, practice volume, and recent learning activity. |
| Local persistence | Keeps imported question banks, practice history, and preferences beside the application. |

## Quick start

### Windows EXE — recommended

Download the latest `StudyWorkbench.Desktop.*.exe` from [Releases](../../releases), then double-click it.

- It opens the application directly, without a command window.
- Python, Node.js, and a development environment are not required.
- On first launch, it creates `study_workbench_data.json` and `question_banks\` beside the EXE for local data.
- Move or back up the EXE together with those files to retain your study history.

### Use the Yuketang course console

1. Open **Course Console** and choose either **Changjiang Yuketang** or **Nanjing Agricultural University Yuketang** in the platform selector.
2. Follow the platform-specific panel to provide course parameters from the course page and browser cookies. Do not mix parameters from the two platforms.
3. Select **Analyze course structure**, review the detected tasks, then start execution. Task status and logs are displayed in the console.

> Demo classroom IDs such as `demo*`, `111`, `test`, and `000` only run the offline simulation. Use real course parameters to connect to a real course. Only operate courses you are authorized to access and comply with school and platform rules.

### Run from source

```powershell
python -m pip install -r requirements.txt
.\run_desktop.bat
```

The desktop interface requires Microsoft Edge WebView2 Runtime, which is normally included with current Windows installations.

## Companion feature: import a question bank

Use **Question Bank → Import** in the application and select a JSON file. A minimal item looks like this:

```json
{
  "meta": { "name": "My bank", "version": "1.0" },
  "categories": {
    "chapter-1": { "label": "Chapter 1", "questions": [] }
  }
}
```

Start with the public [example question bank](examples/demo-bank.json), which covers the supported question types and can be copied as a template.

## Question practice

![Question practice](docs/screenshots/quiz-practice.png)

## Local data and privacy

All study data is stored locally by default. The desktop build writes `study_workbench_data.json` and `question_banks\` beside the EXE.

If you use the course console, its parameters are only used to connect to the course platform you choose. Do not share cookies, session IDs, imported question banks, or private course information in issues, screenshots, or commits.

## Course console attribution

The Yuketang integration is based on the request flow and platform adaptation ideas from [Gary-666/yuketang](https://github.com/Gary-666/yuketang). Follow the upstream project's license and applicable platform rules when using that integration.

Demo classroom IDs (such as `demo*`, `111`, `test`, and `000`) always use the offline simulation and make no real requests. Other classroom IDs connect with the supplied real-account parameters only to the selected supported platform.

## Development notes and known limitations

This project was developed and iterated with **Vibe Coding** assistance. Automated tests are included, but compatibility differences across Windows, WebView2, networks, and course-platform APIs may still cause functional or visual bugs.

When reporting an issue, include reproduction steps, application version, Windows version, and a screenshot with credentials removed in [Issues](../../issues). Never upload cookies, session IDs, question banks, or personal course data.

## Build a release EXE

```powershell
python -m pip install pyinstaller
.\build.bat
```

The script creates a windowed, portable EXE in `dist`. Run it from a new writable folder before publishing, and follow the [release checklist](docs/RELEASE.md).

## Project layout

```text
desktop_app.py              Desktop entry point
templates/                  Application interface
static/                     Styles and browser-side scripts
yuketang_adapter.py         Course-platform adapter
yuketang_native.py          Native course-platform client
tests/                      Automated tests
docs/                       Documentation and screenshots
build.bat                    Windows release build script
```

## License

See [LICENSE](LICENSE).
