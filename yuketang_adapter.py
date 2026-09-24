# yuketang_adapter.py — RealYukeCore：将项目内嵌的雨课堂客户端接入 Core 窄接口
#
# 实现参考：https://github.com/Gary-666/yuketang 。运行时不读取该仓库、
# 不扫描外部目录，也不加载 .env；认证字段由当前应用内存会话直接传入。
#
# 设计要点：内嵌客户端负责 HTTP 协议；本层仅负责平台档案、进度标准化、
# 任务状态回调和停止语义，避免把界面状态耦合到网络请求实现。
import time
import types

from yuketang_core import YukeParamError
from yuketang_native import NativeYuketangHeartbeat

# 平台档案与 yuketang_core._PLATFORM_HOSTS 保持一致。不要接受任意域名：认证
# Cookie 只应随请求发送到应用明确支持的平台。
_PLATFORM_PROFILES = {
    "changjiang.yuketang.cn": {"xtbz": "ykt", "skip_classroom_info": False},
    # 参考仓库的课程章节接口以 ykt 为主；南京农业大学入口站也先沿用该
    # 协议。若站点明确拒绝，再在 NativeYuketangHeartbeat 中回退 cloud。
    # 课堂信息端点为可选项，南京站不请求它以避免无意义的 400。
    "njauyjs.yuketang.cn": {
        "xtbz": "ykt", "fallback_xtbz": "cloud", "skip_classroom_info": True,
    },
}


def platform_profile(params):
    """返回经过参数校验的平台档案；异常值安全回退到长江站。"""
    host = str((params or {}).get("platform_host", "")).strip().lower()
    if host not in _PLATFORM_PROFILES:
        host = "changjiang.yuketang.cn"
    return host, _PLATFORM_PROFILES[host]


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


def _number(value):
    """将 API 中可能为字符串的数值转换为 float；布尔值不是有效进度。"""
    if isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _progress_candidates(payload, video_id):
    """枚举上游旧格式与高校站点常见的进度数据容器。"""
    if not isinstance(payload, dict):
        return []
    data = payload.get("data", payload)
    candidates = []
    if isinstance(data, dict):
        candidates.append(data.get(str(video_id)))
        candidates.append(data.get(video_id))
        for key in ("video_watch_progress", "video_progress", "progress"):
            candidates.append(data.get(key))
        candidates.append(data)
    elif isinstance(data, list):
        for item in data:
            if not isinstance(item, dict):
                continue
            item_id = item.get("video_id", item.get("id"))
            if item_id is None or str(item_id) == str(video_id):
                candidates.append(item)
    return [item for item in candidates if isinstance(item, dict)]


