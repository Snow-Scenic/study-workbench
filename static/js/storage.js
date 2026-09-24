// storage.js — localStorage 持久化（题库、错题本、进度、设置）
'use strict';

const STORAGE_KEYS = {
    bank: 'quiz_questionBank',
    bankName: 'quiz_bankName',
    wrongRecords: 'quiz_wrongRecords',
    answeredIds: 'quiz_answeredIds',
    theme: 'quiz_theme',
    threshold: 'quiz_settings_threshold',
    totalStats: 'quiz_totalStats',
    wrongReviewEnabled: 'quiz_wrongReviewEnabled',
    questionStatus: 'quiz_questionStatus',
};

// 便携版只把进度与偏好写入 EXE 同目录 JSON；题库本体由 question_banks/ 保存。
const PORTABLE_STORAGE_KEYS = [
    STORAGE_KEYS.bankName, STORAGE_KEYS.wrongRecords, STORAGE_KEYS.answeredIds,
    STORAGE_KEYS.theme, STORAGE_KEYS.threshold, STORAGE_KEYS.totalStats,
    STORAGE_KEYS.wrongReviewEnabled, STORAGE_KEYS.questionStatus,
    'shell_sidebar_collapsed', 'yk_run_params', 'yk_remember_auth', 'yk_auth_params',
];
let _portableSaveTimer = null;

function portableStorageSnapshot() {
    const storage = {};
    for (const key of PORTABLE_STORAGE_KEYS) {
        try {
            const value = localStorage.getItem(key);
            if (value !== null) storage[key] = value;
        } catch (e) { /* localStorage 不可用时保留本次会话 */ }
    }
    return storage;
}

function savePortableState(immediate = false) {
    // This endpoint is available in the desktop server. Keep ordinary browser
    // previews and the lightweight test harness functional without it.
    if (typeof fetch !== 'function') return Promise.resolve();

    const send = () => {
        _portableSaveTimer = null;
        return fetch('/api/portable-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storage: portableStorageSnapshot() }),
            keepalive: true,
        }).catch(() => {});
    };
    if (immediate) {
        if (_portableSaveTimer) clearTimeout(_portableSaveTimer);
        return send();
    }
    if (_portableSaveTimer) clearTimeout(_portableSaveTimer);
    _portableSaveTimer = setTimeout(send, 320);
}

// L2：隔离每个键的存储异常——单个 setItem 失败（如超配额）不能中断答题收尾。
// JSON 序列化错误同样隔离（循环引用等），失败键仅告警并继续其余键。
function _safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value());
        return true;
    } catch (err) {
        console.warn(`[storage] 本地存储写入 ${key} 失败（${err && err.name || 'Error'}）：数据仅保留在本次会话，答题不受影响。`);
        return false;
    }
}

function saveToLocalStorage() {
    const qb = window.questionBank || (typeof questionBank !== 'undefined' ? questionBank : {});
    const bn = window.currentBankName || (typeof currentBankName !== 'undefined' ? currentBankName : '');
    const wr = window.wrongRecords || (typeof wrongRecords !== 'undefined' ? wrongRecords : {});
    const ai = window.answeredIds || (typeof answeredIds !== 'undefined' ? answeredIds : new Set());
    const th = window.currentTheme || (typeof currentTheme !== 'undefined' ? currentTheme : 'light');
    const rm = window.removalThreshold || (typeof removalThreshold !== 'undefined' ? removalThreshold : 3);
    const ts = window.totalStats || (typeof totalStats !== 'undefined' ? totalStats : { totalAnswered: 0, totalCorrect: 0 });
    const we = window.wrongReviewEnabled !== undefined ? window.wrongReviewEnabled : (typeof wrongReviewEnabled !== 'undefined' ? wrongReviewEnabled : true);
    const qs = window.questionStatus || (typeof questionStatus !== 'undefined' ? questionStatus : {});

    let failed = 0;
    const put = (key, make) => { if (!_safeSetItem(key, make)) failed++; };
    put(STORAGE_KEYS.bank, () => JSON.stringify(qb));
    put(STORAGE_KEYS.bankName, () => bn);
    put(STORAGE_KEYS.wrongRecords, () => JSON.stringify(wr));
    put(STORAGE_KEYS.answeredIds, () => JSON.stringify([...ai]));
    put(STORAGE_KEYS.theme, () => th);
    put(STORAGE_KEYS.threshold, () => String(rm));
    put(STORAGE_KEYS.totalStats, () => JSON.stringify(ts));
    put(STORAGE_KEYS.wrongReviewEnabled, () => we ? 'true' : 'false');
    put(STORAGE_KEYS.questionStatus, () => JSON.stringify(qs));
    if (failed > 0) console.warn(`[storage] ${failed} 项数据未能持久化，刷新后可能丢失部分进度。`);
    savePortableState();
    return failed === 0;
}

