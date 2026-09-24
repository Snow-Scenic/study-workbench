# config.py — 配置常量
import os
import sys

if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    RESOURCE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    RESOURCE_DIR = BASE_DIR

TEMPLATE_DIR = os.path.join(RESOURCE_DIR, "templates")
STATIC_DIR = os.path.join(RESOURCE_DIR, "static")
# 题库目录：优先外部目录，其次打包内部目录
EXTERNAL_BANKS_DIR = os.path.join(BASE_DIR, "question_banks")
INTERNAL_BANKS_DIR = os.path.join(RESOURCE_DIR, "question_banks")
# 便携版用户状态：冻结 EXE 时位于 EXE 同目录，源码运行时位于项目根目录。
# 题库本体独立存放于 question_banks/，此文件仅保存选择、进度和偏好。
PORTABLE_STATE_FILE = os.path.join(BASE_DIR, "study_workbench_data.json")
PORT = 8000

# ---- 雨课堂控制台 ----
# 'auto' = 智能路由：classroom_id 命中演示哨兵（demo*/111/test/000）→ 离线演示，
#          否则走真实核心（由课程控制台所选平台决定）
# 'mock' / 'real' = 强制指定
CORE_IMPL = "auto"
