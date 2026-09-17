"""H1/H2 offline regression: no sockets, browser, real core or service calls."""
import sys
import types
from pathlib import Path
from threading import Event

import pytest

from yuketang_manager import YukeJobManager

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize('limit', [2, 15])
def test_watchdog_observes_config_and_shuts_down_after_timeout(monkeypatch, limit):
    # Execute the actual entry module with a harmless server import.
    fake_server_module = types.ModuleType('server')
    fake_server_module.MyHandler = object
    fake_server_module._LAST_SEEN = 100
    monkeypatch.setitem(sys.modules, 'server', fake_server_module)
    module = types.ModuleType('watchdog_test_entry')
    exec(compile((ROOT / 'main.py').read_text(encoding='utf-8'), 'main.py', 'exec'), module.__dict__)
    monkeypatch.setattr(module.config, 'BROWSER_WATCHDOG_SECONDS', limit, raising=False)
    targets = []
    clock = {'now': 100, 'ticks': 0}
    shutdown_times = []

    class FakeThread:
        def __init__(self, target, args=(), **kwargs):
            self.target, self.args = target, args

        def start(self):
            targets.append((self.target, self.args))

    class FakeHTTP:
        def __init__(self, *args):
            pass

        def shutdown(self):
            shutdown_times.append(clock['now'])

        def server_close(self):
            pass

        def serve_forever(self):
            watchdog = next(fn for fn, args in targets if fn.__name__ == 'browser_watchdog')
            watchdog()

    def tick(seconds):
        clock['ticks'] += 1
        assert clock['ticks'] <= limit + 2, 'watchdog failed to stop'
        clock['now'] += seconds

    module.threading = types.SimpleNamespace(Thread=FakeThread)
    module.socketserver = types.SimpleNamespace(ThreadingTCPServer=FakeHTTP)
    module.time = types.SimpleNamespace(sleep=tick, time=lambda: clock['now'])
    module.atexit = types.SimpleNamespace(register=lambda fn: None)
    module.is_port_available = lambda port: True
    module.show_error_dialog = lambda *args: pytest.fail(str(args))
    module.run_server()
    assert shutdown_times[0] == 100 + limit + 1
    assert clock['ticks'] == limit + 1


def test_stop_flag_visible_before_worker_exit_and_cleared_for_next_job():
    entered = Event()
    release = Event()

    class OfflineCore:
        def analyze(self, params, emit_log):
            return [{'id': 'local', 'kind': 'video', 'name': 'Local fixture', 'chapter': 'Tests'}]

        def execute(self, params, tasks, emit_task, emit_log, stop_event):
            entered.set()
            assert release.wait(3), 'test did not release offline worker'
            return {'stopped': 1}

    mgr = YukeJobManager(core_factory=lambda: OfflineCore())
    params = dict(classroom_id='demo', sign='fixture', university_id='fixture',
                  csrf_token='fixture', session_id='fixture')
    mgr.analyze(params)
    mgr._thread.join(3)
    assert not mgr._thread.is_alive()
    assert mgr.snapshot()['state'] == 'ready'
    assert mgr.snapshot()['stop_requested'] is False
    mgr.start()
    worker = mgr._thread
    try:
        assert entered.wait(3)
        assert mgr.stop()['stop_requested'] is True
        snap = mgr.snapshot()
        assert snap['state'] == 'running'
        assert snap['stop_requested'] is True
    finally:
        release.set()
        worker.join(3)
    assert not worker.is_alive()
    assert mgr.snapshot()['state'] == 'stopped'
    mgr.reset()
    assert mgr.snapshot()['stop_requested'] is False
    mgr.analyze(params)
    mgr._thread.join(3)
    assert not mgr._thread.is_alive()
    assert mgr.snapshot()['state'] == 'ready'
    assert mgr.snapshot()['stop_requested'] is False
