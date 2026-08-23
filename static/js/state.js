// state.js — 全局状态与常量（唯一的状态声明处，所有模块共享）
'use strict';

// 题库数据（由题库选择或导入填充）
let questionBank = {};        // { 分类key: { label, questions } }
let currentBankName = '';     // 当前题库名称
let isEnglishBank = false;    // 是否为英语题库（答题后显示翻译/解析/速记）

// 练习状态
let allQuestions = [];        // 扁平化全部题目（含 sectionKey / sectionLabel）
let currentSection = 'all';   // 'all' | 分类key | '__wrong__'
let currentMode = 'idle';     // 'idle' | 'practice' | 'review'
let currentQuestionIndex = 0;
let practiceQuestions = [];   // 本轮练习队列
let qAnimDir = '';            // 切题方向：'' 首次 | 'next' | 'prev'
let answeredMap = {};         // 本次作答状态 { id:'correct'|'wrong', id_selected:[], id_chosen:n }
let answeredIds = new Set();  // 跨会话累计已做题 ID
let matchState = {};          // 匹配题交互状态 { id: { selectedLeft, selectedRight, pairs:[[l,r]] } }

// 错题本
let wrongRecords = {};        // { id: { wrongCount, consecutiveCorrect } }
let removalThreshold = 3;     // 连续答对 N 次后移出错题本
let wrongReviewEnabled = true;// 是否启用错题复习功能

// 统计与外观
let totalStats = { totalAnswered: 0, totalCorrect: 0 }; // 持久化总统计
let sessionAnswered = 0;
let sessionWrong = 0;
let currentTheme = 'light';
let importMode = 'replace';   // 导入模式：'replace' | 'merge'

// 六种题型的显示名与样式类
const TYPE_MAP = {
    single:   ['单选题', 'single'],
    judge:    ['判断题', 'judge'],
    multi:    ['多选题', 'multi'],
    TF:       ['True/False', 'tf'],
    en_single:['Single Choice', 'en_single'],
    matching: ['Matching', 'matching'],
};
