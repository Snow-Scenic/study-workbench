/**
 * app-shell.js — 2026 统一桌面工作台外壳路由与视图控制器
 * 负责侧边栏状态流转、单页应用 (SPA) 零刷新切换、视图生命周期调度。
 */
(function () {
    'use strict';

    const AppShell = window.AppShell = window.AppShell || {};

    // 动态更新最大化/还原按钮的 SVG 图标
    window.updateMaximizeIcon = function (isMax) {
        const btn = document.querySelector('.win-caption-btn-max');
        if (!btn) return;
        if (isMax) {
            btn.title = '还原';
            btn.setAttribute('aria-label', '还原');
            btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1"><rect x="2.5" y="0.5" width="7" height="7"/><polyline points="0.5,2.5 0.5,9.5 7.5,9.5"/></svg>';
        } else {
            btn.title = '最大化';
            btn.setAttribute('aria-label', '最大化');
            btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1"><rect x="0.5" y="0.5" width="9" height="9"/></svg>';
        }
    };

    // 暴露全局桌面控制函数（立即定义，杜绝后置未加载异常）
    window.desktopMinimize = function () {
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.minimize === 'function') {
            window.pywebview.api.minimize();
        }
    };
    window.desktopToggleMaximize = function () {
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.toggle_maximize === 'function') {
            window.pywebview.api.toggle_maximize().then(function (isMax) {
                window.updateMaximizeIcon(isMax);
            }).catch(function () {});
        }
    };
    window.desktopClose = function () {
        if (window.pywebview && window.pywebview.api && typeof window.pywebview.api.close === 'function') {
            window.pywebview.api.close();
        } else {
            window.close();
        }
    };

    const VIEW_CONFIG = {
        'home': { title: '工作台首页', subtitle: '学习概览与快捷入口' },
        'practice': { title: '题库练习', subtitle: '专注模式 · 沉浸答题' },
        'banks': { title: '题库管理', subtitle: '本地 JSON 题库管理与导入' },
        'review': { title: '错题复习', subtitle: '错题针对性巩固复习' },
        'stats': { title: '数据统计', subtitle: '练习数据与正确率分布' },
        'yuketang': { title: '课程控制台', subtitle: '雨课堂课程同步与任务监控' },
        'settings': { title: '系统设置', subtitle: '偏好配置与快捷键说明' }
    };

    let currentActiveView = 'home';
    let navHistory = [];
    let navHistoryIndex = -1;
    let isNavigatingHistory = false;

    function updateNavCapsuleState() {
        const backBtn = document.getElementById('navBackBtn');
        const fwdBtn = document.getElementById('navForwardBtn');
        const canGoBack = navHistoryIndex > 0;
        const canGoForward = navHistoryIndex < navHistory.length - 1;

        if (backBtn) {
            backBtn.disabled = !canGoBack;
            backBtn.classList.toggle('disabled', !canGoBack);
        }
        if (fwdBtn) {
            fwdBtn.disabled = !canGoForward;
            fwdBtn.classList.toggle('disabled', !canGoForward);
        }
    }

    /**
     * 导航到指定视图
     * @param {string} viewName 视图名称 (home|practice|banks|review|stats|yuketang|settings)
     * @param {object} [params={}] 额外参数
     */
    AppShell.navigate = function (viewName, params) {
        if (!VIEW_CONFIG[viewName]) viewName = 'home';
        currentActiveView = viewName;

        // 维护应用内导航历史栈
        if (!isNavigatingHistory) {
            if (navHistoryIndex < 0 || navHistory[navHistoryIndex] !== viewName) {
                navHistory = navHistory.slice(0, navHistoryIndex + 1);
                navHistory.push(viewName);
                navHistoryIndex = navHistory.length - 1;
            }
        }
        updateNavCapsuleState();

        // 1. 切换侧边栏活动态
        document.querySelectorAll('.sidebar-item[data-view]').forEach(item => {
            const isMatch = item.getAttribute('data-view') === viewName;
            item.classList.toggle('active', isMatch);
            if (isMatch) {
                item.setAttribute('aria-current', 'page');
            } else {
                item.removeAttribute('aria-current');
            }
        });

        // 2. 更新顶栏标题与副标
        const cfg = VIEW_CONFIG[viewName];
        const titleEl = document.getElementById('shellTitle');
        const subtitleEl = document.getElementById('shellSubtitle');
        if (titleEl) titleEl.textContent = cfg.title;
        if (subtitleEl) subtitleEl.textContent = cfg.subtitle;

        // 更新顶栏上下文操作按钮
        const actionBtn = document.getElementById('topbarActionBtn');
        if (actionBtn) {
            if (viewName === 'yuketang') {
                actionBtn.style.display = 'inline-flex';
                actionBtn.title = '重新配置雨课堂参数';
                actionBtn.onclick = () => { if (typeof doReset === 'function') doReset(); };
                actionBtn.innerHTML = '<span data-icon="sliders"></span> 换课配置';
            } else if (viewName === 'settings') {
                actionBtn.style.display = 'none';
            } else {
                actionBtn.style.display = 'inline-flex';
                actionBtn.title = '快速切换题库';
                actionBtn.onclick = () => { if (typeof showBankSelectScreen === 'function') showBankSelectScreen(); };
                actionBtn.innerHTML = '<span data-icon="book"></span> 切换题库';
            }
            if (window.renderIcons) window.renderIcons();
        }

        // 3. 切换视图主面板
        document.querySelectorAll('.view-panel').forEach(panel => {
            const isTarget = panel.id === 'view-' + viewName;
            panel.classList.toggle('active', isTarget);
        });

        // 4. 关闭移动端/窄屏抽屉
        AppShell.closeDrawer();

        // 5. 更新 URL Hash（无刷新且支持浏览器前进后退）
        if (window.location.hash !== '#' + viewName) {
            window.history.replaceState(null, '', '#' + viewName);
        }

        // 6. 视图激活时的专属生命周期钩子
        onViewActivated(viewName, params);
    };

    /**
     * 原生导航胶囊：后退
     */
    AppShell.goBack = function () {
        if (navHistoryIndex > 0) {
            navHistoryIndex--;
            isNavigatingHistory = true;
            const wb = document.querySelector('.workbench-body');
            if (wb) {
                wb.classList.add('navigating-back');
                setTimeout(() => { if (wb) wb.classList.remove('navigating-back'); }, 180);
            }
            AppShell.navigate(navHistory[navHistoryIndex]);
            isNavigatingHistory = false;
            updateNavCapsuleState();
        }
    };

    /**
     * 原生导航胶囊：前进
     */
    AppShell.goForward = function () {
        if (navHistoryIndex < navHistory.length - 1) {
            navHistoryIndex++;
            isNavigatingHistory = true;
            AppShell.navigate(navHistory[navHistoryIndex]);
            isNavigatingHistory = false;
            updateNavCapsuleState();
        }
    };

    /**
     * 获取当前激活视图名
     */
    AppShell.getCurrentView = function () {
        return currentActiveView;
    };

    /**
     * 精准同步侧边栏宽度 CSS 变量 --sidebar-w，保证底部悬浮岛水平绝对居中
     */
    AppShell.syncSidebarWidth = function () {
        const sidebar = document.getElementById('appSidebar');
        let width = 0;
        if (sidebar) {
            const style = window.getComputedStyle(sidebar);
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.position !== 'fixed') {
                if (sidebar.classList.contains('collapsed')) {
                    width = 56;
                } else if (window.innerWidth < 900) {
                    width = 0;
                } else if (window.innerWidth < 1200 && !sidebar.classList.contains('manually-expanded')) {
                    width = 56;
                } else {
                    width = 224;
                }
            }
        }
        const px = width + 'px';
        document.documentElement.style.setProperty('--sidebar-w', px);
        document.body.style.setProperty('--sidebar-w', px);
        const shell = document.getElementById('appShell') || document.querySelector('.app-shell');
        if (shell) {
            shell.style.setProperty('--sidebar-w', px);
            shell.classList.toggle('sidebar-collapsed', width === 56);
        }
        return width;
    };

    /**
     * 切换侧栏折叠状态 (224px <-> 56px)
     */
    AppShell.toggleSidebar = function () {
        const sidebar = document.getElementById('appSidebar');
        if (!sidebar) return;
        const isCollapsed = sidebar.classList.toggle('collapsed');
        sidebar.classList.toggle('manually-expanded', !isCollapsed);
        localStorage.setItem('shell_sidebar_collapsed', isCollapsed ? '1' : '0');
        const header = sidebar.querySelector('.sidebar-header');
        if (header) {
            header.title = isCollapsed ? '点击展开侧边栏' : '';
        }
        AppShell.syncSidebarWidth();
    };

    /**
     * 展开/收起移动端遮罩抽屉
     */
    AppShell.toggleDrawer = function (forceState) {
        const sidebar = document.getElementById('appSidebar');
        const overlay = document.getElementById('drawerOverlay');
        if (!sidebar) return;
        const open = typeof forceState === 'boolean' ? forceState : !sidebar.classList.contains('drawer-open');
        sidebar.classList.toggle('drawer-open', open);
        if (overlay) overlay.classList.toggle('active', open);
    };

    AppShell.closeDrawer = function () {
        AppShell.toggleDrawer(false);
    };

    /**
     * 视图激活联动处理
     */
    function onViewActivated(viewName, params) {
        try {
            // 如果不在练习视图，隐藏题库全屏弹层避免遮挡
            if (viewName !== 'practice') {
                const bScreen = document.getElementById('bankSelectScreen');
                if (bScreen) bScreen.style.display = 'none';
            }

            if (viewName === 'banks') {
                if (typeof loadBankList === 'function') loadBankList();
            } else if (viewName === 'practice') {
                const state = (window.getAppState && window.getAppState()) || {};
                const hasBank = !!(state.currentBankName && state.allQuestions && state.allQuestions.length > 0);
                if (!hasBank) {
                    if (typeof showBankSelectScreen === 'function') showBankSelectScreen();
                } else {
                    const bScreen = document.getElementById('bankSelectScreen');
                    if (bScreen) bScreen.style.display = 'none';
                    if (state.practiceQuestions && state.practiceQuestions.length > 0) {
                        if (typeof renderCurrentQuestion === 'function') renderCurrentQuestion();
                    } else if (typeof startPractice === 'function') {
                        startPractice();
                    }
                }
            } else if (viewName === 'review') {
                const state = (window.getAppState && window.getAppState()) || {};
                const hasBank = !!(state.currentBankName && state.allQuestions && state.allQuestions.length > 0);
                if (!hasBank) {
                    if (typeof showBankSelectScreen === 'function') showBankSelectScreen();
                } else {
                    if (typeof switchSection === 'function') switchSection('__wrong__');
                }
            } else if (viewName === 'stats') {
                if (typeof updateStats === 'function') updateStats();
            } else if (viewName === 'yuketang') {
                if (typeof renderNow === 'function') renderNow();
                if (typeof startPolling === 'function') startPolling();
            } else if (viewName === 'home') {
                if (typeof updateStats === 'function') updateStats();
                if (typeof loadBankList === 'function') loadBankList();
            }
        } catch (err) {
            console.error('[AppShell] onViewActivated error for ' + viewName + ':', err);
        }
    }

    /**
     * 初始化外壳事件与路由
     */
    function initShell() {
        // ---- 桌面模式检测 (pywebview) ----
        if (window.pywebview) {
            document.body.classList.add('desktop-mode');
            document.documentElement.classList.add('desktop-mode');
        }

        // 绑定侧栏导航点击
        document.querySelectorAll('.sidebar-item[data-view]').forEach(item => {
            item.addEventListener('click', function (e) {
                e.preventDefault();
                const target = this.getAttribute('data-view');
                AppShell.navigate(target);
            });
        });

        // 折叠状态下点击顶栏 header 可直接展开
        const sidebarHeader = document.querySelector('.sidebar-header');
        if (sidebarHeader) {
            sidebarHeader.addEventListener('click', function (e) {
                const sidebar = document.getElementById('appSidebar');
                if (sidebar && sidebar.classList.contains('collapsed')) {
                    AppShell.toggleSidebar();
                }
            });
        }

        // 恢复侧栏折叠偏好或 URL 参数指定
        const urlParams = new URLSearchParams(window.location.search);
        const forceCollapsed = urlParams.get('collapsed');
        const savedCollapsed = localStorage.getItem('shell_sidebar_collapsed');
        if (forceCollapsed === '1' || (forceCollapsed !== '0' && savedCollapsed === '1')) {
            const sidebar = document.getElementById('appSidebar');
            if (sidebar) {
                sidebar.classList.add('collapsed');
                if (sidebarHeader) sidebarHeader.title = '点击展开侧边栏';
            }
        }
        AppShell.syncSidebarWidth();
        window.addEventListener('resize', AppShell.syncSidebarWidth);
        const sidebarEl = document.getElementById('appSidebar');
        if (sidebarEl && window.ResizeObserver) {
            try {
                const ro = new ResizeObserver(() => { AppShell.syncSidebarWidth(); });
                ro.observe(sidebarEl);
            } catch (e) {}
        }

        if (urlParams.get('open_details') === '1') {
            const details = document.querySelector('.run-params');
            if (details) details.open = true;
        }

        if (urlParams.get('test_wrong') === '1') {
            const bs = document.getElementById('bankSelectScreen');
            if (bs) bs.style.display = 'none';
            const gw = document.getElementById('groupWrongFilters');
            if (gw) gw.style.display = 'inline-flex';
            const gr = document.getElementById('groupWrongReview');
            if (gr) gr.style.display = 'inline-flex';
            const bb = document.getElementById('bottomBar');
            if (bb) bb.classList.add('has-wrong-filters');
        }

        if (urlParams.get('load_sample') === '1') {
            const bs = document.getElementById('bankSelectScreen');
            if (bs) bs.style.display = 'none';
            if (typeof selectBank === 'function') selectBank('示例题库.json');
        }

        // 监听浏览器前进/后退 hash 变化
        window.addEventListener('hashchange', function () {
            const hashView = (window.location.hash || '').replace('#', '').trim();
            if (hashView && VIEW_CONFIG[hashView]) {
                AppShell.navigate(hashView);
            }
        });

        // 初始路由解析：支持 Hash 与 Pathname
        let initialView = 'home';
        const path = window.location.pathname;
        const hash = (window.location.hash || '').replace('#', '').trim();

        if (hash && VIEW_CONFIG[hash]) {
            initialView = hash;
        } else if (path === '/quiz') {
            initialView = 'practice';
        } else if (path === '/yuketang') {
            initialView = 'yuketang';
        }

        // 键盘快捷键支持：Alt+Left 后退，Alt+Right 前进，Alt+B 展开/收起侧边栏
        window.addEventListener('keydown', function (e) {
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                AppShell.goBack();
            } else if (e.altKey && e.key === 'ArrowRight') {
                e.preventDefault();
                AppShell.goForward();
            } else if (e.altKey && (e.key === 'b' || e.key === 'B')) {
                e.preventDefault();
                AppShell.toggleSidebar();
            }
        });

        // 顶栏双击最大化/还原
        const topbar = document.querySelector('.topbar');
        if (topbar) {
            topbar.addEventListener('dblclick', function (e) {
                if (!e.target.closest('button, a, input, select, .win-nav-capsule')) {
                    window.desktopToggleMaximize();
                }
            });
        }

        AppShell.navigate(initialView);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShell);
    } else {
        initShell();
    }
})();
