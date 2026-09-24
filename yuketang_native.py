"""项目内雨课堂 HTTP 客户端。

只提供控制台所需的课程目录、图文状态和视频心跳能力；认证数据由调用方
保存在内存中传入，模块不会读取 .env、不会写入凭据或访问本地参考目录。
"""
import json
import random
import struct
import threading
import time

import requests


class NativeYuketangHeartbeat:
    """与 RealYukeCore 对接的最小会话对象。"""

    def __init__(self, cookies=None):
        cookies = dict(cookies or {})
        self.session = requests.Session()
        self.session.cookies.update(cookies)
        self.base_url = "https://changjiang.yuketang.cn"
        self.heartbeat_url = self.base_url + "/video-log/heartbeat/"
        self.progress_url = self.base_url + "/video-log/get_video_watch_progress/"
        self.headers = {
            # 与参考仓库的浏览器请求头保持一致。课程章节接口会校验其中
            # 一部分字段，过度精简会被部分高校入口站返回空列表或拒绝。
            "Accept": "*/*",
            "Accept-Language": "en,zh-CN;q=0.9,zh;q=0.8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "application/json",
            "Origin": self.base_url,
            "Pragma": "no-cache",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
            "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "xtbz": cookies.get("xtbz", "ykt"),
        }
        self.video_params = {}
        self._fallback_university_id = str(cookies.get("university_id", ""))
        self._sequence = 0
        self._sequence_lock = threading.Lock()
        self.course_xtbz_fallback = None
        self.last_course_error = ""

    def _json_get(self, path, *, params=None, headers=None, timeout=10):
        try:
            response = self.session.get(self.base_url + path, params=params,
                                        headers=headers or self.headers, timeout=timeout)
            return response.json() if response.status_code == 200 else None
        except (requests.RequestException, ValueError):
            return None

    def _course_headers(self, classroom_id):
        return {
            **self.headers,
            "X-CSRFToken": str(self.video_params.get("csrf_token", "")),
            "classroom-id": str(classroom_id),
            "university-id": str(self.video_params.get("university_id", "")),
            "uv-id": str(self.video_params.get("uv_id", "")),
            "platform-id": "3",
            "terminal-type": "web",
            "x-client": "web",
        }

    def get_course_chapters(self, classroom_id, sign=None):
        """获取课程章节，并保留不含凭据的失败诊断。

        原先通用的 _json_get 会把 401/403/400、非 JSON 和接口业务错误全部
        折叠为 None，最终 UI 误报为“没有视频”。这里按参考仓库保留课程接口
        的请求语义，并只向 UI 返回状态码/服务端消息，不记录 Cookie 或 URL。
        """
        params = {
            "cid": str(classroom_id), "term": "latest",
            "uv_id": self.video_params.get("uv_id", ""),
            "classroom_id": str(classroom_id),
        }
        if sign:
            params["sign"] = str(sign)
        self.last_course_error = ""
        base_headers = self._course_headers(classroom_id)
        primary_xtbz = str(base_headers.get("xtbz", "ykt"))
        variants = [primary_xtbz]
        fallback_xtbz = str(self.course_xtbz_fallback or "").strip()
        if fallback_xtbz and fallback_xtbz not in variants:
            variants.append(fallback_xtbz)

        failures = []
        for xtbz in variants:
            headers = {**base_headers, "xtbz": xtbz}
            try:
                response = self.session.get(
                    self.base_url + "/mooc-api/v1/lms/learn/course/chapter",
                    params=params, headers=headers, timeout=10)
            except requests.RequestException as exc:
                failures.append(f"网络请求失败：{type(exc).__name__}")
                continue

            if response.status_code != 200:
                failures.append(f"章节接口返回 HTTP {response.status_code}")
                continue
            try:
                payload = response.json()
            except ValueError:
                failures.append("章节接口返回的不是 JSON")
                continue
            if isinstance(payload, dict) and payload.get("success"):
                return payload

            message = ""
            if isinstance(payload, dict):
                message = str(payload.get("msg") or payload.get("message") or "").strip()
            failures.append("章节接口未成功" + (f"：{message[:120]}" if message else ""))

        self.last_course_error = "；".join(dict.fromkeys(failures)) or "章节接口未返回有效数据"
        return None

    @staticmethod
    def _walk_nodes(node, inherited_name=""):
        """深度遍历课程 section/leaf 结构，保留父节点名称作为回退。"""
        if not isinstance(node, dict):
            return
        name = node.get("name") or inherited_name or "未命名课件"
        yield node, name
        for child in node.get("leaf_list") or []:
            yield from NativeYuketangHeartbeat._walk_nodes(child, name)

    def _task_list(self, classroom_id, sign, target_type):
        payload = self.get_course_chapters(classroom_id, sign)
        if not isinstance(payload, dict) or not payload.get("success"):
            return []
        chapters = payload.get("data", {}).get("course_chapter", [])
        found, seen = [], set()
        for chapter in chapters if isinstance(chapters, list) else []:
            chapter_name = chapter.get("name") or "未命名章节"
            for section in chapter.get("section_leaf_list") or []:
                for node, name in self._walk_nodes(section):
                    leaf_type = node.get("leaf_type")
                    is_target = leaf_type == target_type
                    # 某些旧目录把视频 section 本身作为叶子，leaf_type 为空。
                    if target_type == 0 and node is section and leaf_type is None and not node.get("leaf_list"):
                        is_target = True
                    if not is_target:
                        continue
                    leaf_id = node.get("id") or node.get("leafinfo_id")
                    if leaf_id is None or str(leaf_id) in seen:
                        continue
                    seen.add(str(leaf_id))
                    found.append({
                        "id": leaf_id, "name": name, "chapter_name": chapter_name,
                        "leaf_type": leaf_type, "sku_id": node.get("sku_id"),
                        "leafinfo_id": node.get("leafinfo_id"),
                    })
        return found

    def get_video_leaf_list(self, classroom_id, sign=None, debug=False):
        return self._task_list(classroom_id, sign, 0)

    def get_richtext_leaf_list(self, classroom_id, sign=None, debug=False):
        return self._task_list(classroom_id, sign, 3)

    def view_richtext(self, classroom_id, leaf_id, leaf_name="未命名图文", stay_seconds=3):
        headers = self._course_headers(classroom_id)
        status = self._json_get(
            f"/mooc-api/v1/lms/learn/user_article_finish_status/{leaf_id}/",
            headers=headers)
        if isinstance(status, dict) and status.get("data", {}).get("finish") == 1:
            return True
        if stay_seconds > 0:
            time.sleep(stay_seconds)
        result = self._json_get(
            f"/mooc-api/v1/lms/learn/user_article_finish/{leaf_id}/", headers=headers,
            timeout=15)
        return bool(isinstance(result, dict) and result.get("success"))

    def get_leaf_info(self, classroom_id, leaf_id):
        return self._json_get(
            f"/mooc-api/v1/lms/learn/leaf_info/{classroom_id}/{leaf_id}/",
            headers=self._course_headers(classroom_id))

    def get_video_play_url(self, video_id, provider="cc", file_type=1, is_single=0):
        return self._json_get("/api/open/audiovideo/playurl", params={
            "video_id": video_id, "provider": provider, "file_type": file_type,
            "is_single": is_single, "domain": self.base_url.removeprefix("https://"),
        })

    def _video_duration(self, play_url):
        """从 MP4 的 mvhd atom 读取时长；失败时返回 0，不猜测播放进度。"""
        if not play_url:
            return 0
        try:
            response = self.session.get(play_url, stream=True, timeout=20)
            if response.status_code != 200:
                return 0
            data = b""
            for chunk in response.iter_content(65536):
                data += chunk
                if len(data) > 2 * 1024 * 1024:
                    break
                marker = data.find(b"mvhd")
                if marker < 0:
                    continue
                version = data[marker + 4] if len(data) > marker + 4 else -1
                if version == 0 and len(data) >= marker + 24:
                    scale, duration = struct.unpack(">II", data[marker + 16:marker + 24])
                elif version == 1 and len(data) >= marker + 36:
                    scale = struct.unpack(">I", data[marker + 24:marker + 28])[0]
                    duration = struct.unpack(">Q", data[marker + 28:marker + 36])[0]
                else:
                    continue
                return duration / scale if scale else 0
        except requests.RequestException:
            return 0
        return 0

    @staticmethod
    def _number(value):
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0

    def set_video_params(self, user_id, course_id, video_id, sku_id, classroom_id,
                         cc_id, duration, csrf_token, university_id, uv_id):
        self.video_params = {
            "user_id": user_id, "course_id": course_id, "video_id": video_id,
            "sku_id": sku_id, "classroom_id": classroom_id, "cc_id": cc_id,
            "duration": self._number(duration), "csrf_token": csrf_token,
            "university_id": university_id, "uv_id": uv_id,
        }
        self.headers.update({
            "X-CSRFToken": str(csrf_token), "classroom-id": str(classroom_id),
            "university-id": str(university_id), "uv-id": str(uv_id),
            "Referer": f"{self.base_url}/v2/web/xcloud/video-student/{classroom_id}/{video_id}",
        })

    def auto_configure_from_ids(self, classroom_id, leaf_id, sign=None):
        leaf = self.get_leaf_info(classroom_id, leaf_id)
        if not isinstance(leaf, dict) or not leaf.get("success"):
            return False
        data = leaf.get("data") or {}
        media = (data.get("content_info") or {}).get("media") or {}
        user_id, course_id, sku_id = data.get("user_id"), data.get("course_id"), data.get("sku_id")
        cc_id = media.get("ccid") or media.get("cc_id") or media.get("cc") or media.get("video_id")
        if not all((user_id, course_id, sku_id, cc_id)):
            return False
        duration = self._number(media.get("duration"))
        if duration <= 0:
            play = self.get_video_play_url(cc_id)
            sources = ((play or {}).get("data", {}).get("playurl", {}).get("sources", {}))
            urls = [url for values in sources.values() for url in values] if isinstance(sources, dict) else []
            duration = self._video_duration(urls[0] if urls else "")
        if duration <= 0:
            return False
        university_id = data.get("university_id") or self._fallback_university_id
        csrf = self.video_params.get("csrf_token") or self.session.cookies.get("csrftoken", "")
        self.set_video_params(user_id, course_id, leaf_id, sku_id, classroom_id, cc_id,
                              duration, csrf, university_id, university_id)
        return True

    def get_video_progress(self):
        p = self.video_params
        params = {"cid": p.get("course_id"), "user_id": p.get("user_id"),
                  "classroom_id": p.get("classroom_id"), "video_type": "video",
                  "vtype": "rate", "video_id": p.get("video_id"), "snapshot": 1}
        try:
            response = self.session.get(self.progress_url, headers=self.headers,
                                        params=params, timeout=10)
            return response.json() if response.status_code == 200 else None
        except (requests.RequestException, ValueError):
            return None

    def create_heartbeat_data(self, event_type, current_position, first_position=None, speed=1.0):
        p = self.video_params
        first_position = current_position if first_position is None else first_position
        with self._sequence_lock:
            self._sequence += 1
            sequence = self._sequence
        return {"i": 5, "et": event_type, "p": "web", "n": "ali-cdn.xuetangx.com",
                "lob": "ykt", "cp": current_position, "fp": first_position,
                "tp": current_position, "sp": speed, "ts": str(int(time.time() * 1000)),
                "u": p["user_id"], "uip": "", "c": p["course_id"], "v": p["video_id"],
                "skuid": p["sku_id"], "classroomid": str(p["classroom_id"]), "cc": p["cc_id"],
                "d": p["duration"], "pg": f"{p['video_id']}_q8mn", "sq": sequence,
                "t": "video", "cards_id": 0, "slide": 0, "v_url": ""}

    def send_heartbeat(self, heart_data_list):
        try:
            response = self.session.post(self.heartbeat_url, headers=self.headers,
                                         data=json.dumps({"heart_data": heart_data_list}), timeout=10)
            return response.json() if response.status_code == 200 else None
        except (requests.RequestException, ValueError):
            return None

    def simulate_video_watching(self, speed=1.0, interval=5, start_position=0):
        total = self._number(self.video_params.get("duration"))
        if total <= 0:
            return False
        current = max(0, self._number(start_position))
        first = current
        for event in ("loadstart", "loadeddata", "play", "playing"):
            self.send_heartbeat([self.create_heartbeat_data(event, current, first, speed)])
        while current < total:
            time.sleep(interval)
            current = min(total, current + interval * speed)
            event = random.choice(("playing", "playing", "playing", "waiting"))
            self.send_heartbeat([self.create_heartbeat_data(event, current, first, speed)])
        for event in ("videoend", "pause"):
            self.send_heartbeat([self.create_heartbeat_data(event, total, first, speed)])
        return True

    def get_current_progress_info(self):
        return None

    def smart_watch_video(self, speed=1.5, interval=5):
        progress = self.get_current_progress_info()
        if progress and progress.get("rate", 0) >= 0.9:
            return True
        start = max(0, progress.get("last_point", 0) - 10) if progress else 0
        return self.simulate_video_watching(speed=speed, interval=interval, start_position=start)
