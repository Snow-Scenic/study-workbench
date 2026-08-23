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
PORT = 8000

# ---- 雨课堂控制台 ----
CORE_IMPL = "mock"   # Demo Mode：'mock'=离线演示 | 'real'=真实核心（第二阶段 M6；禁止按 Cookie 自动切换）
YUKETANG_SRC_DIR = os.path.join(os.path.dirname(BASE_DIR), "yuketang-main")
