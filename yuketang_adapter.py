# yuketang_adapter.py — RealYukeCore：把已验证可用的长江雨课堂脚本接入 Core 窄接口
#
# 上游来源：https://github.com/Gary-666/yuketang （main.py，本地由
# config.YUKETANG_SRC_DIR 指向，打包时随附于 vendor/ 或 _MEIPASS）。
#
# 设计要点（实现遵循原 spec §9 与 adapter 注释）：
#   1. 通过 importlib 以独立模块名加载上游 main.py —— 规避与本仓库入口
#      main.py 的重名冲突，也不污染 sys.path；加载前预置 dotenv 桩模块
#      （上游顶层调用 load_dotenv()，本集成改为参数直传，不需要它）。
#   2. 子类 ProgressHeartbeat(YuketangHeartbeat) 三处增强：
#      - send_heartbeat        → 响应 stop_event（抛 StopRequested）+
#                                解析 cp/duration 回传结构化进度
#      - view_richtext         → 图文状态回调（沿用上游实现）
#      - create_worker_instance → ★必须重写：worker 必须以子类类型创建，
#        并携带与 Job 相同的 stop_event 与回调绑定。
#   3. 视频编排复用上游 auto_configure_from_ids / smart_watch_video /
#      get_current_progress_info；图文用薄循环调 view_richtext 插入钩子。
#   4. stop 语义：StopRequested 一路上抛 → 该任务标记 stopped；
#      任务间与阶段间检查 stop_event，剩余任务保持 pending。
import importlib.util
import json
import logging
import os
import sys
import threading
import time
import types

from yuketang_core import YukeParamError

log = logging.getLogger("yk.real")


# ---------------- 上游模块加载 ----------------

def _install_dotenv_stub():
    """上游 main.py 顶层执行 load_dotenv()；我们走参数直传，给它一个空实现即可，
    避免为打包引入 python-dotenv 依赖。"""
    if "dotenv" not in sys.modules:
        stub = types.ModuleType("dotenv")
        stub.load_dotenv = lambda *a, **k: False
        sys.modules["dotenv"] = stub


_MODULE_CACHE = {}
_MODULE_LOCK = threading.Lock()


def load_upstream_module(src_dir):
    """按路径加载上游 main.py 为独立模块（线程安全，带缓存）。"""
    key = os.path.abspath(src_dir)
    with _MODULE_LOCK:
        mod = _MODULE_CACHE.get(key)
        if mod is not None:
            return mod
        path = os.path.join(key, "main.py")
        if not os.path.isfile(path):
            raise YukeParamError(
                f"未找到雨课堂脚本源码: {path}（请检查 config.YUKETANG_SRC_DIR 或 vendor 目录）")
        _install_dotenv_stub()
        spec = importlib.util.spec_from_file_location("yk_real_main", path)
        mod = importlib.util.module_from_spec(spec)
        sys.modules["yk_real_main"] = mod          # dataclass/装饰器场景兜底
        spec.loader.exec_module(mod)
        _MODULE_CACHE[key] = mod
        return mod


def resolve_src_dir(config_mod=None):
    """定位上游源码目录：环境变量 > config > PyInstaller 资源 > 开发默认。"""
    candidates = []
    env_dir = os.environ.get("YK_REAL_SRC_DIR")
    if env_dir:
        candidates.append(env_dir)
    if config_mod is not None:
        candidates.append(getattr(config_mod, "YUKETANG_SRC_DIR", ""))
    if getattr(sys, "_MEIPASS", ""):
        candidates.append(os.path.join(sys._MEIPASS, "yuketang_real"))
    candidates.append(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   "vendor", "yuketang"))
    for c in candidates:
        if c and os.path.isfile(os.path.join(c, "main.py")):
            return c
    return candidates[0] if candidates else ""


class StopRequested(Exception):
    """stop_event 置位后由心跳钩子抛出，用于中断上游观看循环。"""


# ---------------- 进度解析（纯函数，便于单测） ----------------

