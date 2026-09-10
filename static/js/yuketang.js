// yuketang.js — 雨课堂控制台前端（原生 JS，1s 轮询，状态全部来自结构化 JSON）
'use strict';

const $ = (id) => document.getElementById(id);

// 运行参数白名单：唯一允许进 localStorage 的键；认证 5 字段绝不存储
const RUN_KEYS = ['video_speed', 'heartbeat_interval', 'max_workers', 'skip_completed',
    'test_mode', 'test_video_count', 'use_concurrent', 'auto_richtext',
    'richtext_stay_seconds', 'richtext_skip_delay', 'debug'];
const AUTH_KEYS = ['classroom_id', 'sign', 'university_id', 'csrf_token', 'session_id'];
const STORE_KEY = 'yk_run_params';
const BOOL_RUN = new Set(['skip_completed', 'test_mode', 'use_concurrent', 'auto_richtext', 'debug']);

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
        const only = {};
        for (const k of RUN_KEYS) only[k] = collectParams()[k];
        localStorage.setItem(STORE_KEY, JSON.stringify(only));
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
    } catch (e) { /* 忽略损坏数据 */ }
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
        $('curBody').innerHTML = '<p class="muted">暂无执行中的任务</p>';
        $('workersBox').innerHTML = '<p class="muted">空闲 · 无执行线程</p>';
        $('terminalBanner').hidden = true;
        renderNow();
    }
}

function flashCfg(msg) { const el = $('cfgError'); if (el) el.textContent = msg || ''; }

// ---------------- 轮询 ----------------

function startPolling() {
    if (pollTimer) return;
    poll();
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
            `<p class="cur-chapter">${esc(cur.chapter)}</p>
             <p class="cur-name">${esc(cur.name)}</p>
             <span class="cur-kind">${esc(cur.kind)}</span>
             <i class="heart" title="心跳"></i>
             <div class="cur-bar"><i style="width:${cur.pct}%"></i></div>
             <div class="cur-row"><span class="cur-pct">${cur.pct}%</span><span class="muted">进行中</span></div>`;
    } else {
        $('curBody').innerHTML = '<p class="muted">暂无执行中的任务</p>';
    }
    const ws = snap.workers || [];
    $('workersBox').innerHTML = ws.length
        ? ws.map(w =>
            `<div class="worker-row">
                <span>${esc(w.name)}</span><span class="w-pct">${w.pct}%</span>
                <div class="w-bar"><i style="width:${w.pct}%"></i></div>
             </div>`).join('')
        : '<p class="muted">空闲 · 无执行线程</p>';
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
    if (snap.state === 'ready') html += '<button class="btn btn-primary" onclick="doStart()">▶ 开始执行</button>'
        + '<button class="btn btn-outline" onclick="doReset()">← 返回配置（换课 / 改参数）</button>';
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
        el.innerHTML = `<strong>✓ 执行完成</strong> — 共 ${st.total} 个任务 · 完成 ${st.completed} · 跳过 ${st.skipped} · 失败 ${st.failed}。可点「重新配置」开始下一门课。`;
    } else if (snap.state === 'stopped') {
        el.className = 'terminal-banner warn';
        el.innerHTML = `<strong>■ 已停止</strong> — 用户请求停止 · 已停止 ${st.stopped} · 未开始的任务保持排队。可点「重新配置」改参数或换课。`;
    } else {
        el.className = 'terminal-banner bad';
        el.innerHTML = `<strong>× 出错</strong> — ${esc(snap.error || '未知错误')}`;
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
