# tests/test_server.py — 后端单元测试
# 运行: python -m pytest tests/ -v
import json
import os
import socketserver
import sys
import threading
import urllib.request
import urllib.error

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from portable_state import PortableStateStore
from server import MyHandler, _find_bank_file, _safe_join, _scan_question_banks


def _make_bank(path, name="测试题库"):
    """向 path 写入一个最小合法题库 JSON"""
    path.write_text(json.dumps(_make_bank_data(name), ensure_ascii=False), encoding="utf-8")
    return _make_bank_data(name)


def _make_bank_data(name="测试题库"):
    """返回一个最小合法题库 dict"""
    return {
        "meta": {"name": name, "version": "1.0"},
        "categories": {
            "c1": {"label": "📖 分类一", "questions": [
                {"id": "q1", "type": "single", "q": "1+1=?",
                 "opts": ["1", "2"], "ans": 1}
            ]}
        },
    }


# ---------- 纯函数测试 ----------

def test_scan_reads_external_dir(tmp_path, monkeypatch):
    import server
    _make_bank(tmp_path / "demo.json")
    monkeypatch.setattr(server, "EXTERNAL_BANKS_DIR", str(tmp_path))
    # 按文件名过滤：真实使用中 question_banks 里可能有用户自己的题库，不做全量计数假设
    files = [f for f in server._scan_question_banks() if f["file"] == "demo.json"]
    assert len(files) == 1
    assert files[0]["count"] == 1


def test_find_bank_file_external(tmp_path, monkeypatch):
    import server
    _make_bank(tmp_path / "demo.json")
    monkeypatch.setattr(server, "EXTERNAL_BANKS_DIR", str(tmp_path))
    assert server._find_bank_file("demo.json") is not None
    assert server._find_bank_file("no_such_bank.json") is None


def test_scan_empty_when_no_banks():
    """空壳化后仓库不再自带题库"""
    import server
    files = server._scan_question_banks()
    names = [f["file"] for f in files]
    assert "legacy_chinese.json" not in names
    assert "english.json" not in names


def test_find_bank_file_blocks_traversal(tmp_path):
    """../secret.json 这类路径不能逃出题库目录"""
    outside = tmp_path / "outside"
    outside.mkdir()
    secret = outside / "evil.json"
    secret.write_text("{}", encoding="utf-8")
    # basename 会剥离目录部分，只剩 evil.json，在题库目录中不存在
    assert _find_bank_file("../evil.json") is None


def test_safe_join_allows_nested():
    base = os.path.abspath(os.sep)
    result = _safe_join(base, "some/sub/file.css")
    assert result is not None


def test_safe_join_blocks_traversal(tmp_path):
    assert _safe_join(str(tmp_path), "../outside.txt") is None
    assert _safe_join(str(tmp_path), "a/../../outside.txt") is None
    inside = _safe_join(str(tmp_path), "css/base.css")
    assert inside is not None
    assert str(inside).startswith(str(tmp_path))


# ---------- HTTP 集成测试 ----------

@pytest.fixture(scope="module")
def base_url():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), MyHandler)
    httpd.daemon_threads = True
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()
    httpd.server_close()


def get_status(url):
    try:
        with urllib.request.urlopen(url) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, b""


def test_http_index(base_url):
    status, body = get_status(base_url + "/")
    assert status == 200
    assert b"<html" in body[:200].lower()


def test_http_scan(base_url, tmp_path, monkeypatch):
    import server
    _make_bank(tmp_path / "demo.json")
    monkeypatch.setattr(server, "EXTERNAL_BANKS_DIR", str(tmp_path))
    status, body = get_status(base_url + "/scan")
    assert status == 200
    data = json.loads(body.decode("utf-8"))
    assert any(f["file"] == "demo.json" for f in data)


def test_http_banks_valid(base_url, tmp_path, monkeypatch):
    import server
    _make_bank(tmp_path / "demo.json")
    monkeypatch.setattr(server, "EXTERNAL_BANKS_DIR", str(tmp_path))
    status, body = get_status(base_url + "/banks/demo.json")
    assert status == 200
    data = json.loads(body.decode("utf-8"))
    assert "meta" in data and "categories" in data


def test_http_banks_traversal_blocked(base_url):
    """URL 编码的 ../ 不能读到题库目录之外的文件"""
    status, _ = get_status(base_url + "/banks/%2e%2e%2fconfig.py")
    assert status == 404
    status, _ = get_status(base_url + "/banks/%2e%2e%2fquestion_banks%2fevil.json")
    assert status == 404


def test_http_static_traversal_blocked(base_url):
    status, _ = get_status(base_url + "/static/%2e%2e%2fconfig.py")
    assert status == 404


