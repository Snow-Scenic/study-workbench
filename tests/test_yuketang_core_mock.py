# tests/test_yuketang_core_mock.py — MockCore 契约测试（含参数校验）
# 运行: python -m pytest tests/test_yuketang_core_mock.py -v
import threading
import time

import pytest

from yuketang_core import (
    AUTH_FIELDS,
    MockCore,
    YukeError,
    YukeParamError,
    YukeStateError,
    get_core,
    validate_params,
)

AUTH_OK = {
    "classroom_id": " 123456 ",
    "sign": "test-sign",
    "university_id": "1300",
    "csrf_token": "csrf-abc",
    "session_id": "sess-xyz",
}


# ---------- 参数校验 ----------

def test_missing_auth_raises_param_error():
    with pytest.raises(YukeParamError):
        validate_params({"classroom_id": "1"})


def test_blank_auth_counts_as_missing():
    with pytest.raises(YukeParamError):
        validate_params({**AUTH_OK, "sign": "   "})


def test_param_error_is_yuke_error():
    assert issubclass(YukeParamError, YukeError)


def test_state_error_is_yuke_error():
    assert issubclass(YukeStateError, YukeError)


def test_auth_fields_constant_complete():
    assert set(AUTH_FIELDS) == {
        "classroom_id", "sign", "university_id", "csrf_token", "session_id"
    }


def test_defaults_filled():
    p = validate_params(dict(AUTH_OK))
    assert p["video_speed"] == 1.5
    assert p["heartbeat_interval"] == 5
    assert p["max_workers"] == 3
    assert p["skip_completed"] is True
    assert p["test_mode"] is False
    assert p["test_video_count"] == 5
    assert p["use_concurrent"] is True
    assert p["auto_richtext"] is True
    assert p["richtext_stay_seconds"] == 3
    assert p["richtext_skip_delay"] == 1
    assert p["debug"] is False


def test_auth_values_stripped_strings():
    p = validate_params(dict(AUTH_OK))
    assert p["classroom_id"] == "123456"
    assert all(isinstance(p[f], str) and p[f] for f in AUTH_FIELDS)


def test_numeric_coercion_and_clamps():
    p = validate_params({
        **AUTH_OK,
        "max_workers": "99",
        "video_speed": "abc",
        "heartbeat_interval": "0",
        "richtext_stay_seconds": "-5",
        "test_mode": "true",
        "skip_completed": "0",
    })
    assert p["max_workers"] == 8
    assert p["video_speed"] == 1.5
    assert p["heartbeat_interval"] == 1
    assert p["richtext_stay_seconds"] == 0
    assert p["test_mode"] is True
    assert p["skip_completed"] is False


def test_unknown_keys_ignored():
    p = validate_params({**AUTH_OK, "hacker_field": "x"})
    assert "hacker_field" not in p


# ---------- MockCore.analyze ----------

@pytest.fixture()
def core():
    return MockCore()


def _fast(extra=None):
    """快速参数：DEBUG 加速 + 图文零停留"""
    return validate_params({**AUTH_OK, "debug": True,
                            "richtext_stay_seconds": 0,
                            "richtext_skip_delay": 0, **(extra or {})})


def test_analyze_task_count_in_contract_range(core):
    logs = []
    tasks = core.analyze(_fast(), lambda *a, **k: logs.append(a))
    # 契约：数量在 10~20 且字段完整（不锁死固定值；当前实现为 20）
    assert 10 <= len(tasks) <= 20
    for t in tasks:
        assert t["id"] and t["name"] and t["chapter"]
        assert t["kind"] in ("video", "richtext")
    assert len({t["id"] for t in tasks}) == len(tasks)


def test_analyze_emits_discover_log_per_task(core):
    logs = []
    tasks = core.analyze(_fast(),
                         lambda level, event, msg, task_id=None:
                         logs.append((event, task_id)))
    discovers = [l for l in logs if l[0] == "discover"]
    assert len(discovers) >= len(tasks)


