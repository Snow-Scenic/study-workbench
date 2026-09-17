// state.js — 全局状态与常量（唯一的状态声明处，所有模块共享）
'use strict';

// 题库数据（由题库选择或导入填充）
var questionBank = window.questionBank = window.questionBank || {};        // { 分类key: { label, questions } }
var currentBankName = window.currentBankName = window.currentBankName || '';     // 当前题库名称
var isEnglishBank = window.isEnglishBank = window.isEnglishBank || false;    // 是否为英语题库（答题后显示翻译/解析/速记）

// 练习状态
var allQuestions = window.allQuestions = window.allQuestions || [];        // 扁平化全部题目（含 sectionKey / sectionLabel）
var currentSection = window.currentSection = window.currentSection || 'all';   // 'all' | 分类key | '__wrong__'
var currentMode = window.currentMode = window.currentMode || 'idle';     // 'idle' | 'practice' | 'review'
var currentQuestionIndex = window.currentQuestionIndex = window.currentQuestionIndex || 0;
var practiceQuestions = window.practiceQuestions = window.practiceQuestions || [];   // 本轮练习队列
var qAnimDir = window.qAnimDir = window.qAnimDir || '';            // 切题方向：'' 首次 | 'next' | 'prev'
var answeredMap = window.answeredMap = window.answeredMap || {};         // 本次作答状态 { id:'correct'|'wrong', id_selected:[], id_chosen:n }
var answeredIds = window.answeredIds = window.answeredIds || new Set();  // 跨会话累计已做题 ID
var matchState = window.matchState = window.matchState || {};          // 匹配题交互状态 { id: { selectedLeft, selectedRight, pairs:[[l,r]] } }

// 错题本
var wrongRecords = window.wrongRecords = window.wrongRecords || {};        // { id: { wrongCount, consecutiveCorrect } }
var removalThreshold = window.removalThreshold = window.removalThreshold || 3;     // 连续答对 N 次后移出错题本
var wrongReviewEnabled = window.wrongReviewEnabled = (typeof window.wrongReviewEnabled !== 'undefined' ? window.wrongReviewEnabled : true);// 是否启用错题复习功能

// 统计与外观
var totalStats = window.totalStats = window.totalStats || { totalAnswered: 0, totalCorrect: 0 }; // 持久化总统计
var sessionAnswered = window.sessionAnswered = window.sessionAnswered || 0;
var sessionWrong = window.sessionWrong = window.sessionWrong || 0;
var currentTheme = window.currentTheme = window.currentTheme || 'light';
var importMode = window.importMode = window.importMode || 'replace';   // 导入模式：'replace' | 'merge'
var tabsIntroPending = window.tabsIntroPending = (typeof window.tabsIntroPending !== 'undefined' ? window.tabsIntroPending : true);

// 六种题型的显示名与样式类
const TYPE_MAP = {
    single:   ['单选题', 'single'],
    judge:    ['判断题', 'judge'],
    multi:    ['多选题', 'multi'],
    TF:       ['True/False', 'tf'],
    en_single:['Single Choice', 'en_single'],
    matching: ['Matching', 'matching'],
};
window.TYPE_MAP = TYPE_MAP;

// 暴露状态访问器，避免模块作用域引起的未定义问题
window.getAppState = function () {
    return {
        questionBank: typeof questionBank !== 'undefined' ? questionBank : window.questionBank,
        currentBankName: typeof currentBankName !== 'undefined' ? currentBankName : window.currentBankName,
        allQuestions: typeof allQuestions !== 'undefined' ? allQuestions : window.allQuestions,
        practiceQuestions: typeof practiceQuestions !== 'undefined' ? practiceQuestions : window.practiceQuestions,
        answeredIds: typeof answeredIds !== 'undefined' ? answeredIds : window.answeredIds,
        wrongRecords: typeof wrongRecords !== 'undefined' ? wrongRecords : window.wrongRecords,
        totalStats: typeof totalStats !== 'undefined' ? totalStats : window.totalStats,
        currentMode: typeof currentMode !== 'undefined' ? currentMode : window.currentMode,
        currentQuestionIndex: typeof currentQuestionIndex !== 'undefined' ? currentQuestionIndex : window.currentQuestionIndex
    };
};

// 题库校验统一由随后加载的 bank-loader.js 提供；此文件只声明共享状态。