def test_http_static_js_served(base_url):
    import urllib.error
    req = urllib.request.Request(base_url + "/static/js/state.js")
    try:
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200
            assert "javascript" in resp.headers.get("Content-Type", "")
            assert b"questionBank" in resp.read()
    except urllib.error.HTTPError as e:
        pytest.fail(f"静态 JS 加载失败: {e.code}")


def test_http_favicon(base_url):
    status, body = get_status(base_url + "/favicon.ico")
    assert status in (200, 404)  # 仓库含图标时为 200


def test_http_root_serves_desktop_app(base_url):
    status, body = get_status(base_url + "/")
    assert status == 200
    assert b"bankSelectScreen" in body


def test_http_quiz_serves_quiz_app(base_url):
    status, body = get_status(base_url + "/quiz")
    assert status == 200
    assert b"bankSelectScreen" in body


def test_http_quiz_injects_portable_state(tmp_path, monkeypatch, base_url):
    import server
    store = PortableStateStore(str(tmp_path / 'study_workbench_data.json'))
    store.save_storage({'quiz_bankName': '便携题库'})
    monkeypatch.setattr(server, '_PORTABLE_STATE', store)
    status, body = get_status(base_url + '/quiz')
    assert status == 200
    html = body.decode('utf-8')
    assert '{{PORTABLE_STATE_JSON}}' not in html
    assert '便携题库' in html


# ---------- POST /api/banks/save（导入题库持久化） ----------

