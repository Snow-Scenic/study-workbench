// yuketang.js — 雨课堂控制台前端（原生 JS，1s 轮询，状态全部来自结构化 JSON）
'use strict';

const $ = (id) => document.getElementById(id);

// 运行参数始终可恢复；认证字段仅在用户显式勾选“记住登录凭据”后持久化。
const RUN_KEYS = ['platform_host', 'video_speed', 'heartbeat_interval', 'max_workers', 'skip_completed',
    'test_mode', 'test_video_count', 'use_concurrent', 'auto_richtext',
    'richtext_stay_seconds', 'richtext_skip_delay', 'debug'];
const AUTH_KEYS = ['classroom_id', 'sign', 'university_id', 'csrf_token', 'session_id'];
const STORE_KEY = 'yk_run_params';
const AUTH_STORE_KEY = 'yk_auth_params';
const REMEMBER_AUTH_KEY = 'yk_remember_auth';
const BOOL_RUN = new Set(['skip_completed', 'test_mode', 'use_concurrent', 'auto_richtext', 'debug']);

// 两个平台都填写同一组字段，但课程 URL、Cookie 所在域名及 sign 的取得方式不同。
// 内容仅作本机界面提示，不会把任何值写入日志或 localStorage。
const PLATFORM_GUIDES = {
    'changjiang.yuketang.cn': {
        label: '长江雨课堂',
        course: '课程目录页 URL 中提取：<br><code class="g-code">/pro/livecast/&lt;课堂 ID&gt;?sign=&lt;SIGN&gt;</code>。不要把视频 ID 或 course_id 填到课堂 ID。',
        cookie: 'F12 → Application → Cookies → <code class="g-code">https://changjiang.yuketang.cn</code><br><code class="g-code">csrftoken / sessionid / uv_id（或 university_id）</code>',
        tip: '学校 ID 优先填 uv_id。每项只复制“值”，不要复制整段 Cookie，也不要截图或发送凭据。',
    },
    'njauyjs.yuketang.cn': {
        label: '南京农业大学雨课堂',
        course: '登录后进入课程目录页，从地址中提取 <code class="g-code">classroom_id</code> 与 <code class="g-code">sign</code>。地址未显示 sign 时，在 F12 → Network 刷新目录，查看 chapter 请求的 Query String。',
        cookie: 'F12 → Application → Cookies → <code class="g-code">https://njauyjs.yuketang.cn</code><br><code class="g-code">csrftoken / sessionid / uv_id（或 university_id）</code>',
        tip: '平台的 xtbz=cloud 已自动处理，无需填写。课堂 ID 不是视频 ID 或 course_id；每项只复制本机的“值”。',
    },
};

let pollTimer = null;
let failCount = 0;
let stopRequested = false;   // 前端本地标记：STOP 已受理，等待 state=stopped
let lastTasksKey = '';       // Timeline 渲染缓存

// ---------------- API ----------------

async function api(path, payload) {
    const opt = payload !== undefined
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
        : {};
    const resp = await fetch(path, opt);
    const data = await resp.json().catch(() => ({ ok: false, error: '响应解析失败' }));
    return { status: resp.status, data };
}

// ---------------- 参数读写 ----------------

function collectParams() {
    const p = {};
    for (const k of AUTH_KEYS) p[k] = $('f_' + k).value.trim();
    for (const k of RUN_KEYS) {
        p[k] = BOOL_RUN.has(k) ? $('f_' + k).checked : $('f_' + k).value.trim();
    }
    return p;
}

function saveRunParams() {
    try {
        const params = collectParams();
        const only = {};
        for (const k of RUN_KEYS) only[k] = params[k];
        localStorage.setItem(STORE_KEY, JSON.stringify(only));
        const remember = !!($('f_remember_auth') && $('f_remember_auth').checked);
        if (remember) {
            const auth = {};
            for (const k of AUTH_KEYS) auth[k] = params[k];
            localStorage.setItem(AUTH_STORE_KEY, JSON.stringify(auth));
            localStorage.setItem(REMEMBER_AUTH_KEY, 'true');
        } else {
            localStorage.removeItem(AUTH_STORE_KEY);
            localStorage.removeItem(REMEMBER_AUTH_KEY);
        }
        if (typeof window.savePortableState === 'function') window.savePortableState();
    } catch (e) { /* 存储不可用时静默 */ }
}

