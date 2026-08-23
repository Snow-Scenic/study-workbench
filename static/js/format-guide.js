// format-guide.js — 导入格式说明模态（hub 与题库导入界面共用）
'use strict';

const FORMAT_GUIDE_HTML = `
<h2>📋 题库导入格式说明</h2>
<p class="muted fg-intro">题库为 UTF-8 编码的 .json 文件。顶层结构：</p>
<pre>{
  "meta": { "name": "我的题库", "version": "1.0" },
  "categories": {
    "cat1": { "label": "📖 第一章", "questions": [ …题目… ] }
  }
}</pre>
<table class="fg-table">
  <tr><th>type</th><th>题型</th><th>必填字段</th><th>ans 取值</th></tr>
  <tr><td>single / en_single</td><td>单选题</td><td>id, q, opts[]</td><td>数字（正确项下标，从 0 开始）</td></tr>
  <tr><td>judge / TF</td><td>判断题</td><td>id, q, opts[]（两项）</td><td>0 或 1（如 ["正确","错误"]）</td></tr>
  <tr><td>multi</td><td>多选题</td><td>id, q, opts[]</td><td>数字数组，如 [0,2]</td></tr>
  <tr><td>matching</td><td>匹配题</td><td>id, q, left[], right[], ans[]</td><td>ans[i] = 左第 i 项对应的右项下标</td></tr>
</table>
<p class="fg-note">公共规则：id 全库唯一；缺必填字段的题目会被跳过；某分类无有效题目则整类跳过。</p>
<p class="fg-note">可选字段（所有题型通用）：<b>analysis</b> 解析 · <b>memo</b> 速记 · <b>q_trans</b> 中文翻译。答错时自动展示，答对后可在右侧栏手动查看。</p>
<div class="fg-example">
<b>单选示例：</b>
<pre>{ "id":"q1", "type":"single", "q":"1+1=?",
  "opts":["1","2"], "ans":1,
  "analysis":"进位加法基础题。" }</pre>
<b>匹配示例：</b>
<pre>{ "id":"m1", "type":"matching", "q":"连线",
  "left":["A国","B国"], "right":["首都甲","首都乙"],
  "ans":[0,1] }</pre>
</div>
<button class="btn btn-outline" onclick="downloadTemplate()">⬇️ 下载空白模板</button>
`;

function ensureGuideOverlay() {
    let ov = document.getElementById('fgOverlay');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = 'fgOverlay';
        ov.className = 'legal-overlay';
        ov.innerHTML = '<div class="legal-panel fg-panel">' + FORMAT_GUIDE_HTML +
            '<br><button class="btn btn-primary" onclick="closeFormatGuide()">知道了</button></div>';
        document.body.appendChild(ov);
    }
    return ov;
}

function openFormatGuide() { ensureGuideOverlay().style.display = 'flex'; }
function closeFormatGuide() {
    const ov = document.getElementById('fgOverlay');
    if (ov) ov.style.display = 'none';
}

function downloadTemplate() {
    const tpl = {
        meta: { name: '我的题库', version: '1.0' },
        categories: {
            第一章: { label: '📖 第一章', questions: [
                { id: 'q1', type: 'single', q: '单选题干', opts: ['选项A', '选项B'], ans: 0, analysis: '答案说明（可选）' },
                { id: 'q2', type: 'judge', q: '判断题干', opts: ['正确', '错误'], ans: 0 },
                { id: 'q3', type: 'multi', q: '多选题干', opts: ['A', 'B', 'C'], ans: [0, 2] },
                { id: 'q4', type: 'matching', q: '匹配题干', left: ['左1', '左2'], right: ['右1', '右2'], ans: [0, 1] }
            ]}
        }
    };
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'template.json';
    a.click();
}

/* fg 专属补充样式（挂 components.css 亦可，此处随组件走便于集中管理） */
document.head.insertAdjacentHTML('beforeend',
    '<style>.fg-panel{text-align:left}.fg-panel h2{margin-bottom:10px}' +
    '.fg-intro{font-size:.84rem;margin:0 0 8px}' +
    '.fg-table{width:100%;border-collapse:collapse;font-size:.78rem;margin:10px 0}' +
    '.fg-table th,.fg-table td{border:1px solid var(--border);padding:5px 7px;text-align:left}' +
    '.fg-table th{background:rgba(var(--pr),.08)}' +
    '.fg-note{font-size:.8rem;color:var(--text-light);margin:6px 0}' +
    '.fg-example pre,.fg-panel > pre{background:var(--bg);border:1px solid var(--border);' +
    'border-radius:var(--radius-sm);padding:8px 10px;font-size:.74rem;overflow-x:auto;margin:6px 0 12px}' +
    '</style>');
