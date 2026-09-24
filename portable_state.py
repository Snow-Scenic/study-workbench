"""便携版用户状态：只允许写入应用白名单字段，原子落盘到 EXE 同目录。"""
import json
import os
import tempfile
import threading
import time

from config import PORTABLE_STATE_FILE

STATE_VERSION = 1
MAX_STATE_BYTES = 4 * 1024 * 1024

# 题库 JSON 本体已由 question_banks/ 持久化；这里保留题库选择、作答历史和偏好。
STORAGE_KEYS = frozenset({
    'quiz_bankName', 'quiz_wrongRecords', 'quiz_answeredIds', 'quiz_theme',
    'quiz_settings_threshold', 'quiz_totalStats', 'quiz_wrongReviewEnabled',
    'quiz_questionStatus', 'shell_sidebar_collapsed', 'yk_run_params',
    'yk_remember_auth', 'yk_auth_params',
})


class PortableStateStore:
    """线程安全的本机状态文件读写器；不接受任意文件路径或未知字段。"""

    def __init__(self, path=PORTABLE_STATE_FILE):
        self.path = os.path.abspath(path)
        self._lock = threading.RLock()

    def load_storage(self):
        """读取并校验可安全注入浏览器 localStorage 的字符串映射。"""
        with self._lock:
            try:
                if not os.path.isfile(self.path):
                    # 首次启动即创建可识别的便携配置文件，方便用户备份整个 EXE 目录。
                    self.save_storage({})
                    return {}
                if os.path.getsize(self.path) > MAX_STATE_BYTES:
                    return {}
                with open(self.path, 'r', encoding='utf-8') as handle:
                    payload = json.load(handle)
            except (OSError, ValueError, TypeError):
                return {}
        return self._sanitize(payload.get('storage', {}) if isinstance(payload, dict) else {})

    def save_storage(self, storage):
        """校验并原子保存状态，返回实际保存的键数量。"""
        cleaned = self._sanitize(storage)
        payload = {
            'version': STATE_VERSION,
            'updated_at': int(time.time()),
            'storage': cleaned,
        }
        encoded = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
        if len(encoded.encode('utf-8')) > MAX_STATE_BYTES:
            raise ValueError('本机状态超过 4MB 上限')

        parent = os.path.dirname(self.path)
        with self._lock:
            os.makedirs(parent, exist_ok=True)
            fd, tmp_path = tempfile.mkstemp(prefix='.study-workbench-', suffix='.tmp', dir=parent)
            try:
                with os.fdopen(fd, 'w', encoding='utf-8') as handle:
                    handle.write(encoded)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(tmp_path, self.path)
            except Exception:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                raise
        return len(cleaned)

    @staticmethod
    def _sanitize(storage):
        if not isinstance(storage, dict):
            return {}
        cleaned = {}
        remember_auth = storage.get('yk_remember_auth') == 'true'
        for key in STORAGE_KEYS:
            value = storage.get(key)
            if not isinstance(value, str):
                continue
            if key == 'yk_auth_params' and not remember_auth:
                continue
            # 单字段限制避免损坏状态文件或异常大题库历史占满磁盘。
            if len(value.encode('utf-8')) > MAX_STATE_BYTES // 2:
                continue
            cleaned[key] = value
        if not remember_auth:
            cleaned.pop('yk_auth_params', None)
            cleaned.pop('yk_remember_auth', None)
        return cleaned