function loadRunParams() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
        for (const k of RUN_KEYS) {
            if (!(k in saved)) continue;
            if (BOOL_RUN.has(k)) $('f_' + k).checked = !!saved[k];
            else $('f_' + k).value = saved[k];
        }
        const remember = localStorage.getItem(REMEMBER_AUTH_KEY) === 'true';
        const rememberBox = $('f_remember_auth');
        if (rememberBox) rememberBox.checked = remember;
        if (remember) {
            const auth = JSON.parse(localStorage.getItem(AUTH_STORE_KEY) || '{}');
            for (const k of AUTH_KEYS) {
                if (typeof auth[k] === 'string') $('f_' + k).value = auth[k];
            }
        }
    } catch (e) { /* 忽略损坏数据 */ }
}

function updatePlatformGuide() {
    const select = $('f_platform_host');
    const host = (select && select.value) || 'changjiang.yuketang.cn';
    const guide = PLATFORM_GUIDES[host];
    if (!guide) return;
    const course = $('guideCourse');
    const cookie = $('guideCookie');
    const tip = $('guideTip');
    if (course) course.innerHTML = guide.course;
    if (cookie) cookie.innerHTML = guide.cookie;
    if (tip) tip.textContent = guide.tip;
    const badge = $('mockBadge');
    if (badge) badge.textContent = `${guide.label} · ${host}`;
}

// ---------------- 动作 ----------------

async function doAnalyze() {
    $('cfgError').textContent = '';
    const params = collectParams();
    saveRunParams();
    $('btnAnalyze').disabled = true;
    try {
        const { status, data } = await api('/api/yuketang/analyze', params);
        if (status === 202) {
            stopRequested = false;
            startPolling();
            renderNow();
        } else {
            $('cfgError').textContent = data.error || `请求失败 (${status})`;
        }
    } catch (e) {
        $('cfgError').textContent = '网络错误：' + e.message;
    } finally {
        $('btnAnalyze').disabled = false;
    }
}

async function doStart() {
    const { status, data } = await api('/api/yuketang/start', {});
    if (status !== 202) flashCfg(data.error);
}

async function doStop() {
    const btn = $('btnStop');
    if (btn) { btn.disabled = true; btn.textContent = '正在停止…'; }
    const { data } = await api('/api/yuketang/stop', {});
    if (data && data.stop_requested) stopRequested = true;
}

async function doReset() {
    const { status } = await api('/api/yuketang/reset', {});
    if (status === 200) {
        stopRequested = false;
        lastTasksKey = '';            // 清空时间线缓存，下一门课从头渲染
        renderLogs._k = '';
        $('timeline').innerHTML = '';
        $('curBody').innerHTML = emptyConsoleState('暂无执行中的任务', '分析课程后将在这里显示当前进度');
        $('workersBox').innerHTML = emptyConsoleState('暂无执行线程', '任务启动后将显示线程状态');
        $('terminalBanner').hidden = true;
        renderNow();
    }
}

function flashCfg(msg) { const el = $('cfgError'); if (el) el.textContent = msg || ''; }

function emptyConsoleState(title, hint) {
    return `<div class="yk-empty-state">
        <span class="yk-empty-state-marker" aria-hidden="true"></span>
        <span class="yk-empty-state-copy">
            <span class="yk-empty-state-title">${esc(title)}</span>
            <small>${esc(hint)}</small>
        </span>
    </div>`;
}

// ---------------- 轮询 ----------------

function startPolling() {
    if (pollTimer) return;
    poll();
}
function stopPolling() {
    if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
    }
}
function poll() {
    pollTimer = setTimeout(async () => {
        try {
            const snap = await fetch('/api/yuketang/status').then(r => r.json());
            failCount = 0;
            $('mockBadge').classList.remove('offline');
            render(snap);
        } catch (e) {
            if (++failCount >= 3) $('mockBadge').classList.add('offline');
        }
        poll();
    }, 1000);
}

async function renderNow() {
    try { render(await fetch('/api/yuketang/status').then(r => r.json())); } catch (e) { /* 忽略 */ }
}

// ---------------- 渲染 ----------------

