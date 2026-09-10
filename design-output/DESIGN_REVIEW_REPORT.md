# Study Workbench — UI Redesign Design Review (INSPECTION ONLY, NO CHANGES MADE)

Status: INSPECTED. Nothing implemented. No files modified/deleted/created beyond this report.

---

## 1. Repository Frontend Architecture

Key files and responsibilities:

| File | Type | Responsibility |
|---|---|---|
| `templates/index.html` | Template | Quiz practice shell (bank select / import / header / stats / tabs / card / sidebar / bottom bar / progress / modal layers) |
| `templates/hub.html` | Template | Home hub (brand seal + 2 cards: 刷题 / 刷课 + legal overlay) |
| `templates/yuketang.html` | Template | Course console shell (HUD + config + scan + timeline + exec + terminal) |
| `static/css/base.css` | CSS | Design tokens (light=宣纸 gradient, dark=墨夜 gradient), font vars, animations, print rules |
| `static/css/components.css` | CSS | Buttons (btn/primary/outline/sm/danger/warn/success), stat chips (pill, shadow), tabs row + expandable drawer, option items, feedback bars, sidebar (60px→240px hover), note panel (slide-right), modal overlays (z-index 10001) |
| `static/css/pages.css` | CSS | Header sticky + progress row + seal + bottom-bar floating capsule + card + finish ring + import/bank-select screens + responsive breakpoints (1560/900/480) |
| `static/css/hub.css` | CSS | Hub wrap (centered), cards (210px, hover lift), seal |
| `static/css/yuketang.css` | CSS | Full independent theme (deep blue CSS vars --yk-*; v4-v6 iterations: dark→light transition, glass cards, floating exec-actions, laser timeline) — NOT using base tokens, remaps --primary/--bg locally |
| `static/js/state.js` | JS | Global state (questionBank, answeredIds, wrongRecords, currentMode/Section/Index, TYPE_MAP) |
| `static/js/storage.js` | JS | localStorage keys + load/save/loadProgressOnly |
| `static/js/ui.js` | JS | Theme toggle + generic showModal(overlay, header/body/footer buttons) |
| `static/js/bank-loader.js` | JS | validateBankData() + initAllQuestions() + applyValidatedBank() + resetAnswerState() + afterBankLoaded() |
| `static/js/bank-select.js` | JS | scan (/scan) → bank list → selectBank() → progress dialog (continue/restart/cancel) |
| `static/js/import-ui.js` | JS | import screen toggle + file read + persist to /api/banks/save |
| `static/js/question-render.js` | JS | renderCurrentQuestion() (6 types via TYPE_MAP) + updateNotePanel() (auto-open on wrong) + updateProgressUI() |
| `static/js/answer.js` | JS | selectOption() / submitMulti() |
| `static/js/matching.js` | JS | selectMatchItem() / submitMatching() |
| `static/js/practice.js` | JS | startPractice() / finishPractice() / shuffle / showAllDoneModal() |
| `static/js/navigation.js` | JS | buildSectionTabsHtml() + toggleTabsDrawer() + updateTabsUI() (overflow detection) + switchSection() + prev/next/question jump |
| `static/js/stats.js` | JS | finishAnswer() (wrongCounts/consecutiveCorrect) + updateWrongCount()/updateStats()/resetWrong()/showStats()/reviewWrong()/setThreshold() |
| `static/js/main.js` | JS | Keyboard shortcuts (arrow, n/p, 1-9 for options) + window load (restore theme/threshold, showBankSelectScreen) + beacon |
| `static/js/yuketang.js` | JS | Polling (1s /api/yuketang/status), render(snap) — timeline/exec/logs/actions; view state machine (idle/analyzing/ready/running/finished/stopped/error); demo params |
| `server.py` | Python | HTTP server (routes: /, /quiz, /yuketang, /scan, /banks/, /api/banks/save, /api/yuketang/*, /static/, /shutdown, /beacon); 8MB bank save limit; safe_join/path traversal block; ThreadingTCPServer |
| `yuketang_core.py` | Python | MockCore (offline demo: 20-task plan v+R, ThreadPoolExecutor, random fail/skip, debug mode); RealYukeCore loaded via adapter |

Dependencies: `main.py` → `server.py` + `config.py`; `templates/*` → `static/css/*.css` + `static/js/*.js`; quiz page loads `base→components→pages`; yuketang loads only `yuketang.css`; `yuketang.js` calls `/api/yuketang/status` independently.

---

## 2. Current User Workflows

- **Launch**: `python main.py` → server starts at 8000 (falls back 8001-8009) → browser opens `/` → hub.html shown (legal overlay until acked) → `showBankSelectScreen()` (bank list from `/scan`; empty → import prompt).
- **Choose/import bank**: Click bank item (`selectBank()`) → server fetches `/banks/<file>` → `validateBankData()` → if previous progress exists (`loadProgressOnly()` matches name) → progress dialog (continue/restart); else load → afterBankLoaded() → hide bank screen; OR click import → `showImportDialog()` → file select (`handleImport()`) → `applyValidatedBank()` (replace/merge); save to `/api/banks/save`; persist.
- **Start/resume practice**: Idle state → `startPractice()` builds queue (shuffle, priority un-answered if checked, wrong-filter if `__wrong__`) → render card + sidebar + progress fill + bottom bar.
- **Answer**: Single/TF/Judge/EN = click option → instant correct/incorrect feedback + correct-answer highlight; Multi = select then submit; Matching = click-left + click-right pair then submit → feedback + note panel logic.
- **Explanation**: `updateNotePanel()` — if wrong, auto-open; if correct, button available; slides out from right (`notePanel` absolute left=calc(100%+18px)). Contains `analysis`/`memo`/`q_trans`.
- **Review mistakes**: `reviewWrong()` pop-up checkbox levels (1..N) + "全部" → `startFilteredReview()` → `currentSection='__wrong__'`; wrong filter dropdown (all/1..5); threshold setting (continuous-correct removal count, default 3).
- **Statistics**: Stats bar (chips with numbers, popIn stagger) + `showStats()` modal (table); persistent totals (`totalStats: {totalAnswered, totalCorrect}`).
- **Course Console**: `/yuketang` → fill params (demo or real) → `doAnalyze()` → `MockCore.analyze()` → scan view → timeline/exec/logs; poll loop; actions: start/stop/reset.
- **Theme**: `data-theme` light/dark; light = 宣纸 gradient; dark = 墨夜 gradient; `yuketang.css` remaps its own palette regardless (cyan/blue theme for console — INCONSISTENT with base theme).

---

## 3. Current UI Information Architecture

Pages (3 separate HTML shells, no SPA navigation):

- **Hub (`/`)**: Centered vertical stack (logo/seal + h1 + subtitle + 2 cards horizontally + footer with format guide / shutdown). Modal: legal disclaimer (required first-time acknowledgment). No sidebar / no top bar — minimal landing.
- **Quiz (`/quiz`)**: Top-to-bottom stacked zones (not sidebar layout):
  1. Full-screen bank-select / import overlays (z 9999)
  2. `top-zone`: sticky header (brand + actions: home/book/import/theme + stats-bar row of 6 chips + progress track + section-tabs row + expandable drawer)
  3. `container`: card column (max-width 760px centered) + `notePanel` (right slide-out from card) + fixed `sidebar` (right edge 60px→240px hover) + `bottom-bar` (floating pill at bottom center, fixed, opacity 0.45→1 on hover/focus)
  4. Progress dialog (centered overlay)
- **Yuketang (`/yuketang`)**: Single-page vertical: sticky HUD (left: back+seal+title+badge; middle: 5 stat chips; right: mock badge) → config card (2-column: main form + side instructions) OR scanning ring OR console grid (timeline + exec panels + actions + floating bottom capsule) → fixed terminal footer.

Navigation is page-to-page (a href to / or /quiz or /yuketang); no shared shell.

---

## 4. Current UX Problems (Categorized)

**Information Architecture**
- 3 separate page shells with duplicated header/branding/overlay patterns (no shared shell / no router).
- Quiz has 2 separate entry points (bank select overlay + bottom-bar actions) — redundant paths to same state.
- Course console has its own independent theme — not part of site identity.
- No unified "home / learn / insights / tools / settings" structure described in product direction.

**Visual Hierarchy**
- Quiz stats bar has 6 pill chips with emoji + numbers — high visual density; no clear primary metric.
- Bottom-bar floating capsule overlaps content (padding-bottom 108px required); opacity 0.45 by default makes it easy to miss.
- Card decorative top gradient stripe (3px red→gold) + card-enter animation + correct/wrong left-border + note slide — multiple competing decorative signals.
- `yuketang.css` has its own background gradients, glass cards, laser timeline, flow animations — visually unrelated to quiz theme.
- Seal (朱砂 red with gold shadow) is decorative and repeated on every page; no functional value.
- Emoji used extensively as interface icons (📚📥🏠❌✅⚠️📊) — not accessible and inconsistent with design direction.

**Consistency**
- Theme toggle only affects `data-theme` in `base.css` (light/dark), but `yuketang.css` fully overrides colors — console never respects user's theme choice.
- Button styles: `btn-primary` uses gradient; `yuketang.css` remaps `--primary` to cyan — different primary color per page.
- Font: serif (`font-serif`: Noto Serif SC) used for headers/seals; sans-serif for body — acceptable, but not applied consistently (yuketang uses sans only).
- Border radius varies: `var(--radius)` 14px (cards), 999px (chips/pills), 8px (seals), 6px (checkbox), 10px (sidebar items) — no systematic scale.
- Shadow tokens: `--shadow` (large) vs `--shadow-sm`; yuketang uses entirely different shadow values.

**Navigation**
- No persistent sidebar / top-nav for quiz: user must use bottom-bar buttons or header actions to switch sections / review / stats.
- Section tabs overflow → drawer; only visible when tabs exceed width — hidden by default.
- Progress dialog (continue/restart) appears only when past session found; no way to browse progress of other banks.
- No breadcrumb / back link from quiz to hub except the header button (🏠).

**Interaction**
- Note panel (right slide) can overlap sidebar when narrow; at 1560px it collapses below card (responsive) — abrupt layout change.
- Sidebar hover (60px→240px) requires precise mouse positioning; on touch/non-hover contexts it stays collapsed.
- Matching interact state (`matchState`) not persisted in localStorage — refresh resets pair selections mid-question (minor; within-session only).
- Keyboard shortcuts (1-9 digits) only work for single-choice types; multi requires click+submit; matching requires clicks.
- Bottom-bar opacity 0.45 can cause users to miss it; hover reveals but requires intentional interaction.

**Accessibility**
- Emoji as icon labels (no aria-label / no text equivalents) — screen readers announce emoji names.
- Focus-visible ring (`outline: 3px solid var(--primary-light)`) is visible, but button hover effects include scale + shadow + gradient changes that may confuse focus indicators.
- Color-coded feedback (red/green borders + text) relies solely on color; no icon/text distinction for correct/wrong beyond the text message.
- `question-card` uses `animation: cardEnter` which may cause motion sensitivity issues (no `prefers-reduced-motion` guard).
- No skip-links, no ARIA landmarks (header/main/aside roles missing in templates), no `aria-current` on active tabs.
- Modal overlays use `onclick="this.remove()"` — closes on any overlay click, which can accidentally dismiss if user clicks near edge.

**Responsiveness**
- Quiz container `max-width: 760px` — narrow on desktop, wastes space; breaks below 900px (bottom-bar rounds, header shrinks) and 480px (big font/padding reductions).
- Note panel collapses to static below card at 1560px — large-screen users lose side panel; small-screen users get full-width (good) but no side anatomy.
- Sidebar fixed at `right: 0` — can overlap note panel or content when viewport narrow.
- Yuketang `yk-config` uses `min(720px, 94vw)` but console grid switches to 1-col at 1080px — reasonable but not consistent with quiz.
- No tablet-specific layout between 480px and 900px (only 2 breakpoints).

**Maintainability**
- CSS split into 5 files with cross-file dependencies (`base` → `components` → `pages`; `hub` standalone; `yuketang` fully independent). Changing theme in `yuketang` requires editing `yuketang.css` directly; no shared token system.
- `base.css` defines all tokens in `:root`; `yuketang.css` redefines `--primary/--bg` locally inside `.yk-app` — override by design, not by token inheritance.
- JavaScript uses global variables (`currentTheme`, `currentMode`, `questionBank`) — no module pattern, no namespacing; risk of collisions.
- `state.js` defines all globals; other files depend on load order (state → storage → ui → bank-loader → ... → main). Changing load order breaks.
- `yuketang.css` contains ~1150 lines (v4-v6 iterations, deprecated rules, multiple fixes) — hard to modify without understanding which version applies.
- No CSS build step / no design-token extraction — colors embedded in rules; to change primary must search/replace across `base.css`, `components.css`, `pages.css`, `yuketang.css`.
- Template HTML uses inline `onclick="..."` extensively — not maintainable, mixes content and behavior.

---

## 5. Existing Functionality That Must Not Be Lost

Verified present and functioning (test evidence: `tests/test_server.py` 67 cases, `test_yuketang_*.py` cases):

- 6 question types: `single`, `judge`, `TF`, `multi`, `en_single`, `matching` (render + answer logic in `question-render.js`, `answer.js`, `matching.js`).
- Wrong-answer book (`wrongRecords` with `wrongCount` + `consecutiveCorrect`; filter by error count; auto-remove at threshold; `cleanupWrongRecords()` on section switch).
- Progress persistence (`localStorage` keys; `loadFromLocalStorage()` / `loadProgressOnly()`; resume dialog on bank reload; progress bar UI; sidebar item colors showing correct/wrong/gap).
- Statistics (`updateStats()` counts session + totals; `showStats()` modal; stats-bar chips; totalCorrect/totalAnswered persistence).
- Answer explanation panel (`analysis`, `memo`, `q_trans`; auto-open on wrong; manual toggle; slides from right of card; hidden by default).
- Import / export format (`format-guide.js` defines JSON schema; `validateBankData()` cleans; `downloadTemplate()` creates template; `persistImportedBank()` saves to server `question_banks/`).
- Keyboard navigation (arrow keys for prev/next; digit 1-9 for single-choice selection; `n`/`p` aliases).
- Course console: parameter form → analyze → timeline/task execution → live progress bars → multi-threaded simulation → stop/reset → log terminal; demo mode vs real mode routing.
- Theme toggle (light/dark) with `data-theme`; print CSS; selection color.
- Bank selection with scan (`/scan`); file naming sanitization (`_safe_bank_filename()`); path traversal blocking (`_safe_join`).
- Auto-shutdown / watchdog (`/beacon` every 3s; 15s timeout → server shutdown; `cleanup_server()` registered via `atexit`).
- Status API (`/api/yuketang/status`) returning structured snapshot; mock core generating structured data.

---

## 6. Existing Frontend Code That Can Be Reused

Reusable (will keep logic, replace presentation layer):

- `state.js` — global state definitions (names/structure can carry over, but may be namespaced).
- `storage.js` — key definitions and load/save logic (preserves data format; UI can read from this).
- `bank-loader.js` — `validateBankData()` logic (business rules, not UI); `applyValidatedBank()`; `resetAnswerState()`.
- `question-render.js` — render logic per type (can be retained as a render engine behind new components).
- `answer.js`, `matching.js`, `stats.js` — answer grading / wrong-book logic (business rules independent of UI).
- `navigation.js` — section-switch logic and progress tracking (functional).
- `yuketang.js` — polling, render pipeline, API calls (functional layer; UI shell can be rebuilt around it).
- `main.js` — keyboard handler and startup sequence (preserve behavior).
- `format-guide.js` — format documentation HTML (content reusable; presentation reusable if kept as document page).
- `yuketang_core.py` / `yuketang_manager.py` — backend mock/real core (not frontend, but must not be disrupted)

---

## 7. Existing Frontend Code/Design That Should Be Replaced

Replace / redesign (will be rebuilt in new shell):

- All HTML templates: `index.html`, `hub.html`, `yuketang.html` — rebuild as unified shell (or distinct but consistent) pages.
- All CSS (all files): `base.css`, `components.css`, `pages.css`, `hub.css`, `yuketang.css` — replace with new token system + component library; do not attempt to patch currently.
- All presentation-layer JS in `ui.js`, `practice.js`, `navigation.js` (tab rendering, drawer, progress bar updates), `question-render.js` presentation HTML generation — replace rendering with component-based approach.
- Emoji interface icons (all `📚📥🏠❌✅⚠️📊🔁🔄📋` etc.) → replace with consistent icon system.
- `bottom-bar` floating capsule design → redesign as persistent action area or toolbar (not floating pill with opacity toggle).
- `sidebar` hover-expand mechanism → redesign as collapsible panel or persistent narrow nav.
- Decorative gradients (card top stripes, seal gradients, progress-fill gradients) → simplify to flat or subtle accent.
- `yuketang.css` independent theme → unify with site theme (or make console respect site theme with a disciplined override rather than full replacement).
- Modal overlay patterns (click-outside-to-close with `onclick="this.remove()"`) → proper modal management with focus trapping and explicit close controls.
- `legal-overlay` mandatory-first-time pattern → consider whether required (legal disclaimer is fine, but design can be calmer, not full-screen blocking).

---

## 8. Proposed UI v2 Information Architecture

Based on product direction (Study Workbench → modern desktop-first learning productivity app) and existing functionality:

```
Study Workbench
├── Home (hub redesigned)
├── Learn
│   ├── Practice (quiz — redesigned)
│   ├── Question Banks (bank management + import — redesigned)
│   └── Review (wrong-book + filtered practice — redesigned, may be tab/section within Practice)
├── Insights
│   └── Statistics (stats panel — redesigned, possibly integrated into Practice or separate page)
└── Tools
    ├── Course Console (yuketang — redesigned shell but same backend)
    └── Settings (theme + threshold + preferences — new page or panel, currently only theme toggle exists)
```

Notes:
- "Learn" groups practice + banks + review — this matches current reality (bank selection is entry to practice; review is a section of practice; banks are managed within the same flow).
- "Insights / Statistics" may be a dedicated view or a persistent panel — currently stats are in-bar chips + modal; v2 can give statistics a proper page or sidebar panel.
- "Tools / Course Console" should follow same shell theme, not independent.
- "Settings" is currently only a theme toggle button + hidden threshold setting; v2 should have a dedicated settings view.
- Chinese identity ("学") kept as subtle brand mark (seal/logo) — not decorative theme.

---

## 9. Proposed Application Shell

Modern desktop-first productivity app shell (drawing from Linear/Notion/Raycast/Vercel principles — not imitating any single one):

- **Sidebar** (left, narrow ~220px, collapsible to ~64px icons): navigation to Home, Learn (Practice / Banks / Review), Insights (Stats), Tools (Console), Settings. Active section indicated with subtle left accent (2px bar, not full background). Subsections shown when section expanded (e.g., under Learn: Practice / Banks / Review). Brand mark ("学" character as subtle monochrome mark, not red seal) at top. No emoji icons — use simple geometric/stroke icons.
- **Top Bar** (above content, fixed): page/section title + breadcrumbs + context actions (e.g., Import, Theme). Minimal — no massive stats bar here (stats move to sidebar or content). Search / quick filter available (for banks/questions).
- **Content Area** (main, flexible width): page content. Practice page: question cards in a centered readable column (max ~720px for readability) with adequate whitespace; notes/explanations shown inline or in a right contextual panel (not sliding from card edge). Banks page: list/grid of banks with import action; review page: filtered wrong-question list with filters.
- **Contextual Panels / Drawers** (right, optional): when reviewing or analyzing statistics, a side panel can show details (similar to current `notePanel` but integrated into shell, not floating from card). Closed by default on small screens; can be toggled.
- **Responsive Behavior**: desktop-first (sidebar always visible). On narrower viewports: sidebar collapsible to icon-only; at very narrow: sidebar can hide behind hamburger. Content reflows naturally (cards stay readable; no abrupt collapse of note panel to static — use stacked layout instead). No fixed bottom floating capsule; actions stay in top bar / bottom of content area or in sidebar.

---

## 10. Proposed Page Responsibilities

- **Home**: Brand + brief purpose + quick entry cards (Practice / Console / Stats / Settings). Minimal, calm — not a marketing hero. Subtle "学" mark. No large imagery.
- **Practice**: Main workspace. Left: section tabs / category nav (horizontal or sidebar sub-nav); center: current question card (clean card, no decorative gradient stripe at top — just subtle border or shadow); right (optional): explanation / notes panel. Bottom (or sidebar): progress indicator (simple progress line, not 6-chip stats bar). Actions: Start / Continue / Submit / Next / Previous. Keyboard shortcuts preserved.
- **Question Banks**: List of imported banks (from server scan + localStorage). Import button (file picker or drag). Each bank shows name, count, last accessed. Click to open in Practice. Auto-detect previous progress and offer resume.
- **Review** (or section within Practice): Filtered view of wrong questions (by error count, with counts shown clearly). Options to practice filtered set. After completing a filtered review, auto-remove from wrong book if continuous-correct threshold met.
- **Statistics**: Clear metrics (total answered, correct, wrong, accuracy, distribution). Chart or table of mistake patterns (current `showStats()` is a simple table; v2 can add visual clarity without over-engineering — a clean table or small bar chart). Historical view of sessions.
- **Course Console**: Same functionality — parameter setup → analyze → execute timeline → logs. Rebuild presentation in unified shell (same sidebar/top bar). Remove independent theme; use site theme with maybe a subdued dark mode option specifically for console (if needed for long-running view), but not a different color system.
- **Settings**: Theme preference (light/dark / system), wrong-book threshold (continuous correct count), default practice mode (priority un-answered), keyboard shortcut info, data export (localStorage download / clear), about / disclaimers.

---

## 11. Proposed Design System Foundation

(Aligned with direction: modern neutral interface, warm off-white light, sophisticated near-black dark, restrained vermilion/red accent, Chinese brand subtle.)

**Typography**
- Primary: system sans-serif stack (same as current `--font`: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif). Clean, readable at all sizes.
- Headings: same family (do not switch to serif for headings — removes decorative contrast; keep consistent); can use slightly tighter tracking (letter-spacing: -0.01em for large headings) for precision.
- Monospace: for code/content only (console log, format examples); not for headings.
- Font sizes: 12px base, scale at 1.25 (xs/sm/base/lg/xl) — restrained, not oversized.
- Line-height: 1.5 body, 1.25 headings — readable.

**Spacing**
- 4px base unit (matches `--space-1` to `--space-6`).
- Content padding: 24px standard; card padding: 20px; inner elements: 8–16px.
- Section gaps: 32–48px between major content blocks (not 8px — gives breathing room).
- Sidebar width: 240px (expanded) / 64px (collapsed); content max-width: 720–800px (readable line length, not 760px with huge margins).

**Color Roles**
- Background (light): warm off-white `#F7F5F0` (not gradient — flat, calm). Dark: near-black `#18181B` (not blue-grey — sophisticated, not cyberpunk).
- Card / surface: `#FFFFFF` light (slightly warm, not pure white); dark: `#232326` (lifted from background).
- Text (light): `#18181B` near-black; muted: `#737373`. Dark: `#F2F0EA` (warm light); muted: `#A8A498`.
- Accent (primary): restrained vermilion `#C84A2E` (red, not bright orange; restrained, not neon). Light: `#E86A4A`; dark: `#D86040`.
- Success (correct): muted green `#3B7A5A` (not neon); wrong/danger: `#A63D2E` (slightly desaturated red).
- Border: `#D6D3CD` light / `#3A3A3C` dark — subtle, not high-contrast.
- Focus ring: accent color at 20% opacity with 2px outline; not bright glow.

**Border**
- 1px solid borders for cards and panels.
- No decorative gradient borders (remove card top stripes; replace with subtle left accent bar or no decorative element).
- Radius: 6–8px for cards (slightly less rounded than current 14px — more precise, less "friendly card"); 4px for buttons; 999px only for small badges (if any).

**Radius**
- Cards: 8px (not 14px — reduces decorative softness).
- Buttons: 4–6px (slightly rounded, not pill-shaped excessively; keep consistent with card radius).
- Inputs: 6px.
- Badges/pills: 999px acceptable ONLY for small status indicators (e.g., error count badges), not main controls.

**Shadows**
- Minimal: card shadow `0 1px 3px rgba(0,0,0,0.05)` light / `0 1px 2px rgba(0,0,0,0.3)` dark.
- No large drop shadows (current `0 10px 30px` is too decorative).
- No inset shadows on cards (remove `box-shadow: inset...` from note panel / cards).
- No shadow on buttons by default (only subtle on hover: `0 1px 2px rgba(0,0,0,0.08)`).

**Icon Strategy**
- Use a single icon family (system or minimal stroke set) — no emoji.
- Icon roles: navigation (chevrons, home), actions (import, settings, start/stop), status (correct/wrong/check/cross — can use color + small symbol, not emoji).
- Brand: "学" character can be used as a monochrome mark (not red seal with gold shadow).
- No decorative icons on cards (remove 📚 from bank items; use a simple document/study icon if needed).

**Motion**
- Minimal: fade-in for page/content load (0.2–0.3s ease); subtle slide for note/explanation panel.
- No bounce/pulse/shimmer/float decorative animations (remove `animate-pulse`, `animate-bounce`, `animate-float`, `animate-shimmer`; keep only `fadeInUp` for initial content if wanted).
- No card entrance animations per item (current `cardEnter` with 0.6s for every card — remove; static presentation is more precise).
- Reduced-motion respect: wrap animations in `@media (prefers-reduced-motion: no-preference)`.
- Transition speed: 150–200ms for hover/state changes; avoid slow 0.3–0.5s transitions (current `transition-slow: 0.5s`).

**Light / Dark Theme Principles**
- Light = warm off-white flat + near-black text + restrained red accent.
- Dark = near-black flat + warm light text + slightly brighter red accent.
- No gradient backgrounds (remove `linear-gradient` from `body::before`, `bg`, card backgrounds; use flat colors).
- No decorative patterns (remove SVG grid pattern from `body::before` in `base.css`).
- Theme toggle in top bar or sidebar, not floating circle button; persist to `localStorage`.
- Console can optionally use a darker version (if user wants lower light for long sessions), but using the SAME dark palette (not cyan/blue) — just possibly slightly lower brightness.

---

## 12. Proposed Reusable Component Inventory

Based on redesign needs (will build new components instead of patching CSS classes):

- `Sidebar` — collapsible left nav with sections/subsections; brand at top; icon + label modes.
- `TopBar` — title + breadcrumbs + actions (context-sensitive per page); minimal, not overloaded.
- `ContentArea` — main scrollable region; max-width readable; padding consistent.
- `Card` — clean surface (flat bg, 1px border, 8px radius, subtle shadow); optional left accent bar (2px accent for active/selected state); NO decorative top gradient stripe.
- `Button` — primary (solid accent), secondary (outline), subtle (text-only); 4–6px radius; no gradient; no pill unless specifically for small badges.
- `Badge` — small pill for counts/status; 999px okay; single color (accent or muted); small font.
- `Input` — clean field (6px radius, 1px border); focus with subtle ring; no inner glow.
- `QuestionCard` — question display (type label, number, text, options list); correct/incorrect state indicated with subtle border color change (not full background gradient); explanation accessible via inline panel or right drawer.
- `OptionItem` — selectable option (clean row, left indicator letter, text); selected state via accent border + light tint; correct/wrong indicated subtly.
- `ProgressIndicator` — simple linear progress (thin bar); current/total text; not 6-chip stats bar at top.
- `NotePanel` / `ContextPanel` — right-side drawer/panel for explanations, details; toggled by button; does not slide out from card edge; integrated into shell.
- `StatsPanel` — metrics display (clear typography; table or simple cards); accuracy, counts, distribution.
- `BankItem` — list item for a bank (name, count, last used); selectable; import action.
- `Modal` — proper overlay with focus trapping; explicit close button; click outside closes only when appropriate.
- `ThemeToggle` — simple button/switch; not decorative circular button with rotation.

---

## 13. Migration Strategy (Redesign Without Breaking Existing Functionality)

Strategy: keep backend (`main.py`, `server.py`, `config.py`, `yuketang_*.py`) untouched; replace frontend shell and presentation layer gradually; maintain `localStorage` data compatibility.

Phased approach (recommended):

1. **Data compatibility check** (verify): current `localStorage` keys (`quiz_questionBank`, `quiz_bankName`, `quiz_wrongRecords`, etc.) must remain readable by new UI. Keep same keys; new UI reads from `storage.js`-equivalent module.
2. **Shell redesign** (new HTML + CSS + component layer): build new page structure (`templates/` replacements) with new design system. Use same URL routes (`/`, `/quiz`, `/yuketang`) — no backend route changes.
3. **State layer preservation** (reuse): keep `state.js` logic but may namespace or wrap; `storage.js` stays (or is replaced with same-key equivalent). Ensure `loadFromLocalStorage()` and `loadProgressOnly()` work identically.
4. **Business logic reuse** (reuse JS modules): `bank-loader.js`, `answer.js`, `matching.js`, `stats.js`, `practice.js`, `navigation.js`, `question-render.js` can be reused behind new component layer — but presentation HTML they generate needs replacement. Plan: extract rendering from these modules into pure data functions (return data structures instead of HTML strings), and have new components render them.
5. **Yuketang console**: keep `yuketang.js` polling and backend interaction; redesign only `yuketang.html` shell and `yuketang.css`. Must verify `yuketang.js` selects DOM elements by ID (`$('f_classroom_id')`, etc.) — new shell must preserve those IDs or update JS accordingly.
6. **Theme / settings**: new settings page or panel; keep `quiz_theme` localStorage key; new theme system should support both light and dark with the new palette.
7. **Gradual rollout / A/B option**: since app runs locally (no server deployment), can provide both old and new shells via query param or file rename for testing. Recommend building new shell in a separate branch/directory, then switching `templates/` when verified.
8. **Testing**: run `tests/test_server.py` (67 cases) after any backend-adjacent change; verify `tests/test_yuketang_*.py`. Frontend tests not present — manual verification of: bank import, practice flow all 6 types, review/wrong book, stats, theme toggle, console start/stop, progress resume.

Key constraint: do NOT change `yuketang_core.py` / adapter / manager during UI redesign. Only `templates/`, `static/css/`, `static/js/` (presentation parts) should change. If business-logic JS needs small adjustments (e.g., to work with new component IDs), make minimal targeted changes with verification.

---

## 14. Open Questions / Conflicts Discovered

1. **Theme inconsistency (confirmed)**: `yuketang.css` defines complete independent theme (`--yk-*` blue/cyan) and remaps `--primary`/`--bg`; it does not respect user's `data-theme`. Should console follow site theme or keep independent? Product direction implies unified identity — console should probably use dark site palette (if user wants dark) rather than cyan theme. Resolution: either (a) redesign console with site theme only, or (b) keep console slightly differentiated but with same color roles (not different palette).

2. **Two full-screen overlays at same time risk**: `bankSelectScreen` (z 9999) and `importScreen` (same z) and `progressOverlay` (z 10001) — if state management has bugs, layers can overlap unexpectedly. Current code manages with `.style.display` toggles; v2 should manage visibility through a cleaner state mechanism.

3. **Legal overlay mandatory**: `hub.html` shows legal panel every load (`#legalOverlay`), requires `ackLegal()` to dismiss (stores nothing — just DOM removal with `closing` class). User can skip with `?clean`. Should v2 keep mandatory acknowledgment? Legal text must remain; design can be calmer (not full-screen, not blocking interaction with rest of site — perhaps a banner or sidebar notice instead of overlay).

4. **No settings page exists**: only theme button and hidden threshold input. Where should settings live? Sidebar item or dedicated page? Should include: theme, wrong-book threshold, practice preferences (priority new), data management (export/clear), keyboard shortcuts reference.

5. **LocalStorage isolation by origin**: progress is bound to `localhost:8000`; if port changes, progress appears lost (documented in README). This is a data architecture issue, not UI — but v2 could add an export/import mechanism or note in settings.

6. **Bottom-bar opacity design**: current opacity 0.45 with hover→1.0 is an interaction design choice that was explicitly added (likely in v1.2). Redesign should decide whether floating action bar is the right pattern — product direction suggests productivity tool with clear actions, possibly persistent toolbar instead of floating capsule.

7. **Yuketang v4-v6 CSS iterations**: `yuketang.css` contains conflicting rules (v4 dark, v4.1 light, v4.3 adjustments, v6 checkbox/flow) with `::before`/`::after` decorative elements, `overflow: hidden` on body, `padding-bottom` adjustments. Cleaning this to a clean version requires understanding which rules are active. The current file is 1150+ lines with many comments marking version iterations — redesign should start fresh, not edit incrementally.

8. **No design-token build / no CSS architecture review**: current CSS uses hardcoded gradients, shadows, and colors embedded in component rules. New system should consider whether to use CSS custom properties only (current approach is okay but needs discipline) or add a minimal build step for token extraction. Given this is a local desktop app (no deployment pipeline), keeping pure CSS with strict token discipline is acceptable.

9. **Accessibility audit not performed**: no `aria-label`, no skip links, no `prefers-reduced-motion`. Redesign should include basic a11y from start (focus management, semantic HTML, color-contrast verification, reduced-motion respect).

10. **Question**: Should the redesigned UI include a "Settings" page/section? Currently only theme + threshold exist as hidden controls. Product architecture suggests yes (under Tools or as standalone). Recommend adding Settings to sidebar and designing minimal settings panel.

---

READY FOR DESIGN REVIEW

(No files modified except this report. All inspection evidence drawn from direct file reads of templates, static/css (base/components/pages/hub/yuketang), static/js (state/storage/ui/bank-loader/bank-select/import-ui/question-render/answer/matching/practice/navigation/stats/main/yuketang), server.py, config.py, main.py, yuketang_*.py, templates/*.html, docs/screenshots/*.png references, README.md/README.en.md, CHANGELOG.md, tests/test_server.py, examples/demo-bank.json.)
