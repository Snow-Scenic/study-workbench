# desktop_app.py — Windows 11 原生桌面应用入口 (pywebview + 内嵌 HTTP 服务)
"""
学习工作台 · 原生桌面模式
使用 pywebview 创建 Windows 原生窗口，内嵌 WebView2 (Edge Chromium) 渲染引擎，
复用现有 HTML/CSS/JS 前端，实现类似 Windows 计算器的原生桌面体验。

启动方式：
    python desktop_app.py
"""
import ctypes
import json
import os
import socket
import sys
import threading
import time
import traceback
import socketserver

# ---- 路径与环境 ----
from config import BASE_DIR as CONFIG_BASE_DIR, PORT, RESOURCE_DIR

# 复用 config.BASE_DIR：冻结（onefile）时为 exe 所在目录（可持久化），
# 源码运行时为 desktop_app.py 所在目录。__file__ 在 onefile 下位于临时 _MEI 目录。
BASE_DIR = CONFIG_BASE_DIR
sys.path.insert(0, RESOURCE_DIR)

from server import MyHandler

# ---- 常量 ----
APP_TITLE = '学习工作台'
APP_ID = 'StudyWorkbench.DesktopApp.1.0'
WINDOW_STATE_FILE = os.path.join(BASE_DIR, '.window_state.json')
DEFAULT_WIDTH = 1280
DEFAULT_HEIGHT = 800
MIN_WIDTH = 900
MIN_HEIGHT = 600

# ---- DWM 属性常量 (Windows 11) ----
DWMWA_USE_IMMERSIVE_DARK_MODE = 20
DWMWA_WINDOW_CORNER_PREFERENCE = 33
DWMWA_SYSTEMBACKDROP_TYPE = 38
DWMWCP_ROUND = 2          # 圆角窗口
DWMSBT_MAINWINDOW = 2     # Mica 材质
DWMSBT_TABBEDWINDOW = 4   # Mica Alt 材质


# ---- pythonw.exe 静默运行保护 (无控制台时重定向 stdout/stderr) ----
if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w')
if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w')

# ============================================================
#  Windows 11 DWM 系统增强
# ============================================================

_current_hwnd = None


def _set_titlebar_dark_mode(hwnd, is_dark):
    """设置窗口标题栏深色/浅色模式，与前端主题实时同步，彻底杜绝浅色模式下的突兀黑框"""
    if not hwnd:
        return
    try:
        value = ctypes.c_int(1 if is_dark else 0)
        ctypes.windll.dwmapi.DwmSetWindowAttribute(
            hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE,
            ctypes.byref(value), ctypes.sizeof(value)
        )
    except Exception:
        pass


def _apply_dwm_attributes(hwnd, is_dark=False):
    """通过 DwmSetWindowAttribute 启用 Win11 原生视觉增强"""
    global _current_hwnd
    _current_hwnd = hwnd
    try:
        dwmapi = ctypes.windll.dwmapi

        # 1. 标题栏颜色（浅色模式为 0 浅色，深色模式为 1 深色）
        _set_titlebar_dark_mode(hwnd, is_dark)

        # 2. 启用圆角窗口
        corner = ctypes.c_int(DWMWCP_ROUND)
        dwmapi.DwmSetWindowAttribute(
            hwnd, DWMWA_WINDOW_CORNER_PREFERENCE,
            ctypes.byref(corner), ctypes.sizeof(corner)
        )

        # 3. 启用 Mica Alt 材质背景（Win11 计算器与资源管理器同款）
        backdrop = ctypes.c_int(DWMSBT_TABBEDWINDOW)
        dwmapi.DwmSetWindowAttribute(
            hwnd, DWMWA_SYSTEMBACKDROP_TYPE,
            ctypes.byref(backdrop), ctypes.sizeof(backdrop)
        )

        # 4. 只保留最小化/最大化能力。pywebview 的无边框窗口若启用
        # WS_THICKFRAME，会把客户区控件误判成非客户区，导致下拉框等控件
        # 无法点击。尺寸调整由前端边缘手柄显式处理。
        GWL_STYLE = -16
        WS_MAXIMIZEBOX = 0x00010000
        WS_MINIMIZEBOX = 0x00020000
        WS_THICKFRAME = 0x00040000
        user32 = ctypes.windll.user32
        style = user32.GetWindowLongW(hwnd, GWL_STYLE)
        user32.SetWindowLongW(
            hwnd, GWL_STYLE,
            (style & ~WS_THICKFRAME) | WS_MAXIMIZEBOX | WS_MINIMIZEBOX
        )
        user32.SetWindowPos(hwnd, 0, 0, 0, 0, 0, 0x0027)
    except Exception:
        # Win10 或更早版本不支持这些属性，静默降级
        pass