const STATE_LABEL = { idle: '空闲', analyzing: '分析中', ready: '待启动', running: '执行中', finished: '已完成', stopped: '已停止', error: '错误' };

function setView(state) {
    // 视图切换时，日志终端窗与其他内容一起渐隐渐现（保持整页动效一致）
    if (document.body.dataset.view !== state) {
        document.body.dataset.view = state;
        const foot = document.querySelector('.yk-logs');
        if (foot) {
            foot.classList.remove('yk-fade');
            void foot.offsetWidth;            // 强制回流以重启动画
            foot.classList.add('yk-fade');
        }
    }
}

function render(snap) {
    setView(snap.state);
    $('stateText').textContent = STATE_LABEL[snap.state] || snap.state.toUpperCase();
    $('stateBadge').className = 'state-badge ' + snap.state;
    const host = (snap.params_masked || {}).platform_host;
    if (host) {
        $('mockBadge').textContent = (host === 'njauyjs.yuketang.cn' ? '南京农业大学雨课堂' : '长江雨课堂') + ' · ' + host;
    }

    // HUD 计数（数值变化时触发跳变微交互）
    const s = snap.stats || {};
    for (const [id, v] of [['stTotal', s.total], ['stDone', s.done], ['stActive', s.active],
                           ['stQueued', s.queued], ['stFailed', s.failed]]) {
        const el = $(id);
        const nv = String(v || 0);
        if (el.textContent !== nv) {
            el.textContent = nv;
            el.classList.remove('num-bump');
            void el.offsetWidth;          // 强制回流以重启动画
            el.classList.add('num-bump');
        }
    }

    // 视图面板
    $('configPanel').hidden = snap.state !== 'idle';
    $('scanPanel').hidden = snap.state !== 'analyzing';
    $('consolePanel').hidden = !(snap.state in { ready: 1, running: 1, finished: 1, stopped: 1, error: 1 });
    if (snap.state === 'analyzing') {
        $('discovered').textContent = (snap.tasks || []).length;
        $('scanPhase').textContent = (snap.tasks || []).length
            ? '正在发现任务…' : '正在获取课程数据…';
    }

    if ($('consolePanel').hidden === false) {
        renderTimeline(snap.tasks || []);
        renderExec(snap);
        renderActions(snap);
        renderTerminal(snap);
    }

    // 日志：计数徽标 + 终端小窗（最近 6 条，最新最深、越旧越淡）
    renderLogs((snap.logs || []).slice(-200));

    // STOPPING 恢复：state 离开 running 后重置本地停止标记
    if (snap.state !== 'running') stopRequested = false;
}

function renderTimeline(tasks) {
    const key = tasks.map(t => t.id + t.status + t.pct).join('|');
    if (key === lastTasksKey) return;
    lastTasksKey = key;
    // 氛围锚点：优先运行中节点，否则最后一个已完成节点
    let anchor = tasks.findIndex(t => t.status === 'running');
    if (anchor < 0) {
        for (let i = tasks.length - 1; i >= 0; i--) {
            if (tasks[i].status === 'completed') { anchor = i; break; }
        }
    }
    $('timeline').innerHTML = tasks.map((t, i) => {
        const dist = anchor < 0 ? 0 : Math.abs(i - anchor);
        const fade = Math.max(0.38, 1 - dist * 0.10).toFixed(2);   // 越远越淡
        return `<li class="tl-node ${t.status}" style="--fade:${fade}">
            <span class="dot"></span>
            <span class="tl-name">${esc(t.name)}</span>
            <span class="tl-chapter">${esc(t.chapter)}</span>
            <span class="tl-pct">${t.pct}%</span>
         </li>`;
    }).join('');
}

