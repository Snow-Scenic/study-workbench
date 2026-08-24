# yuketang_manager.py — 雨课堂单活动 Job 管理器（线程安全，纯内存状态）
# 设计依据: docs/superpowers/specs/2026-08-22-yuketang-console-design.md §6/§13
import threading
import time
from collections import deque

from yuketang_core import validate_params, YukeStateError

SENSITIVE_FIELDS = ("sign", "csrf_token", "session_id")

JOB_STATES = ("idle", "analyzing", "ready", "running", "finished", "stopped", "error")
TASK_STATES = ("pending", "running", "completed", "skipped", "failed", "stopped")
_BUSY_STATES = ("analyzing", "ready", "running")
_TERMINAL_RESETTABLE = ("ready", "finished", "stopped", "error")


def _now():
    return time.time()


class YukeJobManager:
    """进程内单活动 Job。所有可变状态由 _lock 保护；回调自带加锁供核心线程调用。"""

    def __init__(self, core_factory=None):
        from yuketang_core import get_core
        self._make_core = core_factory or get_core
        self._lock = threading.Lock()
        self._job = None            # dict | None
        self._stop_event = None
        self._thread = None

    # ---------- 公开操作 ----------

    def analyze(self, params):
        clean = validate_params(params)          # YukeParamError -> HTTP 400
        core = self._build_core(clean)           # 初始化失败 -> YukeParamError 400
        with self._lock:
            self._require_state(not_in=_BUSY_STATES,
                                msg=f"已有任务进行中（{self._state()}），不可重复分析")
        return self._begin_analyze(clean, core)

    def _build_core(self, params):
        """构造核心实例。工厂签名兼容零参注入（测试桩）与参数感知（真实核心）。"""
        try:
            return self._make_core(params)
        except TypeError:
            return self._make_core()

    def start(self):
        core = getattr(self, "_core", None) or self._build_core({})
        with self._lock:
            self._require_state(in_=("ready",), msg="只有 ready 状态可以开始执行")
            job = self._job
            job["state"] = "running"
            job["started_at"] = _now()
            self._thread = threading.Thread(
                target=self._run_execute, args=(core,), daemon=True)
            self._thread.start()
        return {"ok": True, "state": "running"}

    def stop(self):
        with self._lock:
            self._require_state(in_=("running",), msg="只有运行中的任务可以停止")
            self._stop_event.set()
        # 异步停止语义：立即返回，不等待线程；execute 收尾后才置 stopped
        return {"ok": True, "state": "running", "stop_requested": True}

    def reset(self):
        with self._lock:
            st = self._state()
            if st == "idle":
                raise YukeStateError("当前没有可重置的任务（idle）")
            self._require_state(in_=_TERMINAL_RESETTABLE,
                                msg="执行进行中不允许重置，请先停止")
            # 重置 = 完全清零（含日志），回到干净的参数填写态
            self._job = None
            self._stop_event = None
            self._thread = None
        return {"ok": True, "state": "idle"}

    def snapshot(self):
        with self._lock:
            if self._job is None:
                return {"ok": True, "state": "idle", "stop_requested": False,
                        "stats": _zero_stats(), "params_masked": None,
                        "workers": [], "current": None, "tasks": [],
                        "logs": [], "summary": None, "error": None}
            j = self._job
            tasks = [dict(t) for t in j["tasks"].values()]
            workers = [{"id": t["id"], "name": t["name"], "kind": t["kind"],
                        "pct": t["pct"]}
                       for t in tasks if t["status"] == "running"]
            current = max(workers, key=lambda w: w["pct"]) if workers else None
            return {
                "ok": True,
                "state": j["state"],
                "stop_requested": bool(j.get("_stop_flag")),
                "stats": _compute_stats(tasks),
                "params_masked": {k: ("***" if k in SENSITIVE_FIELDS else v)
                                  for k, v in j["params"].items()},
                "workers": workers,
                "current": current,
                "tasks": [{k: t[k] for k in
                           ("id", "kind", "name", "chapter", "status",
                            "pct", "detail")} for t in tasks],
                "logs": list(j["events"]),
                "summary": j["summary"],
                "error": j["error"],
            }

    # ---------- 内部：状态机与后台线程 ----------

    def _begin_analyze(self, clean_params, core):
        with self._lock:
            self._require_state(not_in=_BUSY_STATES,
                                msg=f"已有任务进行中（{self._state()}）")
            self._stop_event = threading.Event()
            self._core = core                    # 跨阶段复用同一实例（真实核心持有会话）
            self._job = {
                "state": "analyzing",
                "params": dict(clean_params),
                "tasks": {},
                "events": deque(maxlen=200),
                "summary": None,
                "error": None,
                "_stop_flag": False,
                "created_at": _now(),
                "started_at": None,
                "ended_at": None,
            }
            self._thread = threading.Thread(
                target=self._run_analyze, args=(core,), daemon=True)
            self._thread.start()
        return {"ok": True, "state": "analyzing"}

    def _run_analyze(self, core):
        try:
            found = core.analyze(self._job_params(),
                                 emit_log=lambda *a, **k: self._emit_log(*a, **k))
            with self._lock:
                job = self._job
                if job is None or job["state"] != "analyzing":
                    return                       # 已被外部重置/替换
                for t in found:
                    job["tasks"][t["id"]] = {
                        "id": t["id"], "kind": t["kind"], "name": t["name"],
                        "chapter": t["chapter"], "status": "pending",
                        "pct": 0, "detail": "",
                    }
                job["state"] = "ready"
        except Exception as exc:                 # noqa: BLE001 —— 线程兜底
            self._fail_job(str(exc))

    def _run_execute(self, core):
        stop_event = self._stop_event
        try:
            with self._lock:
                job = self._job
                task_list = [dict(t) for t in job["tasks"].values()]
                params = dict(job["params"])
            summary = core.execute(
                params, task_list,
                emit_task=lambda *a, **k: self._emit_task(*a, **k),
                emit_log=lambda *a, **k: self._emit_log(*a, **k),
                stop_event=stop_event)
            was_stopped = stop_event.is_set()
            with self._lock:
                job = self._job
                if job is None or job["state"] != "running":
                    return
                self._finalize_running_tasks(was_stopped)
                job["summary"] = summary
                job["ended_at"] = _now()
                job["state"] = "stopped" if was_stopped else "finished"
        except Exception as exc:                 # noqa: BLE001
            self._fail_job(f"执行异常: {exc}")

    def _finalize_running_tasks(self, was_stopped):
        """execute 返回时仍在 running 的孤儿任务统一收尾（D9 语义）"""
        for t in self._job["tasks"].values():
            if t["status"] == "running":
                t["status"] = "stopped" if was_stopped else "failed"
                t["detail"] = t["detail"] or (
                    "已随停止请求结束" if was_stopped else "未正常收尾")
                t["ended_at"] = t.get("ended_at") or _now()

    def _fail_job(self, msg):
        with self._lock:
            if self._job is not None and self._job["state"] in _BUSY_STATES:
                self._job["state"] = "error"
                self._job["error"] = str(msg)[:300]
                self._job["ended_at"] = _now()
        self._emit_log("error", "job_error", str(msg))

    # ---------- 回调（供 Core 在工作线程调用，自带加锁） ----------

    def _emit_log(self, level, event, msg="", task_id=None):
        with self._lock:
            if self._job is not None:
                self._job["events"].append({
                    "ts": round(_now(), 3), "level": level, "event": event,
                    "task_id": task_id, "msg": str(msg)[:200],
                })

    def _emit_task(self, task_id, status=None, pct=None, detail=None):
        with self._lock:
            if self._job is None:
                return
            t = self._job["tasks"].get(task_id)
            if t is None:
                return
            if status is not None:
                t["status"] = status
            if pct is not None:
                pct = max(0, min(100, int(pct)))
                if pct >= t["pct"]:              # 单调不减
                    t["pct"] = pct
            if detail is not None:
                t["detail"] = str(detail)[:200]

    # ---------- 小工具（调用方需持锁） ----------

    def _state(self):
        return self._job["state"] if self._job else "idle"

    def _job_params(self):
        with self._lock:
            return dict(self._job["params"]) if self._job else {}

    def _require_state(self, in_=None, not_in=None, msg=""):
        st = self._state()
        if in_ is not None and st not in in_:
            raise YukeStateError(f"{msg}（当前状态: {st}）")
        if not_in is not None and st in not_in:
            raise YukeStateError(f"{msg}（当前状态: {st}）")


def _zero_stats():
    return {"total": 0, "done": 0, "skipped": 0, "failed": 0,
            "stopped": 0, "active": 0, "queued": 0}


def _compute_stats(tasks):
    c = {"pending": 0, "running": 0, "completed": 0, "skipped": 0,
         "failed": 0, "stopped": 0}
    for t in tasks:
        c[t["status"]] += 1
    return {"total": len(tasks), "done": c["completed"],
            "skipped": c["skipped"], "failed": c["failed"],
            "stopped": c["stopped"], "active": c["running"],
            "queued": c["pending"]}
