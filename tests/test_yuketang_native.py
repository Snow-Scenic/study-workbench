"""项目内雨课堂客户端的离线协议测试。"""
from yuketang_native import NativeYuketangHeartbeat


class Response:
    status_code = 200

    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


class Session:
    def __init__(self):
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if url.endswith('/course/chapter'):
            return Response({"success": True, "data": {"course_chapter": [{
                "name": "第一章", "section_leaf_list": [{
                    "id": "section-1", "name": "视频课件", "leaf_type": None,
                    "leaf_list": [{"id": "video-1", "leaf_type": 0},
                                  {"id": "text-1", "name": "图文课件", "leaf_type": 3}],
                }],
            }]}})
        if 'finish_status' in url:
            return Response({"success": True, "data": {"finish": 0}})
        return Response({"success": True})


class FallbackSession:
    def __init__(self):
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if len(self.calls) == 1:
            return Response({"success": False, "msg": "xtbz rejected"})
        return Response({"success": True, "data": {"course_chapter": []}})


def make_client():
    client = NativeYuketangHeartbeat({"university_id": "3185", "xtbz": "cloud"})
    client.session = Session()
    client.video_params = {"uv_id": "3185", "university_id": "3185", "csrf_token": "csrf"}
    client.base_url = 'https://njauyjs.yuketang.cn'
    return client


def test_embedded_client_extracts_video_and_richtext_tasks():
    client = make_client()
    videos = client.get_video_leaf_list('classroom-1', 'sign')
    texts = client.get_richtext_leaf_list('classroom-1', 'sign')

    assert [(item['id'], item['name']) for item in videos] == [('video-1', '视频课件')]
    assert [(item['id'], item['name']) for item in texts] == [('text-1', '图文课件')]
    request_url, request = client.session.calls[0]
    assert request_url == 'https://njauyjs.yuketang.cn/mooc-api/v1/lms/learn/course/chapter'
    assert request['params']['sign'] == 'sign'
    assert request['headers']['xtbz'] == 'cloud'


def test_embedded_client_marks_richtext_without_external_loader():
    client = make_client()
    assert client.view_richtext('classroom-1', 'text-1', stay_seconds=0) is True
    assert any('user_article_finish/text-1' in url for url, _ in client.session.calls)


def test_course_request_retries_platform_fallback_and_keeps_safe_diagnostic():
    client = make_client()
    client.headers["xtbz"] = "ykt"
    client.course_xtbz_fallback = "cloud"
    client.session = FallbackSession()

    assert client.get_course_chapters('classroom-1', 'sign')["success"] is True
    assert [call[1]["headers"]["xtbz"] for call in client.session.calls] == ["ykt", "cloud"]
    assert client.last_course_error == ""