function renderExec(snap) {
    const cur = pickCurrent(snap);
    if (cur) {
        $('curBody').innerHTML =
            `<div class="yk-task-card">
                <div class="yk-task-meta">
                    <span class="cur-chapter">${esc(cur.chapter)}</span>
                    <span class="cur-kind">${esc(cur.kind)}</span>
                </div>
                <div class="yk-task-head">
                    <strong class="cur-name">${esc(cur.name)}</strong>
                    <span class="yk-task-live"><i class="heart" title="心跳"></i>进行中</span>
                </div>
                <div class="yk-task-progress">
                    <div class="cur-bar"><i style="width:${cur.pct}%"></i></div>
                    <span class="cur-pct">${cur.pct}%</span>
                </div>
             </div>`;
    } else if (snap.state === 'ready') {
        const tasks = snap.tasks || [];
        const vCount = tasks.filter(t => t.kind === 'video').length;
        const rCount = tasks.filter(t => t.kind === 'richtext').length;
        const p = snap.params_masked || {};
        const spd = p.video_speed || '1.5';
        const wkr = p.max_workers || '3';
        $('curBody').innerHTML = `
            <div class="yk-ready-card">
                <div class="yk-ready-badge">
                    <span class="pulse-dot"></span>
                    <span>任务就绪待命 · READY</span>
                </div>
                <h4 class="yk-ready-title">共解析到 <b>${tasks.length}</b> 个章节课件任务</h4>
                <div class="yk-ready-grid">
                    <div class="yk-ready-stat">
                        <span class="num">${vCount}</span>
                        <span class="lbl">视频课件</span>
                    </div>
                    <div class="yk-ready-stat">
                        <span class="num">${rCount}</span>
                        <span class="lbl">图文课件</span>
                    </div>
                    <div class="yk-ready-stat">
                        <span class="num">${spd}x</span>
                        <span class="lbl">播放倍速</span>
                    </div>
                    <div class="yk-ready-stat">
                        <span class="num">${wkr}</span>
                        <span class="lbl">并发线程</span>
                    </div>
                </div>
                <div class="yk-ready-prompt">
                    <span class="prompt-icon">💡</span>
                    <span>课件已在左侧时间线排队就绪，点击下方<b>【▶ 开始执行】</b>启动全自动挂机学习。</span>
                </div>
            </div>`;
    } else {
        $('curBody').innerHTML = emptyConsoleState('暂无执行中的任务', '分析课程后将在这里显示当前进度');
    }

    const ws = snap.workers || [];
    if (ws.length) {
        $('workersBox').innerHTML = ws.map(w =>
            `<div class="worker-row">
                <div class="worker-row-head">
                    <span class="worker-dot" aria-hidden="true"></span>
                    <span class="worker-name">${esc(w.name)}</span>
                    <span class="w-pct">${w.pct}%</span>
                </div>
                <div class="w-bar"><i style="width:${w.pct}%"></i></div>
             </div>`).join('');
    } else if (snap.state === 'ready') {
        const p = snap.params_masked || {};
        const wkr = p.max_workers || '3';
        $('workersBox').innerHTML = `
            <div class="yk-ready-workers">
                <div class="worker-status-line">
                    <span class="worker-status-tag">待启动</span>
                    <span>后台线程池已待命（最大并发: ${wkr} 条 Worker）</span>
                </div>
                <p class="worker-status-desc">点击「开始执行」后，工作线程将并行处理视频播放与心跳交互，并在此实时刷新各任务进度。</p>
            </div>`;
    } else {
        $('workersBox').innerHTML = emptyConsoleState('暂无执行线程', '任务启动后将显示线程状态');
    }
}

function pickCurrent(snap) {
    if (snap.current) {
        const t = (snap.tasks || []).find(x => x.id === snap.current.id);
        return t ? { ...t } : null;
    }
    const running = (snap.tasks || []).filter(t => t.status === 'running');
    return running.length ? running.reduce((a, b) => (b.pct >= a.pct ? b : a)) : null;
}

function renderActions(snap) {
    const box = $('execActions');
    let html = '';
    if (snap.state === 'ready') {
        html += '<button class="btn btn-primary yk-btn-start" onclick="doStart()">▶ 开始执行自动学习</button>'
              + '<button class="btn btn-outline" onclick="doReset()">← 返回配置（换课 / 改参数）</button>';
    }
    if (snap.state === 'running') {
        html += stopRequested
            ? '<button class="btn stop" disabled>⏹ 正在停止…</button>'
            : '<button class="btn stop" id="btnStop" onclick="doStop()">⏹ 停止执行</button>';
    }
    if (['finished', 'stopped', 'error'].includes(snap.state))
        html += '<button class="btn btn-outline" onclick="doReset()">↺ 重新配置（换下一门课）</button>';
    if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
}