def _post_json(url, payload):
    req = urllib.request.Request(
        url, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return e.code, json.loads(body.decode("utf-8"))
        except Exception:
            return e.code, {}


def test_http_save_bank_writes_external(tmp_path, monkeypatch, base_url):
    """保存接口应把题库写入外部 question_banks 目录"""
    import server
    monkeypatch.setattr(server, "EXTERNAL_BANKS_DIR", str(tmp_path))
    status, resp = _post_json(base_url + "/api/banks/save", _make_bank_data("保存测试库"))
    assert status == 200 and resp.get("ok") is True
    saved = tmp_path / resp["file"]
    assert saved.is_file()
    data = json.loads(saved.read_text(encoding="utf-8"))
    assert data["meta"]["name"] == "保存测试库"


def test_http_save_bank_overwrites_same_name(tmp_path, monkeypatch, base_url):
    """同名题库重复导入 → 覆盖同一文件而非堆积副本"""
    import server
    monkeypatch.setattr(server, "EXTERNAL_BANKS_DIR", str(tmp_path))
    _post_json(base_url + "/api/banks/save", _make_bank_data("重复库"))
    status, resp = _post_json(base_url + "/api/banks/save", _make_bank_data("重复库"))
    assert status == 200 and resp.get("overwritten") is True
    json_files = [p.name for p in tmp_path.glob("*.json")]
    assert len(json_files) == 1


def test_http_save_bank_rejects_invalid(tmp_path, monkeypatch, base_url):
    import server
    monkeypatch.setattr(server, "EXTERNAL_BANKS_DIR", str(tmp_path))
    status, _ = _post_json(base_url + "/api/banks/save", {"meta": {}})
    assert status == 400
    status, _ = _post_json(base_url + "/api/banks/save", {"meta": {"name": "x"}, "categories": {}})
    assert status == 400


def test_http_save_bank_sanitizes_filename(tmp_path, monkeypatch, base_url):
    """meta.name 含路径成分/非法字符时不得逃出题库目录"""
    import server
    monkeypatch.setattr(server, "EXTERNAL_BANKS_DIR", str(tmp_path))
    status, resp = _post_json(
        base_url + "/api/banks/save", _make_bank_data('../../evil:name*?.json'))
    assert status == 200
    assert ".." not in resp["file"]
    assert "/" not in resp["file"] and "\\" not in resp["file"]
    assert (tmp_path / resp["file"]).is_file()
    assert list(tmp_path.rglob("*.json")) == [tmp_path / resp["file"]]


def test_http_save_bank_accepts_large_bank(tmp_path, monkeypatch, base_url):
    """真实题库普遍超过给雨课堂 API 设的 64KB 上限：保存接口必须放行大体量 JSON"""
    import server
    monkeypatch.setattr(server, "EXTERNAL_BANKS_DIR", str(tmp_path))
    data = _make_bank_data("大题库")
    data["categories"]["c1"]["questions"] = [
        {"id": f"q{i}", "type": "single",
         "q": "这是一道用于撑大请求体的测试问题" * 10,
         "opts": ["选项A" * 10, "选项B" * 10], "ans": 1}
        for i in range(600)
    ]
    status, resp = _post_json(base_url + "/api/banks/save", data)
    assert status == 200 and resp.get("ok") is True
    assert resp.get("count") == 600


def test_http_portable_state_writes_only_whitelisted_values(tmp_path, monkeypatch, base_url):
    import server
    store = PortableStateStore(str(tmp_path / 'study_workbench_data.json'))
    monkeypatch.setattr(server, '_PORTABLE_STATE', store)
    status, resp = _post_json(base_url + '/api/portable-state', {
        'storage': {'quiz_bankName': '下次继续', 'unexpected': 'discard'},
    })
    assert status == 200 and resp['saved'] == 1
    assert store.load_storage() == {'quiz_bankName': '下次继续'}


# ---------- 前端修复的回归锁（2026-08-23 五项体验修复） ----------

def test_quiz_progress_row_in_header_not_bottom_bar(base_url):
    """/quiz：进度行（轨道+题数文本）应在顶栏 header 内，底栏不再包含 progressText"""
    status, body = get_status(base_url + "/quiz")
    assert status == 200
    html = body.decode("utf-8")
    assert 'class="progress-row"' in html
    header_end = html.find("</div>\n    <div class=\"section-tabs-row\"")
    assert header_end > -1
    header = html[:header_end]
    assert 'id="progressText"' in header
    bar_start = html.find('<div class="bottom-bar"')
    assert bar_start > -1
    assert 'progressText' not in html[bar_start:]


def test_quiz_bank_select_visible_on_first_paint(base_url):
    """/quiz：题库选择层不得有行内 display:none，避免首帧闪现练习页空白壳"""
    _, body = get_status(base_url + "/quiz")
    html = body.decode("utf-8")
    tag = [ln for ln in html.splitlines() if 'id="bankSelectScreen"' in ln]
    assert tag and "display:none" not in tag[0].replace(" ", "")


def test_components_css_modal_above_fullscreen_overlays(base_url):
    """练习中「📚 题库→导入题库」弹窗曾被全屏层(9999)压住：弹窗 z-index 必须 ≥10000"""
    status, body = get_status(base_url + "/static/css/components.css")
    assert status == 200
    css = body.decode("utf-8")
    overlay_block = css.split(".modal-overlay", 1)[1].split("}", 1)[0]
    m = [seg for seg in overlay_block.replace("\n", " ").split(";") if "z-index" in seg]
    assert m and int(m[0].split(":")[1]) >= 10000


def test_section_tab_animation_scoped_to_intro(base_url):
    """分类标签入场动画必须限定在 .tabs-intro 作用域，切换分类不再整行重播"""
    status, body = get_status(base_url + "/static/css/components.css")
    css = body.decode("utf-8")
    base_rule = css.split(".section-tab {", 1)[1].split("}", 1)[0]
    assert "animation:" not in base_rule
    assert ".tabs-intro .section-tab" in css


def test_yuketang_idle_has_side_panel_and_css_remap(base_url):
    """雨课堂 idle 态：获取配置参数+工作原理侧栏存在；动作容器必须存在"""
    status, body = get_status(base_url + "/yuketang")
    assert status == 200
    html = body.decode("utf-8")
    assert 'class="yk-side"' in html and "获取配置参数" in html and "工作原理" in html
    assert "状态图例" not in html            # 图例与顶栏胶囊重复，已删除
    assert 'id="execActions"' in html        # 缺失曾导致控制台按钮永远渲染不出（JS 抛错）
    status, body = get_status(base_url + "/static/css/yuketang.css")
    css = body.decode("utf-8")
    assert "--primary: #4cc3ff" in css and "--bg: #0a0e15" in css


def test_import_ui_calls_save_endpoint(base_url):
    """导入成功后前端应调用存档接口实现免重复导入"""
    status, body = get_status(base_url + "/static/js/import-ui.js")
    js = body.decode("utf-8")
    assert "/api/banks/save" in js and "persistImportedBank" in js


def test_static_sends_no_cache_and_utf8_charset(base_url):
    """静态资源必须 no-cache（否则浏览器启发式缓存让用户看不到样式更新）；
    css/js 必须带 utf-8 charset（否则中文内容按 Latin-1 解码成乱码）"""
    import urllib.error
    for url in ("/static/css/yuketang.css", "/static/js/yuketang.js", "/quiz"):
        req = urllib.request.Request(base_url + url)
        try:
            with urllib.request.urlopen(req) as resp:
                assert resp.headers.get("Cache-Control") == "no-cache", url
                ct = resp.headers.get("Content-Type", "")
                if url.endswith((".css", ".js")):
                    assert "charset=utf-8" in ct, f"{url} -> {ct}"
        except urllib.error.HTTPError as e:
            pytest.fail(f"{url} -> HTTP {e.code}")


def test_yuketang_css_defines_dark_tokens_on_body(base_url):
    """雨课堂白底根因：body 渐变引用的 --yk-bg/--yk-bg2 必须在 body 自身可解析"""
    status, body = get_status(base_url + "/static/css/yuketang.css")
    css = body.decode("utf-8")
    body_block = css.split("body {", 1)[1].split("}", 1)[0]
    assert "--yk-bg: #0b0f16" in body_block
    assert "--yk-bg2: #101724" in body_block
    assert "background-color:" in body_block   # 渐变再出问题也不许露白
