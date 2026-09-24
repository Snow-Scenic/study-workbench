# yuketang_core.py — Core 窄接口实现：参数校验 + MockCore（完全离线）
# RealYukeCore 见 yuketang_adapter.py（第二阶段），本文件不 import 真实脚本。
import random
import threading
import time
from concurrent.futures import ThreadPoolExecutor


class YukeError(Exception):
    """雨课堂业务错误基类"""


class YukeParamError(YukeError):
    """参数非法（HTTP 400）"""


class YukeStateError(YukeError):
    """Job 状态冲突（HTTP 409）"""


AUTH_FIELDS = ("classroom_id", "sign", "university_id", "csrf_token", "session_id")

# 运行参数默认值 —— 与原 yuketang-main main() 的 os.getenv 默认一一对应
_RUN_DEFAULTS = {
    # 只接受本应用内置的平台档案，避免认证信息被发送到任意用户输入的地址。
    "platform_host": "changjiang.yuketang.cn",
    "video_speed": 1.5,            # VIDEO_SPEED
    "heartbeat_interval": 5,       # HEARTBEAT_INTERVAL
    "max_workers": 3,              # MAX_CONCURRENT_VIDEOS
    "skip_completed": True,        # SKIP_COMPLETED
    "test_mode": False,            # TEST_MODE
    "test_video_count": 5,         # TEST_VIDEO_COUNT
    "use_concurrent": True,        # USE_CONCURRENT
    "auto_richtext": True,         # AUTO_RICHTEXT
    "richtext_stay_seconds": 3,    # RICHTEXT_STAY_SECONDS
    "richtext_skip_delay": 1,      # RICHTEXT_SKIP_DELAY
    "debug": False,                # DEBUG
}

_BOOL_PARAMS = {"skip_completed", "test_mode", "use_concurrent", "auto_richtext", "debug"}
_INT_PARAMS = {"heartbeat_interval", "max_workers", "test_video_count",
               "richtext_stay_seconds"}
_FLOAT_PARAMS = {"video_speed", "richtext_skip_delay"}

_CLAMP = {
    "video_speed": (0.25, 5.0),
    "heartbeat_interval": (1, 30),
    "max_workers": (1, 8),
    "test_video_count": (0, 50),
    "richtext_stay_seconds": (0, 30),
    "richtext_skip_delay": (0.0, 10.0),
}

_PLATFORM_HOSTS = {"changjiang.yuketang.cn", "njauyjs.yuketang.cn"}


def _coerce(name, raw):
    """把表单/JSON 值转成正确类型并钳制到合法区间；非法输入回退默认值"""
    if name == "platform_host":
        host = str(raw or "").strip().lower()
        return host if host in _PLATFORM_HOSTS else _RUN_DEFAULTS[name]
    if name in _BOOL_PARAMS:
        if isinstance(raw, bool):
            return raw
        return str(raw).strip().lower() in ("1", "true", "yes", "on")
    lo, hi = _CLAMP[name]
    try:
        if name in _INT_PARAMS:
            return max(lo, min(hi, int(float(str(raw).strip()))))
        return max(lo, min(hi, float(raw)))
    except (TypeError, ValueError):
        return _RUN_DEFAULTS[name]


def validate_params(payload):
    """校验并清洗 analyze 参数：认证 5 字段必填，运行参数带默认与钳制。"""
    missing = [f for f in AUTH_FIELDS
               if not str((payload or {}).get(f, "")).strip()]
    if missing:
        raise YukeParamError("缺少参数: " + ", ".join(missing))

    params = {f: str(payload[f]).strip() for f in AUTH_FIELDS}
    for name in _RUN_DEFAULTS:
        params[name] = _coerce(name, payload.get(name, _RUN_DEFAULTS[name]))
    return params


def get_core(params=None):
    """CORE_IMPL 选择器。

    - 'mock'  : 强制演示核心
    - 'real'  : 强制真实核心（需 config.YUKETANG_SRC_DIR 指向上游脚本）
    - 'auto'  : 默认。classroom_id 命中演示哨兵（demo*/111/test/000）→ Mock，
                否则走真实核心
    """
    import config
    impl = str(getattr(config, "CORE_IMPL", "auto")).lower()
    cid = str((params or {}).get("classroom_id", "")).strip().lower()
    demo = (cid.startswith("demo") or cid in ("111", "000", "test"))
    if impl == "real":
        from yuketang_adapter import RealYukeCore
        return RealYukeCore(dict(params or {}))
    if impl == "mock" or demo:
        return MockCore()
    if impl in ("auto", ""):
        from yuketang_adapter import RealYukeCore
        return RealYukeCore(dict(params or {}))
    return MockCore()


# ---------------- MockCore ----------------

_CHAPTERS = ["第一章 雨课堂基础认知", "第二章 课程任务解析",
             "第三章 视频学习进阶", "第四章 综合实战与总结"]

