# tests/test_yuketang_manager.py — YukeJobManager 单元测试（FakeCore 注入，无网络）
import time

import pytest

from yuketang_core import AUTH_FIELDS, YukeParamError, YukeStateError, validate_params
from yuketang_manager import YukeJobManager

AUTH_OK = {
    "classroom_id": "123456",
    "sign": "test-sign",
    "university_id": "1300",
    "csrf_token": "csrf-abc",
    "session_id": "sess-xyz",
}

TASKS_20 = (
    [{"id": f"v{i:02d}", "kind": "video", "name": f"Video {i:02d}",
      "chapter": "第一章 测试"} for i in range(1, 15)]
    + [{"id": f"r{i:02d}", "kind": "richtext", "name": f"Richtext {i:02d}",
        "chapter": "第二章 测试"} for i in range(1, 7)]
)


class FakeCore:
    """可编程假核心：analyze/execute 行为由脚本控制"""

    def __init__(self, analyze_tasks=None, analyze_delay=0.0,
                 execute_summary=None, execute_hook=None):
        self.analyze_tasks = TASKS_20 if analyze_tasks is None else analyze_tasks
        self.analyze_delay = analyze_delay
        self.execute_summary = execute_summary or {}
        self.execute_hook = execute_hook or (lambda *a, **k: None)

    def analyze(self, params, emit_log):
        if self.analyze_delay:
            time.sleep(self.analyze_delay)
        for t in self.analyze_tasks:
            emit_log("info", "discover", t["name"], task_id=t["id"])
        return list(self.analyze_tasks)

    def execute(self, params, tasks, emit_task, emit_log, stop_event):
        self.execute_hook(params, tasks, emit_task, emit_log, stop_event)
        return self.execute_summary or {"total": len(tasks), "completed": 0, "skipped": 0,
                                        "failed": 0, "stopped": len(tasks)}

    def wait_done(self, mgr, states, timeout=5.0):
        pass


def make_mgr(**kw):
    return YukeJobManager(core_factory=lambda: FakeCore(**kw))