/**
 * 从 localStorage 恢复上次会话（含题库与做题记录）。
 * @returns {string|null} 恢复成功返回题库名称，否则 null
 */
function loadFromLocalStorage() {
    const storedBank = localStorage.getItem(STORAGE_KEYS.bank);
    if (!storedBank) return null;
    let loadedBank = null;
    try { loadedBank = JSON.parse(storedBank); } catch (e) { return null; }
    if (!loadedBank || Object.keys(loadedBank).length === 0) return null;
    window.questionBank = loadedBank;
    if (typeof questionBank !== 'undefined') questionBank = loadedBank;

    let loadedWr = {};
    try { loadedWr = JSON.parse(localStorage.getItem(STORAGE_KEYS.wrongRecords) || '{}'); } catch (e) { loadedWr = {}; }
    window.wrongRecords = loadedWr;
    if (typeof wrongRecords !== 'undefined') wrongRecords = loadedWr;

    let loadedIds = new Set();
    try { loadedIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.answeredIds) || '[]')); } catch (e) { loadedIds = new Set(); }
    window.answeredIds = loadedIds;
    if (typeof answeredIds !== 'undefined') answeredIds = loadedIds;

    const theme = localStorage.getItem(STORAGE_KEYS.theme) || 'light';
    window.currentTheme = theme;
    if (typeof currentTheme !== 'undefined') currentTheme = theme;

    const thresh = parseInt(localStorage.getItem(STORAGE_KEYS.threshold)) || 3;
    window.removalThreshold = thresh;
    if (typeof removalThreshold !== 'undefined') removalThreshold = thresh;
    const el = document.getElementById('removeThreshold');
    if (el) el.value = thresh;

    let stats = { totalAnswered: 0, totalCorrect: 0 };
    try { stats = JSON.parse(localStorage.getItem(STORAGE_KEYS.totalStats) || '{"totalAnswered":0,"totalCorrect":0}'); } catch (e) { stats = { totalAnswered: 0, totalCorrect: 0 }; }
    window.totalStats = stats;
    if (typeof totalStats !== 'undefined') totalStats = stats;

    let loadedQs = {};
    try { loadedQs = JSON.parse(localStorage.getItem(STORAGE_KEYS.questionStatus) || '{}'); } catch (e) { loadedQs = {}; }
    window.questionStatus = loadedQs;
    if (typeof questionStatus !== 'undefined') questionStatus = loadedQs;

    const reviewEnabled = localStorage.getItem(STORAGE_KEYS.wrongReviewEnabled) !== 'false';
    window.wrongReviewEnabled = reviewEnabled;
    if (typeof wrongReviewEnabled !== 'undefined') wrongReviewEnabled = reviewEnabled;

    const bName = localStorage.getItem(STORAGE_KEYS.bankName) || '';
    window.currentBankName = bName;
    if (typeof currentBankName !== 'undefined') currentBankName = bName;

    const isEng = bName.includes('英语');
    window.isEnglishBank = isEng;
    if (typeof isEnglishBank !== 'undefined') isEnglishBank = isEng;

    return bName;
}

/**
 * 只读取历史进度元数据（不恢复题库本体，结构以服务器新加载为准）。
 * @returns {{name:string, wrongRecords:Object, answeredIds:Set<any>, totalStats:Object, wrongReviewEnabled:boolean, questionStatus:Object}|null}
 */
function loadProgressOnly() {
    const name = localStorage.getItem(STORAGE_KEYS.bankName);
    if (!name) return null;
    let wrongRecords = {}, ids = [], totalStats = { totalAnswered: 0, totalCorrect: 0 }, questionStatus = {};
    try { wrongRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.wrongRecords) || '{}'); } catch (e) {}
    try { ids = JSON.parse(localStorage.getItem(STORAGE_KEYS.answeredIds) || '[]'); } catch (e) {}
    try { totalStats = JSON.parse(localStorage.getItem(STORAGE_KEYS.totalStats) || '{"totalAnswered":0,"totalCorrect":0}'); } catch (e) {}
    try { questionStatus = JSON.parse(localStorage.getItem(STORAGE_KEYS.questionStatus) || '{}'); } catch (e) {}
    const wrongReviewEnabled = localStorage.getItem(STORAGE_KEYS.wrongReviewEnabled) !== 'false';
    return { name, wrongRecords, answeredIds: new Set(ids), totalStats, wrongReviewEnabled, questionStatus };
}

window.savePortableState = savePortableState;
if (typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', () => { savePortableState(true); });
}