# ---------- MockCore.execute ----------

def execute_core(core, params, tasks, stop_event=None, watch=None):
    stop_event = stop_event or threading.Event()
    captured = {}

    def emit_task(task_id, status=None, pct=None, **k):
        cap = captured.setdefault(task_id, {"status": "pending", "pct": 0,
                                            "_running": False})
        if status == "running" and not cap["_running"]:
            cap["_running"] = True
        if status in ("completed", "skipped", "failed", "stopped"):
            cap["_running"] = False
        if status is not None:
            cap["status"] = status
        if pct is not None and pct >= cap["pct"]:
            cap["pct"] = pct
        if watch is not None:
            watch(task_id, status, pct)

    summary = core.execute(params, tasks, emit_task,
                           lambda *a, **k: None, stop_event)
    return summary, captured


def test_execute_summary_conservation_and_states(core):
    params = _fast({"max_workers": 3})
    tasks = core.analyze(params, lambda *a, **k: None)
    summary, captured = execute_core(core, params, tasks)
    total = len(tasks)
    assert summary["total"] == total
    counts = {"completed": 0, "skipped": 0, "failed": 0, "stopped": 0}
    for tid in (t["id"] for t in tasks):
        counts[captured[tid]["status"]] += 1
    assert sum(counts.values()) == total
    assert counts["completed"] >= total // 2


def test_execute_multiple_workers_concurrent(core):
    params = _fast({"max_workers": 4, "auto_richtext": False})
    tasks = core.analyze(params, lambda *a, **k: None)
    live = {"n": 0, "peak": 0}
    lk = threading.Lock()

    def watch(task_id, status, pct):
        with lk:
            if status == "running":
                live["n"] += 1
                live["peak"] = max(live["peak"], live["n"])
            elif status in ("completed", "skipped", "failed", "stopped"):
                live["n"] = max(0, live["n"] - 1)

    execute_core(core, params, tasks, watch=watch)
    assert live["peak"] >= 2, f"应观测到多 worker 并发，峰值={live['peak']}"


def test_execute_test_mode_all_completed_first_n(core):
    params = _fast({"test_mode": True, "test_video_count": 3,
                    "max_workers": 2})
    tasks = core.analyze(params, lambda *a, **k: None)
    summary, captured = execute_core(core, params, tasks)
    done_ids = {tid for tid, c in captured.items() if c["status"] != "pending"}
    assert len(done_ids) == 3
    assert all(captured[t]["status"] == "completed" for t in done_ids)


def test_execute_stop_midway_marks_stopped_keeps_pending(core):
    params = _fast({"max_workers": 2})
    tasks = core.analyze(params, lambda *a, **k: None)
    stop = threading.Event()
    started = threading.Event()

    def watch(task_id, status, pct):
        if status == "running":
            started.set()

    def killer():
        started.wait(10)
        time.sleep(1.2)              # 让部分任务推进、部分尚未开始
        stop.set()

    threading.Thread(target=killer, daemon=True).start()
    summary, captured = execute_core(core, params, tasks, stop, watch=watch)

    # 从未上报的任务视为 pending（与 Manager 任务表语义一致）
    statuses = {t["id"]: captured.get(t["id"], {"status": "pending"})["status"]
                for t in tasks}
    stopped_cnt = sum(1 for s in statuses.values() if s == "stopped")
    pend_cnt = sum(1 for s in statuses.values() if s == "pending")
    assert summary["stopped"] == stopped_cnt > 0
    assert pend_cnt > 0
    assert not any(s == "running" for s in statuses.values())


def test_get_core_returns_mock_by_default(monkeypatch):
    import config
    monkeypatch.setattr(config, "CORE_IMPL", "mock", raising=False)
    assert isinstance(get_core(), MockCore)


def test_get_core_real_not_implemented(monkeypatch):
    import config
    monkeypatch.setattr(config, "CORE_IMPL", "real", raising=False)
    with pytest.raises(NotImplementedError):
        get_core()