def heartbeat_pct(heart_data_list, duration):
    """从一批心跳数据里估算进度百分比（0~100）；无法计算返回 None。"""
    if not duration or duration <= 0 or not heart_data_list:
        return None
    cps = [h.get("cp") for h in heart_data_list
           if isinstance(h.get("cp"), (int, float))]
    if not cps:
        return None
    return max(0, min(100, round(max(cps) / float(duration) * 100)))


# ---------------- RealYukeCore ----------------

class RealYukeCore:
    """与 MockCore 同签名的真实核心：驱动长江雨课堂线上接口。

    参数（validate_params 清洗后的 dict）：
        classroom_id / sign / university_id / csrf_token / session_id
        + 运行参数（video_speed、max_workers、test_mode…见 yuketang_core）

    说明：
    - 认证字段仅保存在内存会话中，不落盘、不写入日志。
    - classroom_id 命中演示哨兵（demo*/111/test…）时由 get_core 路由到
      MockCore，不会进入本类。
    """

    def __init__(self, params=None):
        self.params = dict(params or {})
        import config
        self.src_dir = resolve_src_dir(config)
        self.upstream = load_upstream_module(self.src_dir)

    # ---- 工具 ----

    @staticmethod
    def _cookies_from(params, classroom_id):
        uid = str(params.get("university_id", ""))
        return {
            "login_type": "WX",
            "csrftoken": params.get("csrf_token", ""),
            "sessionid": params.get("session_id", ""),
            "django_language": "zh-cn",
            "uv_id": uid,
            "university_id": uid,
            "platform_id": "3",
            "classroomId": str(classroom_id),
            "classroom_id": str(classroom_id),
            "xtbz": "ykt",
            "platform_type": "1",
        }

    def _base_heartbeat(self, params):
        """构造基础实例（用于发现阶段的章节/列表接口）。"""
        cid = str(params.get("classroom_id", ""))
        cookies = self._cookies_from(params, cid)
        hb = self.upstream.YuketangHeartbeat(cookies)
        hb.video_params = {
            "uv_id": params.get("university_id", ""),
            "university_id": params.get("university_id", ""),
            "csrf_token": params.get("csrf_token", ""),
        }
        return hb

    def _progress_heartbeat(self, params, classroom_id, task_id,
                            stop_event, emit_task, emit_log):
        """带进度回传与停止钩子的工作实例。"""
        cid = str(classroom_id)
        cookies = self._cookies_from(params, cid)
        hb = self.upstream.YuketangHeartbeat(cookies)
        stop = stop_event

        def patched_send(heart_data_list):
            if stop is not None and stop.is_set():
                raise StopRequested("收到停止请求")
            resp = type(hb).send_heartbeat(hb, heart_data_list)
            pct = heartbeat_pct(heart_data_list,
                                hb.video_params.get("duration", 0))
            if pct is not None:
                emit_task(task_id, pct=pct)
            return resp

        hb.send_heartbeat = patched_send           # 实例级覆盖，仅影响该 worker
        return hb

    # ---- Core 接口：analyze ----

    def analyze(self, params, emit_log):
        cid = str(params.get("classroom_id", ""))
        sign = params.get("sign", "") or None
        hb = self._base_heartbeat(params)

        emit_log("info", "discover", "正在拉取课程章节结构…")
        videos = hb.get_video_leaf_list(cid, sign) or []
        richtexts = hb.get_richtext_leaf_list(cid, sign) or []
        if not videos and not richtexts:
            raise YukeParamError(
                "未在课堂中发现视频/图文任务：请核对课堂ID与SIGN是否正确、"
                "账号是否已加入该课堂")

        tasks = []
        for v in videos:
            tasks.append({"id": str(v["id"]), "kind": "video",
                          "name": v.get("name") or "未命名视频",
                          "chapter": v.get("chapter_name") or ""})
            emit_log("info", "discover",
                     f"发现视频 {v.get('name')}", task_id=str(v["id"]))
        for r in richtexts:
            tasks.append({"id": str(r["id"]), "kind": "richtext",
                          "name": r.get("name") or "未命名图文",
                          "chapter": r.get("chapter_name") or ""})
            emit_log("info", "discover",
                     f"发现图文 {r.get('name')}", task_id=str(r["id"]))
        emit_log("info", "discover_done",
                 f"发现完成：视频 {len(videos)} 个，图文 {len(richtexts)} 篇")
        return tasks

    # ---- Core 接口：execute ----

    def execute(self, params, tasks, emit_task, emit_log, stop_event):
        cid = str(params.get("classroom_id", ""))
        sign = params.get("sign", "") or None
        speed = max(0.25, float(params.get("video_speed", 1.5)))
        interval = max(1, int(params.get("heartbeat_interval", 5)))
        summary = {"total": len(tasks), "completed": 0, "skipped": 0,
                   "failed": 0, "stopped": 0}

        def finish(task, status, detail="", done_pct=False):
            if stop_event.is_set() and status == "completed":
                status = "stopped"
            summary[status] += 1
            emit_task(task["id"], status=status,
                      pct=100 if done_pct else None, detail=detail)

        work = list(tasks)
        if params.get("test_mode"):
            work = work[:int(params.get("test_video_count", 0))]

        # ---- 阶段一：图文串行打卡 ----
        if params.get("auto_richtext"):
            stay = float(params.get("richtext_stay_seconds", 0))
            gap = float(params.get("richtext_skip_delay", 0))
            hb = self._base_heartbeat(params)
            rich = [t for t in work if t["kind"] == "richtext"]
            for i, t in enumerate(rich):
                if stop_event.is_set():
                    break
                emit_task(t["id"], status="running")
                try:
                    hb.view_richtext(cid, t["id"], t["name"], stay_seconds=stay)
                except Exception as exc:               # noqa: BLE001
                    finish(t, "failed", detail=f"图文打卡失败: {exc}")
                else:
                    finish(t, "completed", detail="图文打卡完成", done_pct=True)
                if i < len(rich) - 1 and gap > 0 and not stop_event.is_set():
                    remain = gap
                    while remain > 0 and not stop_event.is_set():
                        step = min(0.2, remain)
                        time.sleep(step)
                        remain -= step

        # ---- 阶段二：视频并发（复用上游 worker 全流程）----
        vids = [t for t in work if t["kind"] == "video"]

        def video_worker(t):
            tid = t["id"]
            if stop_event.is_set():
                return
            hb = self._progress_heartbeat(params, cid, tid,
                                          stop_event, emit_task, emit_log)
            emit_task(tid, status="running")
            try:
                if not hb.auto_configure_from_ids(cid, tid, sign):
                    finish(t, "failed", detail="视频参数自动配置失败")
                    return
                if params.get("skip_completed"):
                    info = hb.get_current_progress_info()
                    if info and info.get("rate", 0) >= 0.9:
                        finish(t, "skipped", detail="服务器已完成，自动跳过",
                               done_pct=True)
                        return
                emit_log("info", "watch_start",
                         f"开始播放 {t['name']}（倍速 x{speed}）", task_id=tid)
                ok = hb.smart_watch_video(speed=speed, interval=interval)
                if stop_event.is_set():
                    finish(t, "stopped", detail="已随停止请求结束")
                elif ok:
                    finish(t, "completed", detail="播放完成", done_pct=True)
                else:
                    finish(t, "failed", detail="播放未完成（详见日志）")
            except StopRequested:
                finish(t, "stopped", detail="已随停止请求结束")
            except Exception as exc:                   # noqa: BLE001
                if stop_event.is_set():
                    finish(t, "stopped", detail=f"已停止（{exc}）")
                else:
                    finish(t, "failed", detail=f"异常: {exc}")

        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(
                max_workers=int(params.get("max_workers", 3))) as pool:
            list(pool.map(video_worker, vids))

        emit_log("info", "execute_done", str(summary))
        return summary