class DesktopApi:
    """提供给前端 JS 调用的桌面原生能力桥梁"""
    def __init__(self, window=None):
        self._window = window

    def set_window(self, window):
        self._window = window

    def minimize(self):
        """最小化窗口"""
        try:
            if self._window:
                self._window.minimize()
        except Exception:
            pass
        return True

    def toggle_maximize(self):
        """最大化/还原窗口切换，返回切换后的最大化状态"""
        try:
            if self._window:
                if getattr(self._window, 'maximized', False):
                    self._window.restore()
                    return False
                else:
                    self._window.maximize()
                    return True
        except Exception:
            pass
        return False

    def close(self):
        """关闭窗口并终止应用"""
        try:
            if self._window:
                self._window.destroy()
        except Exception:
            pass
        return True

    def set_theme(self, is_dark):
        """前端切换主题时同步通知后端调整标题栏色调"""
        global _current_hwnd
        if _current_hwnd:
            _set_titlebar_dark_mode(_current_hwnd, bool(is_dark))
    def resize_window(self, width, height, edge):
        """通过 pywebview 的公开窗口 API 调整尺寸。

        由前端按动画帧合并鼠标变化；这里使用 pywebview 的逻辑像素和
        FixPoint，因此多显示器、缩放比例及左/上边缘的固定端都由宿主处理。
        """
        if not self._window:
            return False
        try:
            from webview.window import FixPoint

            fixed_edges = {
                'left': FixPoint.EAST,
                'right': FixPoint.NORTH | FixPoint.WEST,
                'top': FixPoint.SOUTH,
                'bottom': FixPoint.NORTH | FixPoint.WEST,
                'top-left': FixPoint.EAST | FixPoint.SOUTH,
                'top-right': FixPoint.WEST | FixPoint.SOUTH,
                'bottom-left': FixPoint.EAST | FixPoint.NORTH,
                'bottom-right': FixPoint.WEST | FixPoint.NORTH,
            }
            fix_point = fixed_edges.get(str(edge).lower())
            if fix_point is None:
                return False

            width = max(MIN_WIDTH, int(width))
            height = max(MIN_HEIGHT, int(height))
            self._window.resize(width, height, fix_point)
            return True
        except (TypeError, ValueError, OverflowError):
            return False
        except Exception:
            return False

    def log_error(self, message):
        """记录前端异常到日志文件，方便排查"""
        try:
            with open(os.path.join(BASE_DIR, 'browser_error.log'), 'a', encoding='utf-8') as f:
                f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}\n")
        except Exception:
            pass
        return True


def _set_app_user_model_id():
    """设置 Windows 任务栏 AppUserModelID，确保任务栏图标正确分组"""
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(APP_ID)
    except Exception:
        pass


# ============================================================
#  窗口状态持久化
# ============================================================

def _load_window_state():
    """加载上次关闭时的窗口位置和大小"""
    try:
        if os.path.isfile(WINDOW_STATE_FILE):
            with open(WINDOW_STATE_FILE, 'r', encoding='utf-8') as f:
                state = json.load(f)
            # 尺寸和位置必须都合法。异常缩放或显示器布局变化可能会把坐标
            # 持久化到虚拟桌面之外，不能在下次启动时继续把窗口恢复到屏幕外。
            if (isinstance(state.get('x'), int) and isinstance(state.get('y'), int) and
                    isinstance(state.get('width'), int) and state['width'] >= MIN_WIDTH and
                    isinstance(state.get('height'), int) and state['height'] >= MIN_HEIGHT and
                    _window_state_is_visible(state)):
                return state
    except Exception:
        pass
    return None


