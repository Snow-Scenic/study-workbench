import json

from portable_state import PortableStateStore


def test_first_load_creates_portable_state_file(tmp_path):
    path = tmp_path / 'study_workbench_data.json'
    store = PortableStateStore(str(path))
    assert store.load_storage() == {}
    assert path.is_file()
    assert json.loads(path.read_text(encoding='utf-8'))['storage'] == {}


def test_portable_state_keeps_whitelisted_progress_and_opt_in_credentials(tmp_path):
    store = PortableStateStore(str(tmp_path / 'study_workbench_data.json'))
    count = store.save_storage({
        'quiz_bankName': '期末复习',
        'quiz_answeredIds': '["q-1"]',
        'yk_run_params': '{"platform_host":"changjiang.yuketang.cn"}',
        'yk_remember_auth': 'true',
        'yk_auth_params': '{"session_id":"local-only"}',
        'unexpected': 'must-not-persist',
    })
    assert count == 5
    saved = store.load_storage()
    assert saved['quiz_bankName'] == '期末复习'
    assert saved['yk_auth_params'] == '{"session_id":"local-only"}'
    assert 'unexpected' not in saved


def test_portable_state_drops_credentials_without_explicit_opt_in(tmp_path):
    store = PortableStateStore(str(tmp_path / 'study_workbench_data.json'))
    store.save_storage({
        'quiz_bankName': '安全测试',
        'yk_auth_params': '{"session_id":"must-not-persist"}',
    })
    saved = store.load_storage()
    assert saved == {'quiz_bankName': '安全测试'}
