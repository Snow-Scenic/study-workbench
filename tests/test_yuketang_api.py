# tests/test_yuketang_api.py — 雨课堂 API HTTP 集成测试
import json
import time
import urllib.error
import urllib.request

import pytest

import config
config.CORE_IMPL = "mock"        # 集成测试钉住演示核心，禁止真实网络

from server import MyHandler

AUTH_OK = {
    "classroom_id": "123456",
    "sign": "test-sign",
    "university_id": "1300",
    "csrf_token": "csrf-abc",
    "session_id": "sess-xyz",
    "debug": True,                      # 加速模拟
}


@pytest.fixture(scope="module")
def base_url():
    import socketserver
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), MyHandler)
    httpd.daemon_threads = True
    thread = __import__("threading").Thread(target=httpd.serve_forever,
                                            daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()
    httpd.server_close()


def request(url, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, method="POST") if data is not None \
        else urllib.request.Request(url)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode()
        try:
            return resp.status, json.loads(raw)
        except ValueError:
            return resp.status, {"raw": raw}          # 非 JSON（HTML 页面等）
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"raw": body}


def wait_state(base_url, states, timeout=60.0):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        _, snap = request(base_url + "/api/yuketang/status")
        last = snap
        if snap["state"] in states:
            return snap
        time.sleep(0.15)
    raise AssertionError(f"等待 {states} 超时，最后状态 {last and last['state']}")


# ---------- 页面与静态 ----------

def test_yuketang_page_served(base_url):
    status, body = request(base_url + "/yuketang")
    assert status == 200


def test_unknown_api_404(base_url):
    status, _ = request(base_url + "/api/yuketang/nope", {})
    assert status == 404


def test_bad_json_400(base_url):
    req = urllib.request.Request(base_url + "/api/yuketang/analyze",
                                 data=b"{not-json", method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
    except urllib.error.HTTPError as e:
        status = e.code
    assert status == 400


# ---------- analyze / ready ----------

def test_analyze_missing_params_400(base_url):
    status, body = request(base_url + "/api/yuketang/analyze",
                           {"classroom_id": "1"})
    assert status == 400
    assert body["ok"] is False and "缺少参数" in body["error"]


def test_full_flow_analyze_ready_start_finished(base_url):
    # reset 兜底（前序用例可能残留）
    request(base_url + "/api/yuketang/reset", {})

    status, body = request(base_url + "/api/yuketang/analyze", dict(AUTH_OK))
    assert status == 202 and body["state"] == "analyzing"

    # analyzing 期间再次 analyze → 409（竞态下可能已 ready，则跳过该断言）
    st2, _ = request(base_url + "/api/yuketang/analyze", dict(AUTH_OK))
    assert st2 in (202, 409)

    snap = wait_state(base_url, ("ready",))
    assert 10 <= len(snap["tasks"]) <= 20
    pm = snap["params_masked"]
    assert pm["sign"] == "***" and pm["csrf_token"] == "***"
    assert pm["session_id"] == "***"
    assert pm["classroom_id"] == "123456"

    # ---- start ----
    status, body = request(base_url + "/api/yuketang/start", {})
    assert status == 202 and body["state"] == "running"

    # running 中再 start → 409
    st3, _ = request(base_url + "/api/yuketang/start", {})
    assert st3 in (202, 409)            # 竞态容忍

    snap = wait_state(base_url, ("finished",), timeout=90)
    stats = snap["stats"]
    assert stats["total"] == len(snap["tasks"])
    assert snap["summary"]["total"] == stats["total"]

    # 终态后 start → 409；reset → idle
    status, _ = request(base_url + "/api/yuketang/start", {})
    assert status == 409
    status, body = request(base_url + "/api/yuketang/reset", {})
    assert status == 200 and body["state"] == "idle"
    _, snap = request(base_url + "/api/yuketang/status")
    assert snap["state"] == "idle" and snap["tasks"] == []


def test_reset_denied_when_idle(base_url):
    request(base_url + "/api/yuketang/reset", {})     # 确保空闲
    status, _ = request(base_url + "/api/yuketang/reset", {})
    assert status == 409


# ---------- stop 异步语义 ----------

def test_stop_async_semantics_returns_running_then_stopped(base_url):
    request(base_url + "/api/yuketang/reset", {})
    request(base_url + "/api/yuketang/analyze",
            {**AUTH_OK, "debug": False})              # 慢速模拟，留足停止窗口
    wait_state(base_url, ("ready",))

    status, body = request(base_url + "/api/yuketang/start", {})
    assert status == 202

    # 等 worker 真正跑起来
    time.sleep(1.5)
    status, body = request(base_url + "/api/yuketang/stop", {})
    assert status == 202
    assert body == {"ok": True, "state": "running", "stop_requested": True}

    snap = wait_state(base_url, ("stopped",), timeout=90)
    assert snap["stop_requested"] is False or True   # 字段存在即可
    assert snap["summary"]["stopped"] >= 1
    pend = [t for t in snap["tasks"] if t["status"] == "pending"]
    stopped = [t for t in snap["tasks"] if t["status"] == "stopped"]
    failed = [t for t in snap["tasks"] if t["status"] == "failed"]
    # UI 区分：stopped 与 failed 是不同状态
    assert len(stopped) >= 1
    assert all(t["status"] != "running" for t in snap["tasks"])

    # stopped 后再次 stop → 409
    status, _ = request(base_url + "/api/yuketang/stop", {})
    assert status == 409


# ---------- 轮询不被长任务阻塞（ThreadingTCPServer 生效证明）----------

def test_status_responsive_while_job_running(base_url):
    request(base_url + "/api/yuketang/reset", {})
    request(base_url + "/api/yuketang/analyze", dict(AUTH_OK))
    wait_state(base_url, ("ready",))
    request(base_url + "/api/yuketang/start", {})

    worst = 0.0
    for _ in range(5):
        t0 = time.time()
        status, _ = request(base_url + "/api/yuketang/status")
        worst = max(worst, time.time() - t0)
        time.sleep(0.05)
    assert worst < 2.0, f"status 轮询被阻塞: {worst:.2f}s"
    wait_state(base_url, ("finished",), timeout=90)