# 每章节点布局：V=视频 R=图文，总计 14V + 6R = 20（spec D8）
_PLAN_LAYOUT = (
    ("V R V V V".split(),),
    ("V V R V V".split(),),
    ("V R V R V".split(),),
    ("R V V V R".split(),),
)


def _build_plan():
    """生成恰好 20 个模拟任务的确定性课程计划"""
    plan, vi, ri = [], 0, 0
    for ci, (layout,) in enumerate(_PLAN_LAYOUT):
        for kind in layout:
            if kind == "V":
                vi += 1
                plan.append({"id": f"v{vi:02d}", "kind": "video",
                             "name": f"Video {vi:02d}",
                             "chapter": _CHAPTERS[ci]})
            else:
                ri += 1
                plan.append({"id": f"r{ri:02d}", "kind": "richtext",
                             "name": f"Richtext {ri:02d}",
                             "chapter": _CHAPTERS[ci]})
    return plan


class MockCore:
    """完全离线模拟核心：真线程并发、结构化回调、响应 stop_event"""

    TICK = 0.25           # 进度心跳间隔（秒）
    DISCOVER_STEP = 0.05  # 分析期逐任务发现间隔（秒）

    def analyze(self, params, emit_log):
        tasks = []
        for item in _build_plan():
            emit_log("info", "discover",
                     f"发现任务 {item['name']} · {item['chapter']}",
                     task_id=item["id"])
            time.sleep(self.DISCOVER_STEP)
            tasks.append(item)
        return tasks

    def execute(self, params, tasks, emit_task, emit_log, stop_event):
        rng = random.Random(str(params.get("classroom_id", "")))
        fast = bool(params.get("debug"))
        summary = {"total": len(tasks), "completed": 0, "skipped": 0,
                   "failed": 0, "stopped": 0}

        def finish(task, status, detail="", done_pct=False):
            if stop_event.is_set() and status == "completed":
                status = "stopped"          # 停止后不允许新增 completed（D9）
            summary[status] += 1
            emit_task(task["id"], status=status,
                      pct=100 if done_pct else None, detail=detail)

        # ---- 任务集：TEST_MODE 只取前 N 个（spec §8.2）----
        work = list(tasks)
        if params.get("test_mode"):
            work = work[:int(params.get("test_video_count", 0))]

        # ---- 阶段一：图文串行（对应原 AUTO_RICHTEXT）----
        if params.get("auto_richtext"):
            stay = float(params.get("richtext_stay_seconds", 0))
            gap = float(params.get("richtext_skip_delay", 0))
            richtexts = [x for x in work if x["kind"] == "richtext"]
            for i, t in enumerate(richtexts):
                if stop_event.is_set():
                    break                    # 其余保持 pending
                emit_task(t["id"], status="running")
                remain = stay
                while remain > 0 and not stop_event.is_set():
                    step = min(0.2, remain)
                    time.sleep(step)
                    remain -= step
                if stop_event.is_set():
                    finish(t, "stopped", detail="停止于阅读停留")
                    break
                if rng.random() < 0.05:
                    finish(t, "failed", detail="模拟图文打卡失败")
                else:
                    finish(t, "completed", detail="已读打卡完成", done_pct=True)
                if i < len(richtexts) - 1 and gap > 0:
                    remain = gap
                    while remain > 0 and not stop_event.is_set():
                        step = min(0.2, remain)
                        time.sleep(step)
                        remain -= step

        # ---- 阶段二：视频真并发（ThreadPoolExecutor）----
        vids = [x for x in work if x["kind"] == "video"]

        def worker(t):
            if stop_event.is_set():
                return                       # 未开始者保持 pending
            skip = (not params.get("test_mode")) and rng.random() < 0.10
            fail_at = None
            if (not params.get("test_mode")) and rng.random() < 0.06:
                fail_at = rng.uniform(0.35, 0.70)   # 相对进度处失败
            emit_task(t["id"], status="running")

            if skip:
                finish(t, "skipped", detail="服务器已完成，自动跳过",
                       done_pct=True)
                return

            duration = rng.uniform(180, 600)         # 模拟视频秒数
            speed = max(0.25, float(params.get("video_speed", 1.5)))
            real = duration / speed * (0.002 if fast else 0.02)
            real = max(0.6, min(1.5 if fast else 12.0, real))
            ticks = max(6, int(real / self.TICK))
            fail_tick = int(ticks * fail_at) if fail_at is not None else None

            for i in range(ticks):
                if stop_event.is_set():
                    finish(t, "stopped", detail="已随停止请求结束")
                    return
                time.sleep(self.TICK)
                pct = int((i + 1) / ticks * 100)
                if fail_tick is not None and i >= fail_tick:
                    finish(t, "failed", detail=f"模拟播放中断 @{pct}%")
                    return
                emit_task(t["id"], pct=pct)
            finish(t, "completed", detail="播放完成", done_pct=True)

        with ThreadPoolExecutor(
                max_workers=int(params.get("max_workers", 3))) as pool:
            list(pool.map(worker, vids))

        emit_log("info", "execute_done", str(summary))
        return summary
