"""Offline packaging contracts. Never run PyInstaller, GUI, sockets or upstream core."""
import ast
import os
from pathlib import Path
import sys
import types

import pytest

ROOT = Path(__file__).resolve().parents[1]


def test_build_contract():
    script = text('build.bat')
    assert '--hiddenimports' not in script
    assert script.count('--hidden-import ') == 5
    assert 'cd /d "%~dp0"' in script
    for name in ['StudyWorkbench.v1.3.0', 'StudyWorkbench.Desktop.v1.3.0']:
        assert '--name ' + name + ' ' in script
        for doc in ['README.md', 'README.en.md']:
            assert 'dist\\' + name + '.exe' in text(doc)
    desktop_build = script.split('StudyWorkbench.Desktop.v1.3.0', 1)[0]
    assert '--windowed' in desktop_build


def test_main_loopback_binding():
    tree = ast.parse(text('main.py'))
    calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and
             isinstance(n.func, ast.Attribute) and n.func.attr == 'ThreadingTCPServer']
    assert len(calls) == 1
    assert calls[0].args[0].elts[0].value == '127.0.0.1'


def test_launchers_portable_contract():
    for name in ['run_desktop.bat', '启动桌面版.bat', '启动学习工作台(无黑框).vbs']:
        assert 'Anaconda_envs' not in text(name)
    bat = text('run_desktop.bat')
    # Keep environment selection explicit; PATH pythonw may belong to another env.
    assert 'where pythonw.exe' not in bat
    choices = ['desktop-python.txt', '.venv\\Scripts\\python.exe',
               'set "STUDY_WORKBENCH_PYTHON=python.exe"']
    assert [bat.index(choice) for choice in choices] == sorted(bat.index(choice) for choice in choices)
    assert 'if not defined STUDY_WORKBENCH_PYTHON' in bat
    assert '"%STUDY_WORKBENCH_PYTHON%" "%~dp0desktop_app.py"' in bat
    assert 'import requests, webview, clr_loader, pythonnet' in bat
    assert 'if /i "%~1"=="--check" exit /b 0' in bat
    assert '/desktop-python.txt' in text('.gitignore')
    assert 'if errorlevel 1' in bat
    assert 'if not exist "%~dp0desktop_app.py"' in bat
    assert 'cd /d "%~dp0"' in bat
    assert 'call "%~dp0run_desktop.bat"' in text('启动桌面版.bat')
    vbs = text('启动学习工作台(无黑框).vbs')
    assert 'ws.CurrentDirectory = scriptDir' in vbs
    # Hidden launcher must delegate to run_desktop.bat (same interpreter chain and
    # dependency precheck) instead of scanning PATH for pythonw.exe itself.
    assert 'run_desktop.bat' in vbs and '--silent' in vbs
    assert 'pythonw' not in vbs and '%PATH%' not in vbs
    assert 'WScript.Quit 1' in vbs and 'MsgBox' in vbs


def text(name):
    return (ROOT / name).read_text(encoding='utf-8-sig')


@pytest.mark.parametrize('frozen', [False, True])
def test_desktop_uses_persistent_config_directory(monkeypatch, frozen):
    fake_sys = types.ModuleType('sys')
    fake_sys.frozen = frozen
    fake_sys.executable = str(ROOT / 'dist' / 'StudyWorkbench.Desktop.v1.3.0.exe')
    fake_sys._MEIPASS = str(ROOT / 'temporary_MEI')
    monkeypatch.setitem(sys.modules, 'sys', fake_sys)
    config = types.ModuleType('config')
    config.__file__ = str(ROOT / 'config.py')
    exec(compile(text('config.py'), config.__file__, 'exec'), config.__dict__)
    monkeypatch.setitem(sys.modules, 'config', config)
    # Evaluate only desktop imports from config and path constants. No GUI/server import.
    tree = ast.parse(text('desktop_app.py'))
    chosen = []
    for node in tree.body:
        if isinstance(node, ast.ImportFrom) and node.module == 'config':
            chosen.append(node)
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id in
                                               ('BASE_DIR', 'WINDOW_STATE_FILE') for t in node.targets):
            chosen.append(node)
    namespace = {'os': os, '__file__': str(ROOT / 'temporary_MEI' / 'desktop_app.py')}
    exec(compile(ast.Module(body=chosen, type_ignores=[]), 'desktop_paths', 'exec'), namespace)
    expected = str(ROOT / 'dist') if frozen else str(ROOT)
    assert namespace['BASE_DIR'] == config.BASE_DIR == expected
    assert namespace['WINDOW_STATE_FILE'] == os.path.join(expected, '.window_state.json')
    assert config.YUKETANG_SRC_DIR == os.path.join(os.path.dirname(expected), 'yuketang-main')