def wait_state(mgr, states, timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if mgr.snapshot()["state"] in states:
            return mgr.snapshot()
        time.sleep(0.02)
    raise AssertionError(f"等待状态 {states} 超时，当前 {mgr.snapshot()['state']}")


# ---------- 初始与快照 ----------

def test_initial_snapshot_is_idle_shell():
    snap = make_mgr().snapshot()
    assert snap["state"] == "idle"
    assert snap["tasks"] == [] and snap["logs"] == []
    assert snap["stats"]["total"] == 0


def test_idle_rejects_start_stop():
    mgr = make_mgr(analyze_tasks=[])
    with pytest.raises(YukeStateError):
        mgr.start()
    with pytest.raises(YukeStateError):
        mgr.stop()


# ---------- analyze ----------

def test_analyze_immediately_analyzing_then_ready():
    core = FakeCore(analyze_delay=0.4)
    mgr = YukeJobManager(core_factory=lambda: core)
    resp = mgr.analyze(dict(AUTH_OK))
    assert resp["ok"] and resp["state"] == "analyzing"
    assert mgr.snapshot()["state"] == "analyzing"
    snap = wait_state(mgr, ("ready",))
    assert [t["id"] for t in snap["tasks"]] == [t["id"] for t in TASKS_20]
    assert all(t["status"] == "pending" for t in snap["tasks"])
    assert any(e["event"] == "discover" for e in snap["logs"])


def test_analyze_param_error_marks_job_error():
    class BadCore:
        def analyze(self, params, emit_log):
            raise YukeParamError("缺少参数: sign")

        def execute(self, *a, **k):  # pragma: no cover
            return {}

    mgr = YukeJobManager(core_factory=BadCore)
    # 直接注入绕过 manager 层校验，模拟核心内失败
    mgr._begin_analyze(validate_params(AUTH_OK), BadCore())
    snap = wait_state(mgr, ("error",))
    assert "sign" in snap["error"]


def test_single_active_guard():
    core = FakeCore(analyze_delay=1.0)
    mgr = YukeJobManager(core_factory=lambda: core)
    mgr.analyze(dict(AUTH_OK))
    with pytest.raises(YukeStateError):
        mgr.analyze(dict(AUTH_OK))
    wait_state(mgr, ("ready",))
    with pytest.raises(YukeStateError):
        mgr.analyze(dict(AUTH_OK))


# ---------- start / running / finished ----------

def test_start_from_ready_runs_to_finished():
    seen = {}

    def hook(params, tasks, emit_task, emit_log, stop_event):
        seen["task_count"] = len(tasks)
        for t in tasks:
            emit_task(t["id"], status="running")
            emit_task(t["id"], pct=50)
            emit_task(t["id"], status="completed", pct=100)
        emit_log("info", "task_done", "all done", task_id=tasks[0]["id"])

    core = FakeCore(execute_summary={"total": 20, "completed": 20,
                                     "skipped": 0, "failed": 0, "stopped": 0},
                    execute_hook=hook)
    mgr = YukeJobManager(core_factory=lambda: core)
    mgr.analyze(dict(AUTH_OK))
    wait_state(mgr, ("ready",))
    resp = mgr.start()
    assert resp["state"] == "running"
    snap = wait_state(mgr, ("finished",))
    assert seen["task_count"] == 20
    assert snap["summary"] == {"total": 20, "completed": 20, "skipped": 0, "failed": 0, "stopped": 0}
    stats = snap["stats"]
    assert stats["total"] == 20 and stats["done"] == 20


def test_stop_only_from_running_and_async_semantics():
    release = __import__("threading").Event()

    def hook(params, tasks, emit_task, emit_log, stop_event):
        emit_task(tasks[0]["id"], status="running", pct=10)
        release.wait(3.0)          # 模拟长任务卡在检查点之间
        if stop_event.is_set():
            emit_task(tasks[0]["id"], status="stopped")

    core = FakeCore(execute_summary={"total": 20, "completed": 0, "skipped": 0,
                                     "failed": 0, "stopped": 20},
                    execute_hook=hook)
    mgr = YukeJobManager(core_factory=lambda: core)
    mgr.analyze(dict(AUTH_OK))
    wait_state(mgr, ("ready",))
    mgr.start()
    wait_running(mgr)
    resp = mgr.stop()
    # 异步语义：立即返回，state 仍是 running
    assert resp == {"ok": True, "state": "running", "stop_requested": True}
    release.set()
    snap = wait_state(mgr, ("stopped",))
    assert snap["summary"]["stopped"] == 20


def wait_running(mgr, timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if mgr.snapshot()["state"] == "running":
            return
        time.sleep(0.01)
    raise AssertionError("未进入 running")


def test_execute_exception_marks_error():
    def hook(*a, **k):
        raise RuntimeError("boom")

    core = FakeCore(execute_hook=hook)
    mgr = YukeJobManager(core_factory=lambda: core)
    mgr.analyze(dict(AUTH_OK))
    wait_state(mgr, ("ready",))
    mgr.start()
    snap = wait_state(mgr, ("error",))
    assert "boom" in snap["error"]


def test_non_running_stop_rejected_after_finish():
    mgr = make_mgr()
    mgr.analyze(dict(AUTH_OK))
    wait_state(mgr, ("ready",))
    mgr.start()
    wait_state(mgr, ("finished",))
    with pytest.raises(YukeStateError):
        mgr.stop()


# ---------- reset ----------

def test_reset_allowed_terminal_states_and_clears():
    mgr = make_mgr()
    mgr.analyze(dict(AUTH_OK))
    wait_state(mgr, ("ready",))
    assert mgr.reset()["state"] == "idle"
    assert mgr.snapshot()["tasks"] == []

    # finished -> reset
    mgr.analyze(dict(AUTH_OK))
    wait_state(mgr, ("ready",))
    mgr.start()
    wait_state(mgr, ("finished",))
    assert mgr.reset()["state"] == "idle"

    # stopped -> reset
    release = __import__("threading").Event()

    def hook(p, t, et, el, se):
        release.wait(2.0)

    core2 = FakeCore(execute_hook=hook,
                     execute_summary={"total": 20, "completed": 0,
                                      "skipped": 0, "failed": 0, "stopped": 20})
    mgr2 = YukeJobManager(core_factory=lambda: core2)
    mgr2.analyze(dict(AUTH_OK))
    wait_state(mgr2, ("ready",))
    mgr2.start()
    mgr2.stop()
    release.set()
    wait_state(mgr2, ("stopped",))
    mgr2.reset()
    assert mgr2.snapshot()["state"] == "idle"


def test_reset_denied_while_busy():
    from threading import Event
    analyzing, release_analysis = Event(), Event()
    executing, release_execution = Event(), Event()

    class ControlledCore(FakeCore):
        def analyze(self, params, emit_log):
            analyzing.set()
            assert release_analysis.wait(5)
            return super().analyze(params, emit_log)

        def execute(self, *args, **kwargs):
            executing.set()
            assert release_execution.wait(5)
            return super().execute(*args, **kwargs)

    mgr = YukeJobManager(core_factory=lambda: ControlledCore())
    try:
        mgr.analyze(dict(AUTH_OK))
        assert analyzing.wait(5)
        with pytest.raises(YukeStateError):
            mgr.reset()
        release_analysis.set()
        wait_state(mgr, ("ready",))
        mgr.start()
        assert executing.wait(5)
        with pytest.raises(YukeStateError):
            mgr.reset()
    finally:
        release_analysis.set()
        release_execution.set()
        if mgr._thread:
            mgr._thread.join(5)
    assert not mgr._thread.is_alive()


# ---------- 快照：掩码 / 日志截断 / stats ----------

def test_snapshot_masks_sensitive_params():
    mgr = make_mgr()
    mgr.analyze({**AUTH_OK, "video_speed": 2.0})
    wait_state(mgr, ("ready",))
    pm = mgr.snapshot()["params_masked"]
    assert pm["sign"] == "***" and pm["csrf_token"] == "***"
    assert pm["session_id"] == "***"
    assert pm["classroom_id"] == "123456"          # 非敏感可回显
    assert pm["video_speed"] == 2.0


def test_events_capped_at_200():
    class NoisyCore(FakeCore):
        def analyze(self, params, emit_log):
            for i in range(260):
                emit_log("info", "tick", str(i))
            return []

    mgr = YukeJobManager(core_factory=lambda: NoisyCore())
    mgr.analyze(dict(AUTH_OK))
    wait_state(mgr, ("ready",))
    assert len(mgr.snapshot()["logs"]) == 200


def test_stats_counts_all_states_including_stopped():
    def hook(p, tasks, emit_task, el, stop_event):
        emit_task(tasks[0]["id"], status="completed", pct=100)
        emit_task(tasks[1]["id"], status="skipped")
        emit_task(tasks[2]["id"], status="failed")
        emit_task(tasks[3]["id"], status="running", pct=50)

    core = FakeCore(execute_hook=hook,
                    execute_summary={"total": 20, "completed": 1, "skipped": 1,
                                     "failed": 1, "stopped": 0})
    mgr = YukeJobManager(core_factory=lambda: core)
    mgr.analyze(dict(AUTH_OK))
    wait_state(mgr, ("ready",))
    mgr.start()
    s = wait_state(mgr, ("finished",))["stats"]
    # task2 显式 failed；task3 停在 running 被"孤儿收尾"规则判为 failed
    assert (s["done"], s["skipped"], s["failed"]) == (1, 1, 2)
    assert s["active"] == 0 and s["queued"] == 16 and s["total"] == 20