def _window_state_is_visible(state):
    """确认保存的窗口至少有一小部分落在 Windows 虚拟桌面内。"""
    try:
        user32 = ctypes.windll.user32
        SM_XVIRTUALSCREEN = 76
        SM_YVIRTUALSCREEN = 77
        SM_CXVIRTUALSCREEN = 78
        SM_CYVIRTUALSCREEN = 79
        left = user32.GetSystemMetrics(SM_XVIRTUALSCREEN)
        top = user32.GetSystemMetrics(SM_YVIRTUALSCREEN)
        right = left + user32.GetSystemMetrics(SM_CXVIRTUALSCREEN)
        bottom = top + user32.GetSystemMetrics(SM_CYVIRTUALSCREEN)

        # 留出 96px 可见区域，避免只剩 1px 时用户仍无法把窗口拖回。
        visible_margin = 96
        return (
            state['x'] < right - visible_margin and
            state['x'] + state['width'] > left + visible_margin and
            state['y'] < bottom - visible_margin and
            state['y'] + state['height'] > top + visible_margin
        )
    except Exception:
        # 读取显示器信息失败时不阻止正常启动，由 pywebview 自行恢复位置。
        return True


def _save_window_state(window):
    """保存当前窗口状态到 JSON 文件"""
    try:
        state = {
            'x': window.x,
            'y': window.y,
            'width': window.width,
            'height': window.height,
        }
        with open(WINDOW_STATE_FILE, 'w', encoding='utf-8') as f:
            json.dump(state, f, indent=2)
    except Exception:
        pass


# ============================================================
#  HTTP 服务器（后台线程）
# ============================================================

def _find_available_port(start_port, max_attempts=10):
    """从指定端口开始寻找可用端口"""
    for i in range(max_attempts):
        port = start_port + i
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('', port))
                return port
        except OSError:
            continue
    return None


def _start_server(port):
    """在后台线程中启动 HTTP 服务器，返回 (httpd, actual_port)"""
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', port), MyHandler)
    httpd.daemon_threads = True

    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    return httpd


# ============================================================
#  浏览器行为禁用（JS 注入）
# ============================================================

_DISABLE_BROWSER_JS = """
(function() {
    // 标记桌面模式
    document.body.classList.add('desktop-mode');
    document.documentElement.classList.add('desktop-mode');

    // 禁用右键菜单
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });

    // 禁用浏览器快捷键
    document.addEventListener('keydown', function(e) {
        // F5 / Ctrl+R — 刷新
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
            e.preventDefault();
        }
        // F12 — 开发者工具
        if (e.key === 'F12') {
            e.preventDefault();
        }
        // Ctrl+U — 查看源码
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
        }
        // Ctrl+Shift+I — 开发者工具
        if (e.ctrlKey && e.shiftKey && e.key === 'I') {
            e.preventDefault();
        }
        // Ctrl+S — 保存页面
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
        }
        // Ctrl+P — 打印
        if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
        }
    });

    // 禁用拖拽文件到窗口
    document.addEventListener('dragover', function(e) { e.preventDefault(); });
    document.addEventListener('drop', function(e) { e.preventDefault(); });

    // 暴露原生桌面控制桥梁
    window.desktopClose = function() {
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.close === 'function') {
            window.pywebview.api.close();
        } else {
            window.close();
        }
    };
    window.desktopMinimize = function() {
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.minimize === 'function') {
            window.pywebview.api.minimize();
        }
    };
    window.desktopToggleMaximize = function() {
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.toggle_maximize === 'function') {
            window.pywebview.api.toggle_maximize().then(function(isMax) {
                if (typeof window.updateMaximizeIcon === 'function') {
                    window.updateMaximizeIcon(isMax);
                }
            }).catch(function() {});
        }
    };
    console.log('[StudyWorkbench] Desktop mode activated');
})();
"""


# ============================================================
#  主入口
# ============================================================

