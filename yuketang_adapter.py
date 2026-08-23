# yuketang_adapter.py — RealYukeCore 占位（第二阶段 M6 实现）
#
# ⚠️ 第一阶段禁止：本文件不得 import 真实脚本、不得发起任何网络请求。
# 设计要点（实现时严格遵循 spec §9）：
#   1. sys.path 引导 config.YUKETANG_SRC_DIR 后 `from main import YuketangHeartbeat`
#   2. 子类 ProgressHeartbeat(YuketangHeartbeat) 三处重写：
#      - send_heartbeat      → 结构化进度回调 pct = cp/duration
#      - view_richtext       → 图文状态回调
#      - create_worker_instance → ★必须重写：原方法硬编码基类构造，
#        worker 必须以子类类型创建并显式携带与 Job 相同的 stop_event，
#        禁止假设父实例属性自动传播到并发 worker。
#   3. 视频编排直接调用原 concurrent_watch_videos()，不重写；
#     图文用薄循环调 view_richtext 以插入状态钩子。
#   4. stop 语义：stop_event 置位导致 simulate 返回 False 时映射 stopped 而非 failed。
#   5. main.py 的 stop_event 最小补丁（4 行）属 M6，当前禁止实施。


class RealYukeCore:
    """与 MockCore 同签名的真实核心（第二阶段）"""

    def analyze(self, params, emit_log):
        raise NotImplementedError("RealYukeCore 属第二阶段（M6），第一阶段禁用")

    def execute(self, params, tasks, emit_task, emit_log, stop_event):
        raise NotImplementedError("RealYukeCore 属第二阶段（M6），第一阶段禁用")
