"""真实雨课堂适配层的离线契约测试；不访问课程平台。"""
from types import SimpleNamespace

from yuketang_adapter import RealYukeCore, normalize_progress
from yuketang_core import validate_params
from yuketang_native import NativeYuketangHeartbeat


AUTH = {
    "classroom_id": "123456",
    "sign": "sign",
    "university_id": "3185",
    "csrf_token": "csrf",
    "session_id": "session",
}


class FakeResponse:
    status_code = 200

    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


class FakeSession:
    def __init__(self):
        self.requests = []

    def get(self, url, **kwargs):
        self.requests.append((url, kwargs))
        return FakeResponse({"success": True})


class FakeHeartbeat:
    def __init__(self, cookies):
        self.cookies = cookies
        self.session = FakeSession()
        self.base_url = "https://changjiang.yuketang.cn"
        self.heartbeat_url = self.base_url + "/video-log/heartbeat/"
        self.progress_url = self.base_url + "/video-log/get_video_watch_progress/"
        self.headers = {"Origin": self.base_url, "xtbz": "ykt"}
        self.video_params = {}
        self.classroom_info_called = False

    def set_video_params(self, user_id, course_id, video_id, sku_id, classroom_id,
                         cc_id, duration, csrf_token, university_id, uv_id):
        self.video_params = {
            "user_id": user_id, "course_id": course_id, "video_id": video_id,
            "sku_id": sku_id, "classroom_id": classroom_id, "cc_id": cc_id,
            "duration": duration, "csrf_token": csrf_token,
            "university_id": university_id, "uv_id": uv_id,
        }

    def send_heartbeat(self, data):
        return {"success": True}

    def get_video_progress(self):
        return {"code": 0, "data": {"video-1": {"rate": 0.4, "last_point": 12}}}

    def get_classroom_info(self, classroom_id):
        self.classroom_info_called = True
        return {"success": True}


def make_core():
    core = object.__new__(RealYukeCore)
    core.params = {}
    core.upstream = SimpleNamespace(YuketangHeartbeat=FakeHeartbeat)
    return core


def test_real_core_uses_embedded_client_without_external_source():
    core = RealYukeCore(validate_params(AUTH))
    assert core.upstream.YuketangHeartbeat is NativeYuketangHeartbeat


def test_njau_profile_updates_origin_cookie_and_optional_endpoint():
    params = validate_params({**AUTH, "platform_host": "njauyjs.yuketang.cn"})
    hb = make_core()._base_heartbeat(params)

    assert hb.base_url == "https://njauyjs.yuketang.cn"
    assert hb.headers["Origin"] == "https://njauyjs.yuketang.cn"
    assert hb.headers["xtbz"] == hb.cookies["xtbz"] == "ykt"
    assert hb.course_xtbz_fallback == "cloud"
    assert hb.get_classroom_info("123456") is None
    assert hb.classroom_info_called is False


def test_leaf_zero_university_id_falls_back_to_configured_value():
    params = validate_params({**AUTH, "platform_host": "njauyjs.yuketang.cn"})
    hb = make_core()._progress_heartbeat(params, "123456", "video-1", None,
                                          lambda *args, **kwargs: None,
                                          lambda *args, **kwargs: None)
    hb.set_video_params("user", "course", "video-1", "sku", "123456", "cc",
                        120, "", "0", "0")

    assert hb.video_params["university_id"] == "3185"
    assert hb.video_params["uv_id"] == "3185"
    assert hb.headers["Referer"].startswith("https://njauyjs.yuketang.cn/")


def test_progress_normalizes_legacy_and_wrapped_responses():
    assert normalize_progress(
        {"code": 0, "data": {"video-1": {"rate": 0.25, "last_point": 30}}},
        "video-1", 120) == {"rate": 0.25, "last_point": 30.0, "duration": 120.0}
    assert normalize_progress(
        {"success": True, "data": {"progress": {"progress": 75,
                                                  "last_position": "90"}}},
        "video-1", 120) == {"rate": 0.75, "last_point": 90.0, "duration": 120.0}


def test_progress_heartbeat_uses_normalized_result():
    params = validate_params(AUTH)
    hb = make_core()._progress_heartbeat(params, "123456", "video-1", None,
                                          lambda *args, **kwargs: None,
                                          lambda *args, **kwargs: None)
    hb.video_params = {"video_id": "video-1", "duration": 120}
    hb.get_video_progress = lambda: {"success": True, "data": {
        "video_watch_progress": {"rate": "0.5", "last_point": "60"}}}

    assert hb.get_current_progress_info() == {
        "rate": 0.5, "last_point": 60.0, "duration": 120.0}