def main():
    """启动桌面应用"""
    import webview

    # 0. 设置 Windows 任务栏 AppUserModelID
    _set_app_user_model_id()

    # 1. 寻找可用端口并启动 HTTP 服务器
    port = _find_available_port(PORT)
    if port is None:
        ctypes.windll.user32.MessageBoxW(
            0,
            f'无法找到可用端口（尝试了 {PORT} ~ {PORT + 9}）\n请关闭占用端口的程序后重试。',
            '启动错误',
            0x10  # MB_ICONERROR
        )
        return

    httpd = _start_server(port)
    print(f'[StudyWorkbench] HTTP 服务已启动: http://127.0.0.1:{port}')

    # 2. 加载窗口状态
    saved = _load_window_state()
    win_x = saved.get('x') if saved else None
    win_y = saved.get('y') if saved else None
    win_w = saved['width'] if saved else DEFAULT_WIDTH
    win_h = saved['height'] if saved else DEFAULT_HEIGHT

    # 3. 创建原生窗口（直接传入记忆的初始位置 x, y 与尺寸，启用无缝一体化无边框沉浸模式）
    api = DesktopApi()
    launch_ts = int(time.time())
    window = webview.create_window(
        title=APP_TITLE,
        url=f'http://127.0.0.1:{port}/quiz?desktop=1&_t={launch_ts}',
        width=win_w,
        height=win_h,
        x=win_x,
        y=win_y,
        min_size=(MIN_WIDTH, MIN_HEIGHT),
        frameless=True,         # 无边框沉浸模式：无缝整合 WinUI 3 标题栏，彻底消除多余系统边框
        easy_drag=False,        # 禁用 pywebview 的“全窗口鼠标拖动”，标题栏移动由 drag_window 显式处理
        text_select=True,       # 允许文本选择（题目需要复制）
        zoomable=False,         # 禁止 Ctrl+滚轮缩放
        js_api=api,             # 注册 Python-JS 双向桥梁
    )
    api.set_window(window)

    # 4. 窗口就绪与显示回调
    def on_shown():
        """窗口显示时应用 Win11 DWM 视觉增强"""
        try:
            hwnd = None
            if hasattr(window, 'native') and window.native:
                hwnd = window.native.Handle.ToInt64()
            elif hasattr(window, 'gui') and hasattr(window.gui, 'BrowserView'):
                hwnd = window.gui.BrowserView.instances[window.uid].Handle.ToInt64()

            if hwnd:
                _apply_dwm_attributes(hwnd, is_dark=False)
        except Exception:
            pass

    def on_loaded():
        """窗口 DOM 加载完成后的初始化"""
        try:
            # 注入浏览器行为禁用 JS
            window.evaluate_js(_DISABLE_BROWSER_JS)
        except Exception:
            pass

        # 根据页面当前的主题属性同步标题栏深/浅色
        try:
            is_dark = window.evaluate_js(
                "document.documentElement.getAttribute('data-theme') === 'dark' || localStorage.getItem('theme') === 'dark'"
            )
            if _current_hwnd and is_dark is not None:
                _set_titlebar_dark_mode(_current_hwnd, bool(is_dark))
        except Exception:
            pass

    # 5. 窗口关闭回调
    def on_closing():
        """窗口关闭前保存状态并清理服务器"""
        _save_window_state(window)
        try:
            httpd.shutdown()
        except Exception:
            pass

    window.events.shown += on_shown
    window.events.loaded += on_loaded
    window.events.closing += on_closing

    # 6. 启动 pywebview 事件循环（阻塞，直到窗口关闭）
    print(f'[StudyWorkbench] 桌面窗口启动中...')
    webview.start(
        gui='edgechromium',     # 使用 Edge WebView2 渲染引擎
        debug=False,            # 生产模式：禁用 DevTools
    )

    # 8. 窗口关闭后清理
    print('[StudyWorkbench] 窗口已关闭，正在清理...')
    try:
        httpd.shutdown()
        httpd.server_close()
    except Exception:
        pass
    print('[StudyWorkbench] 已退出')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        err_msg = f'程序启动失败：\n{str(e)}'
        with open(os.path.join(BASE_DIR, 'error.log'), 'w', encoding='utf-8') as f:
            traceback.print_exc(file=f)
        try:
            ctypes.windll.user32.MessageBoxW(0, err_msg, '启动错误', 0x10)
        except Exception:
            print(err_msg)
            traceback.print_exc()
