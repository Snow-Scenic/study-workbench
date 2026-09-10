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
};

function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEYS.bank, JSON.stringify(questionBank));
    localStorage.setItem(STORAGE_KEYS.bankName, currentBankName);
    localStorage.setItem(STORAGE_KEYS.wrongRecords, JSON.stringify(wrongRecords));
    localStorage.setItem(STORAGE_KEYS.answeredIds, JSON.stringify([...answeredIds]));
    localStorage.setItem(STORAGE_KEYS.theme, currentTheme);
    localStorage.setItem(STORAGE_KEYS.threshold, String(removalThreshold));
    localStorage.setItem(STORAGE_KEYS.totalStats, JSON.stringify(totalStats));
    localStorage.setItem(STORAGE_KEYS.wrongReviewEnabled, wrongReviewEnabled ? 'true' : 'false');
}

/**
 * 从 localStorage 恢复上次会话（含题库与做题记录）。
 * @returns {string|null} 恢复成功返回题库名称，否则 null
 */
function loadFromLocalStorage() {
    const storedBank = localStorage.getItem(STORAGE_KEYS.bank);
    if (!storedBank) return null;
    try { questionBank = JSON.parse(storedBank); } catch (e) { return null; }
    if (!questionBank || Object.keys(questionBank).length === 0) return null;
    try { wrongRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.wrongRecords) || '{}'); } catch (e) { wrongRecords = {}; }
    try { answeredIds = new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.answeredIds) || '[]')); } catch (e) { answeredIds = new Set(); }
    currentTheme = localStorage.getItem(STORAGE_KEYS.theme) || 'light';
    removalThreshold = parseInt(localStorage.getItem(STORAGE_KEYS.threshold)) || 3;
    const el = document.getElementById('removeThreshold');
    if (el) el.value = removalThreshold;
    try { totalStats = JSON.parse(localStorage.getItem(STORAGE_KEYS.totalStats) || '{"totalAnswered":0,"totalCorrect":0}'); } catch (e) { totalStats = { totalAnswered: 0, totalCorrect: 0 }; }
    wrongReviewEnabled = localStorage.getItem(STORAGE_KEYS.wrongReviewEnabled) !== 'false';
    currentBankName = localStorage.getItem(STORAGE_KEYS.bankName) || '';
    isEnglishBank = currentBankName.includes('英语');
    return currentBankName;
}

/**
 * 只读取历史进度元数据（不恢复题库本体，结构以服务器新加载为准）。
 * @returns {{name:string, wrongRecords:Object, answeredIds:Set<any>, totalStats:Object, wrongReviewEnabled:boolean}|null}
 */
function loadProgressOnly() {
    const name = localStorage.getItem(STORAGE_KEYS.bankName);
    if (!name) return null;
    let wrongRecords = {}, ids = [], totalStats = { totalAnswered: 0, totalCorrect: 0 };
    try { wrongRecords = JSON.parse(localStorage.getItem(STORAGE_KEYS.wrongRecords) || '{}'); } catch (e) {}
    try { ids = JSON.parse(localStorage.getItem(STORAGE_KEYS.answeredIds) || '[]'); } catch (e) {}
    try { totalStats = JSON.parse(localStorage.getItem(STORAGE_KEYS.totalStats) || '{"totalAnswered":0,"totalCorrect":0}'); } catch (e) {}
    const wrongReviewEnabled = localStorage.getItem(STORAGE_KEYS.wrongReviewEnabled) !== 'false';
    return { name, wrongRecords, answeredIds: new Set(ids), totalStats, wrongReviewEnabled };
}
