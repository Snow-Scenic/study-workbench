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
    assert script.count('--hidden-import ') == 4
    assert 'cd /d "%~dp0"' in script
    name = 'StudyWorkbench.Desktop.v1.3.0'
    assert '--name ' + name + ' ' in script
    for doc in ['README.md', 'README.en.md']:
        assert 'dist\\' + name + '.exe' in text(doc)
    desktop_build = script.split('StudyWorkbench.Desktop.v1.3.0', 1)[0]
    assert '--windowed' in desktop_build
    for module in ['PyQt5', 'PyQt6', 'PySide2', 'PySide6', 'qtpy']:
        assert f'--exclude-module {module}' in desktop_build


def test_yuketang_platform_choice_is_available_in_both_shells():
    """浏览器独立页和桌面内嵌页都必须包含同一平台选择控件。"""
    for name in ['templates/yuketang.html', 'templates/index.html']:
        page = text(name)
        assert '<select id="f_platform_host"' in page
        assert 'njauyjs.yuketang.cn' in page
        assert 'id="guideCourse"' in page
        assert 'id="guideCookie"' in page
    script = text('static/js/yuketang.js')
    assert 'PLATFORM_GUIDES' in script
    assert 'updatePlatformGuide' in script


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


def test_desktop_resize_uses_native_loop_without_global_drag_conflict():
    """拖动和缩放必须走 pywebview 已知的逻辑像素 API。"""
    source = text('desktop_app.py')
    assert '(style & ~WS_THICKFRAME) | WS_MAXIMIZEBOX | WS_MINIMIZEBOX' in source
    assert 'easy_drag=False' in source
    assert 'def resize_window(self, width, height, edge):' in source
    assert 'from webview.window import FixPoint' in source
    assert 'self._window.resize(width, height, fix_point)' in source
    assert 'GetAsyncKeyState(0x01)' not in source
    assert 'SetWindowPos(_current_hwnd, 0, *bounds, 0x0014)' not in source
    assert '_resize_worker' not in source
    assert 'WM_SYSCOMMAND = 0x0112' not in source
    assert 'original_style | WS_THICKFRAME' not in source

    page = text('templates/index.html')
    assert "onpointerdown=\"return desktopStartResize('bottom-right', event)\"" in page
    assert "'pywebviewMoveWindow'" in page
    assert 'requestAnimationFrame' in page
    assert 'resize_window(' in page
    assert 'window-resizing' not in page


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
    assert not hasattr(config, 'YUKETANG_SRC_DIR')


def test_desktop_rejects_offscreen_saved_window_state():
    """错误的窗口坐标不能让无窗口启动脚本把应用永久藏到屏幕外。"""
    source = text('desktop_app.py')
    assert 'def _window_state_is_visible(state):' in source
    assert 'SM_XVIRTUALSCREEN = 76' in source
    assert 'visible_margin = 96' in source
    assert '_window_state_is_visible(state)' in source
