# server.py — HTTP 服务 + 请求处理器
import json
import os
import threading
import time
import http.server
from urllib.parse import urlparse, unquote

from config import BASE_DIR, TEMPLATE_DIR, STATIC_DIR, EXTERNAL_BANKS_DIR, INTERNAL_BANKS_DIR, RESOURCE_DIR
from yuketang_core import YukeParamError, YukeStateError
from yuketang_manager import YukeJobManager

# 进程内唯一管理器：导入时创建（构造无副作用），避免多线程首次请求竞态
_YUKE_MANAGER = YukeJobManager()

# ---- 浏览器存活看门狗：任何请求都刷新活跃时间；超时无信号则由入口层关停释放端口 ----
_LAST_SEEN = time.time()


def touch_alive():
    global _LAST_SEEN
    _LAST_SEEN = time.time()


def _scan_question_banks():
    """扫描 question_banks/ 目录下的 JSON 文件（合并内部和外部目录）"""
    seen_files = set()
    result = []

    # 扫描两个目录：外部目录优先，内部目录补充
    for qb_dir in [EXTERNAL_BANKS_DIR, INTERNAL_BANKS_DIR]:
        if not os.path.isdir(qb_dir):
            continue
        for fname in sorted(os.listdir(qb_dir)):
            if fname.endswith('.json') and fname not in seen_files:
                seen_files.add(fname)
                fpath = os.path.join(qb_dir, fname)
                try:
                    size = os.path.getsize(fpath)
                    with open(fpath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    name = data.get('meta', {}).get('name', fname)
                    qcount = sum(len(cat.get('questions', [])) for cat in data.get('categories', {}).values())
                    result.append({"name": name, "file": fname, "size": size, "count": qcount})
                except Exception:
                    result.append({"name": fname, "file": fname, "size": 0, "count": 0})
    return result


def _find_bank_file(filename):
    """查找题库文件，优先外部目录（basename 防止路径穿越）"""
    filename = os.path.basename(filename)
    for qb_dir in [EXTERNAL_BANKS_DIR, INTERNAL_BANKS_DIR]:
        fpath = os.path.join(qb_dir, filename)
        if os.path.isfile(fpath):
            return fpath
    return None


def _safe_join(base_dir, relative_path):
    """将相对路径拼接在 base_dir 内，越界返回 None（允许子目录，禁止 ..）"""
    base = os.path.abspath(base_dir)
    prefix = base if base.endswith(os.sep) else base + os.sep
    target = os.path.abspath(os.path.join(base, relative_path))
    if not (target == base or target.startswith(prefix)):
        return None
    return target


def _safe_bank_filename(name):
    """由题库名生成安全文件名：剥离路径成分、Windows 非法字符与控制符"""
    name = os.path.basename(str(name)).strip()
    cleaned = "".join(ch for ch in name if ch.isprintable() and ch not in '\\/:*?"<>|').strip(" .")
    cleaned = cleaned[:80].strip() or "imported_bank"
    if cleaned.lower().endswith(".json"):
        cleaned = cleaned[:-5]
    return cleaned + ".json"


def _save_bank(payload):
    """保存导入的题库到外部 question_banks 目录（同名覆盖），供下次直接选用"""
    if not isinstance(payload, dict):
        raise YukeParamError("请求体必须是 JSON 对象")
    meta = payload.get("meta")
    cats = payload.get("categories")
    if not isinstance(meta, dict) or not meta.get("name"):
        raise YukeParamError("缺少 meta.name 字段")
    if not isinstance(cats, dict) or not cats:
        raise YukeParamError("缺少 categories 或为空")
    fname = _safe_bank_filename(meta["name"])
    dest_dir = EXTERNAL_BANKS_DIR
    os.makedirs(dest_dir, exist_ok=True)
    fpath = os.path.join(dest_dir, fname)
    existed = os.path.isfile(fpath)
    with open(fpath, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    count = sum(len(c.get("questions", [])) for c in cats.values() if isinstance(c, dict))
    return {"ok": True, "file": fname, "overwritten": existed, "count": count}


class MyHandler(http.server.BaseHTTPRequestHandler):

    # ---- 响应工具 ----

    def _send_json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_html_file(self, filename):
        path = os.path.join(TEMPLATE_DIR, filename)
        if not os.path.isfile(path):
            self.send_error(404)
            return
        with open(path, 'r', encoding='utf-8') as f:
            html = f.read()
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-cache')   # 本地应用：样式更新必须立即可见
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))

    def log_message(self, fmt, *args):  # 轮询频繁，静默访问日志
        pass

    # ---- GET ----

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        touch_alive()

        if path == '/shutdown':
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'Server shutting down...')
            threading.Thread(target=self.server.shutdown).start()
            return

        if path == '/beacon':                    # 前端存活信号（空响应）
            self.send_response(204)
            self.end_headers()
            return

        if path == '/':
            self._serve_html_file('hub.html')

        elif path == '/quiz':
            self._serve_html_file('index.html')

        elif path == '/yuketang':
            self._serve_html_file('yuketang.html')

        elif path == '/api/yuketang/status':
            try:
                self._send_json(200, _YUKE_MANAGER.snapshot())
            except Exception as e:
                self._send_json(500, {"ok": False, "error": str(e)})

        elif path == '/scan':
            files = _scan_question_banks()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(files, ensure_ascii=False).encode('utf-8'))

        elif path.startswith('/banks/'):
            fname = path[7:]
            fpath = _find_bank_file(fname)
            if fpath and fname.endswith('.json'):
                with open(fpath, 'r', encoding='utf-8') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(content.encode('utf-8'))
            else:
                self.send_error(404)

        elif path == '/favicon.ico':
            icon_path = None
            for icon_dir in [BASE_DIR, RESOURCE_DIR]:
                candidate = os.path.join(icon_dir, 'favicon.ico')
                if os.path.isfile(candidate):
                    icon_path = candidate
                    break
            if icon_path:
                with open(icon_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-type', 'image/x-icon')
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404)

        elif path.startswith('/static/'):
            file_path = _safe_join(STATIC_DIR, path[8:])
            if file_path and os.path.isfile(file_path):
                self.send_response(200)
                if file_path.endswith('.css'):
                    self.send_header('Content-type', 'text/css; charset=utf-8')
                elif file_path.endswith('.js'):
                    self.send_header('Content-type', 'application/javascript; charset=utf-8')
                else:
                    self.send_header('Content-type', 'application/octet-stream')
                self.send_header('Cache-Control', 'no-cache')   # 本地应用：样式更新必须立即可见
                self.end_headers()
                with open(file_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404)

        else:
            self.send_error(404)

    # ---- POST（雨课堂控制台 API）----

    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        touch_alive()

        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            length = 0
        # 题库保存需容纳真实题库（普遍几十~几百 KB），单独放宽；其余接口维持 64KB 反滥用上限
        max_body = 8 * 1024 * 1024 if path == '/api/banks/save' else 64 * 1024
        if length > max_body:
            return self._send_json(413, {"ok": False, "error": f"请求体超过 {max_body // 1024}KB 上限"})
        raw = self.rfile.read(length) if length else b""

        if raw.strip():
            try:
                payload = json.loads(raw.decode('utf-8'))
                if not isinstance(payload, dict):
                    raise ValueError("顶层必须是 JSON 对象")
            except Exception:
                return self._send_json(400, {"ok": False, "error": "JSON 格式非法"})
        else:
            payload = {}

        mgr = _YUKE_MANAGER
        try:
            if path == '/api/yuketang/analyze':
                resp, code = mgr.analyze(payload), 202
            elif path == '/api/banks/save':
                resp, code = _save_bank(payload), 200
            elif path == '/api/yuketang/start':
                resp, code = mgr.start(), 202
            elif path == '/api/yuketang/stop':
                resp, code = mgr.stop(), 202
            elif path == '/api/yuketang/reset':
                resp, code = mgr.reset(), 200
            else:
                return self._send_json(404, {"ok": False, "error": "未知接口"})
            self._send_json(code, resp)
        except YukeParamError as e:
            self._send_json(400, {"ok": False, "error": str(e)})
        except YukeStateError as e:
            self._send_json(409, {"ok": False, "error": str(e)})
        except Exception as e:
            self._send_json(500, {"ok": False, "error": f"服务器内部错误: {e}"})