function renderTerminal(snap) {
    const el = $('terminalBanner');
    if (!['finished', 'stopped', 'error'].includes(snap.state)) { el.hidden = true; return; }
    el.hidden = false;
    const st = snap.summary;
    if (snap.state === 'finished') {
        el.className = 'terminal-banner ok';
        el.innerHTML = `<span class="terminal-icon" aria-hidden="true">✓</span><div><strong>执行完成</strong><small>共 ${st.total} 个任务，完成 ${st.completed}，跳过 ${st.skipped}，失败 ${st.failed}。可重新配置后开始下一门课。</small></div>`;
    } else if (snap.state === 'stopped') {
        el.className = 'terminal-banner warn';
        el.innerHTML = `<span class="terminal-icon" aria-hidden="true">■</span><div><strong>已停止</strong><small>已停止 ${st.stopped} 个任务；未开始的任务仍保留在队列中。可重新配置参数或切换课程。</small></div>`;
    } else {
        el.className = 'terminal-banner bad';
        el.innerHTML = `<span class="terminal-icon" aria-hidden="true">×</span><div><strong>执行出错</strong><small>${esc(snap.error || '未知错误')}</small></div>`;
    }
}

function renderLogs(logs) {
    const badge = $('logCount');
    if (badge) badge.textContent = `${logs.length} 条`;
    const tail = $('logTail');
    if (!tail) return;
    const key = logs.length + ':' + (logs.length ? logs[logs.length - 1].ts : '');
    if (key === renderLogs._k) return;
    renderLogs._k = key;
    const recent = logs.slice(-6);
    if (!recent.length) {
        tail.innerHTML = '<span class="t-empty">暂无日志 —— 分析课程后此处实时滚动显示</span>';
        return;
    }
    // 最新在最下方（终端惯例），透明度自下而上递减：最新最深、越旧越淡
    tail.innerHTML = recent.map((l, i) => {
        const fade = 0.30 + 0.70 * ((i + 1) / recent.length);   // 0.30 → 1.0
        const lvl = l.level === 'error' ? 'lg-error' : (l.level === 'warn' ? 'lg-warn' : '');
        return `<div class="t-line" style="opacity:${fade.toFixed(2)}">` +
               `<span class="t-ts">${new Date(l.ts * 1000).toLocaleTimeString()}</span>` +
               `<span class="t-lv ${lvl}">${esc(l.level.toUpperCase())}</span>` +
               `<span class="t-msg">${esc(l.msg || l.event)}</span></div>`;
    }).join('');
}

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------- 启动 ----------------

function fillDemoParams() {
    const demo = {
        f_classroom_id: 'demo-classroom-001',
        f_sign: 'demo-sign',
        f_university_id: 'demo-uv-001',
        f_csrf_token: 'demo-csrf-token',
        f_session_id: 'demo-session-id',
    };
    for (const [id, val] of Object.entries(demo)) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }
    flashCfg('已填入演示参数（离线 Mock，不会访问真实网络）');
}

window.addEventListener('load', () => {
    loadRunParams();
    const rememberBox = $('f_remember_auth');
    if (rememberBox) rememberBox.addEventListener('change', saveRunParams);
    updatePlatformGuide();
    renderNow();          // 刷新后按服务端真实状态恢复视图
    startPolling();
    // ?layoutdebug=1：把关键元素渲染坐标写入标题（布局自检/回归用）
    if (new URLSearchParams(location.search).has('layoutdebug')) {
        setTimeout(() => {
            const r = (sel) => {
                const e = document.querySelector(sel);
                if (!e) return null;
                const b = e.getBoundingClientRect();
                return { top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), left: +b.left.toFixed(1), right: +b.right.toFixed(1) };
            };
            document.title = 'LD ' + JSON.stringify({
                actions: r('.exec-actions'), term: r('.term'),
                logs: r('.yk-logs'), timeline: r('.yk-timeline-wrap'),
                side: r('.yk-side'), cfgCard: r('.cfg-card'),
                state: document.body.dataset.view,
            });
        }, 1500);
    }
});

// 显式挂载到 window
window.renderNow = renderNow;
window.startPolling = startPolling;
window.stopPolling = stopPolling;
window.fillDemoParams = fillDemoParams;
window.loadRunParams = loadRunParams;
window.saveRunParams = saveRunParams;
window.updatePlatformGuide = updatePlatformGuide;
