"""Offline job-manager regression: no sockets, real core or service calls."""
from threading import Event

from yuketang_manager import YukeJobManager

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
