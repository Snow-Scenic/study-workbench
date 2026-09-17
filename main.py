# main.py — 学习工作台主入口（启动本地服务 + 自动打开浏览器）
import os
import sys
import atexit
import ctypes
import socket
import threading
import time
import traceback
import socketserver
import webbrowser

from config import BASE_DIR, PORT
import config
from server import MyHandler

# 全局服务器实例，用于关闭
httpd = None


def show_error_dialog(title, msg):
    """原生错误弹窗（Windows），不依赖 tkinter"""
    ctypes.windll.user32.MessageBoxW(0, msg, title, 0x10)  # MB_ICONERROR


def is_port_available(port):
    """检查端口是否可用"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('', port))
            return True
        except OSError:
            return False


def find_available_port(start_port, max_attempts=10):
    """从指定端口开始寻找可用端口"""
    for i in range(max_attempts):
        port = start_port + i
        if is_port_available(port):
            return port
    return None


def cleanup_server():
    """清理服务器资源"""
    global httpd
    if httpd:
        try:
            httpd.shutdown()
            httpd.server_close()
        except Exception:
            pass


def run_server():
    """启动 HTTP 服务并打开浏览器"""
    global httpd

    # 检查端口是否可用，不可用则寻找其他端口
    port = PORT
    if not is_port_available(port):
        print(f"端口 {port} 已被占用，正在寻找可用端口...")
        port = find_available_port(port + 1)
        if port is None:
            err_msg = f"无法找到可用端口（尝试了 {PORT} ~ {PORT + 9}）\n请关闭占用端口的程序后重试。"
            show_error_dialog("启动错误", err_msg)
            return

    try:
        # 创建服务器并设置端口复用（多线程：API 轮询不被长任务阻塞）
        socketserver.ThreadingTCPServer.allow_reuse_address = True
        httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), MyHandler)
        httpd.daemon_threads = True

        # 注册退出清理
        atexit.register(cleanup_server)

        url = f"http://localhost:{port}"
        print(f"学习工作台已启动：{url}")

        # 打开浏览器
        threading.Thread(
            target=webbrowser.open,
            args=(url,),
            daemon=True,
        ).start()

        # 浏览器存活看门狗：超时无任何请求 → 自动关停释放端口
        def browser_watchdog():
            import server as srv
            limit = getattr(config, "BROWSER_WATCHDOG_SECONDS", 15)
            while True:
                time.sleep(1)
                if time.time() - srv._LAST_SEEN > limit:
                    print("\n检测到浏览器已关闭，自动退出并释放端口...")
                    httpd.shutdown()
                    break

        threading.Thread(target=browser_watchdog, daemon=True).start()

        # 启动服务器
        httpd.serve_forever()

    except KeyboardInterrupt:
        print("\n正在关闭服务器...")
        cleanup_server()
    except Exception as e:
        err_msg = f"程序启动失败：\n{str(e)}"
        with open(os.path.join(BASE_DIR, "error.log"), "w", encoding="utf-8") as f:
            traceback.print_exc(file=f)
        show_error_dialog("启动错误", err_msg)
    finally:
        cleanup_server()


if __name__ == '__main__':
    run_server()