def normalize_progress(payload, video_id, duration=0):
    """标准化不同进度响应为上游 smart_watch_video 所需的字典。

    旧脚本只接受 ``{code: 0, data: {video_id: {rate, last_point}}}``。
    部分站点直接返回进度对象或用 ``progress`` 包装，导致它误判为“无进度”。
    这里只读取明确的进度字段，不推测失败响应。
    """
    if not isinstance(payload, dict):
        return None
    code = payload.get("code")
    if code is not None and str(code) not in ("0", "200"):
        return None
    for item in _progress_candidates(payload, video_id):
        rate = _number(item.get("rate", item.get("progress_rate", item.get("progress"))))
        point = _number(item.get("last_point", item.get("last_position",
                        item.get("lastPosition", item.get("point")))))
        total = _number(duration) or 0
        if rate is None and point is not None and total > 0:
            rate = point / total
        if rate is None:
            continue
        # 有些接口用 0~100，旧脚本使用 0~1 的比例。
        if rate > 1:
            rate /= 100.0
        rate = max(0.0, min(1.0, rate))
        return {"rate": rate, "last_point": max(0.0, point or 0.0),
                "duration": total}
    return None


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
        # 保留该属性以兼容测试注入；默认实现完全在本项目内。
        self.upstream = types.SimpleNamespace(YuketangHeartbeat=NativeYuketangHeartbeat)

    # ---- 工具 ----

    @staticmethod
    def _cookies_from(params, classroom_id):
        uid = str(params.get("university_id", ""))
        _, profile = platform_profile(params)
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
            "xtbz": profile["xtbz"],
            "platform_type": "1",
        }

    @staticmethod
    def _valid_university_id(value, fallback):
        """叶子接口偶尔省略学校 ID 或返回 0；保持用户填写的有效 ID。"""
        text = str(value or "").strip()
        return text if text and text not in {"0", "none", "null"} else str(fallback or "")

    def _configure_heartbeat(self, hb, params):
        """为上游实例应用所选平台，并修正其硬编码的长江站细节。"""
        host, profile = platform_profile(params)
        base_url = "https://" + host
        hb.base_url = base_url
        hb.heartbeat_url = base_url + "/video-log/heartbeat/"
        hb.progress_url = base_url + "/video-log/get_video_watch_progress/"
        hb.headers.update({"Origin": base_url, "xtbz": profile["xtbz"]})
        hb.course_xtbz_fallback = profile.get("fallback_xtbz")

        native_set_video_params = hb.set_video_params

        def set_video_params(*args, **kwargs):
            # 上游 auto_configure_from_ids 用关键字调用；位置参数分支使该适配
            # 也兼容未来上游仍保留原方法签名的版本。
            if "university_id" in kwargs:
                kwargs = dict(kwargs)
                fallback = params.get("university_id", "")
                kwargs["university_id"] = self._valid_university_id(
                    kwargs.get("university_id"), fallback)
                kwargs["uv_id"] = self._valid_university_id(
                    kwargs.get("uv_id"), kwargs["university_id"])
                kwargs["csrf_token"] = kwargs.get("csrf_token") or params.get("csrf_token", "")
                result = native_set_video_params(*args, **kwargs)
            else:
                values = list(args)
                if len(values) >= 10:
                    values[8] = self._valid_university_id(values[8], params.get("university_id", ""))
                    values[9] = self._valid_university_id(values[9], values[8])
                    if not values[7]:
                        values[7] = params.get("csrf_token", "")
                result = native_set_video_params(*values)
            classroom_id = hb.video_params.get("classroom_id", "")
            video_id = hb.video_params.get("video_id", "")
            hb.headers.update({
                "Origin": base_url,
                "Referer": f"{base_url}/v2/web/xcloud/video-student/{classroom_id}/{video_id}",
                "xtbz": profile["xtbz"],
                "university-id": str(hb.video_params.get("university_id", "")),
                "uv-id": str(hb.video_params.get("uv_id", "")),
            })
            return result

        hb.set_video_params = set_video_params

        def get_current_progress_info():
            return normalize_progress(
                hb.get_video_progress(), hb.video_params.get("video_id", ""),
                hb.video_params.get("duration", 0))

        hb.get_current_progress_info = get_current_progress_info

        # 上游播放地址接口也把 domain 写死为 changjiang；按当前站点重发同一
        # 请求参数。此函数只在真实执行阶段调用，单元测试使用假 Session。
        def get_video_play_url(video_id, provider="cc", file_type=1, is_single=0):
            try:
                response = hb.session.get(
                    base_url + "/api/open/audiovideo/playurl",
                    headers={**hb.headers, "Accept": "application/json, text/plain, */*",
                             "Xt-Agent": "web"},
                    params={"video_id": video_id, "provider": provider,
                            "file_type": file_type, "is_single": is_single,
                            "domain": host}, timeout=10)
                return response.json() if response.status_code == 200 else None
            except Exception:  # noqa: BLE001 - 与上游方法的失败语义保持一致
                return None

        hb.get_video_play_url = get_video_play_url
        if profile["skip_classroom_info"]:
            hb.get_classroom_info = lambda classroom_id: None
        return hb

    def _base_heartbeat(self, params):
        """构造基础实例（用于发现阶段的章节/列表接口）。"""
        cid = str(params.get("classroom_id", ""))
        cookies = self._cookies_from(params, cid)
        hb = self.upstream.YuketangHeartbeat(cookies)
        self._configure_heartbeat(hb, params)
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
        self._configure_heartbeat(hb, params)
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
            diagnostic = str(getattr(hb, "last_course_error", "")).strip()
            suffix = f"（接口诊断：{diagnostic}）" if diagnostic else ""
            raise YukeParamError(
                "未在课堂中发现视频/图文任务：请核对课堂ID与SIGN是否正确、"
                f"账号是否已加入该课堂{suffix}")

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
