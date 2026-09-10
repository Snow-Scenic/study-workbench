# Study Workbench — UI V2 Design Specification

Status: SPECIFICATION ONLY. No application source modified. Only this file created.

---

## 1. PRODUCT POSITIONING

Study Workbench is a desktop-first personal learning productivity application.

Not: a marketing site, SaaS landing, cyberpunk dashboard, admin template, generic AI app.

It should feel like a focused native productivity tool running in a browser shell.

Design takes principles from Linear (calm hierarchy, precise spacing, low noise), Notion (comfortable reading, workspace organization), Raycast (compact productivity, keyboard-oriented, restrained effects), Vercel (typography precision, interaction clarity). Not imitating any one.

Own identity: modern neutral interface, warm off-white light / near-black dark, restrained vermilion accent, subtle Chinese "学" mark. No traditional decorative theme.

---

## 2. BRAND IDENTITY

Character: 学

Appearance: 26–30 px modern monogram. Simple square or no container. Restrained vermilion (#B94A34) accent. No gold, no gradient, no glow, no traditional border.

Chinese identity from: warm neutral colors, restrained vermilion, typography rhythm, the 学 mark — not patterns, paper textures, ink painting, gold trim, ornamental motifs.

---

## 3. FINAL INFORMATION ARCHITECTURE

Study Workbench
- Home
- Learn
  - Practice
  - Question Banks
  - Review
- Insights
  - Statistics
- Tools
  - Course Console
- Settings

No additional primary navigation items.

---

## 4. APPLICATION SHELL

Desktop-first.

Expanded sidebar: 224 px
Collapsed sidebar: 56 px
Top bar: 52 px
Desktop content padding: 32 px (compact: 24 px)

Sidebar hierarchy (expanded):
- Top: 学 (brand mark only) — Study Workbench shown below or beside, NOT duplicated
- Navigation: Home
- Section label: LEARN → Practice / Question Banks / Review
- Section label: INSIGHTS → Statistics
- Section label: TOOLS → Course Console
- Bottom: Settings

TopBar (wide/compact/narrow):
- Page title / current context (e.g., Practice / Database Systems)
- Contextual actions
- Optional utilities (theme, settings link)
- NO duplicated "学 Study Workbench" branding

Narrow layout exception: when sidebar hidden, compact 学 mark in top navigation is acceptable.

Active item: subtle neutral surface fill + stronger text/icon contrast + optional very restrained accent detail. Navigation recedes relative to content. No pill-shaped items for all links.

---

## 4B. CORE COMPONENT DIMENSIONS

These are implementation-contract dimensions. Not decorative; enforceable.

AppShell (expanded sidebar mode): sidebar 224 px, top bar 52 px, content area fills remainder.
AppShell (collapsed sidebar mode): sidebar 56 px, content shifts left.
AppShell (narrow drawer mode): full-width content with temporary overlay drawer.

Sidebar expanded: 224 px width.
Sidebar collapsed: 56 px width.
TopBar: fixed 52 px height.
SidebarItem: 32 px minimum height; full width of sidebar.
Standard Button: 36 px height.
Compact Button: 32 px height.
Prominent primary Button: up to 40 px height maximum (not larger).
IconButton: 32 × 32 px visual/control box.
Interactive desktop hit target: >= 32 × 32 px.
Narrow/touch-oriented preferred target: >= 44 × 44 px where practical (without breaking layout).
Input / Select: 36 px minimum height.
Checkbox / Radio control: 16–18 px visual size; interactive hit area >= 32 × 32 px.
Question OptionItem: minimum 48 px height; grows freely for multiline Chinese text. No fixed cap.
BankRow: minimum 52 px height.
Standard Modal: small ~400 px, medium ~520 px, large ~680 px (max-width, centered, responsive scaling).
Drawer (desktop): ~360 px width; never exceeds 90vw on narrow screens.
Practice ContextPanel (wide): 300–340 px wide, sits beside question. Not floating from card edge.
Practice readable question column: 680–760 px (primary focus region).
Course Console LogPanel: minimum usable 160 px height; collapsible/resizable concept reserved for future; visible by default in running state.
Content must never be forced into fixed-height containers that truncate Chinese text.

---

## 5. RESPONSIVE SHELL

Three modes only.

Wide (> 1200 px): expanded/collapsible sidebar; contextual right panel visible; full productivity layout.
Compact (900–1199 px): sidebar defaults 56 px collapsed; right contextual panel becomes overlay drawer; primary content centered/readable.
Narrow (< 900 px): sidebar temporary navigation drawer; one-column primary content; contextual panels become drawers or stacked; preserve all functionality.

Desktop-first. Not mobile-first.

---

## 6. TYPOGRAPHY

Offline-compatible system sans-serif stack:
-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif

Monospace only for: Course Console logs, raw format examples, technical identifiers.
No serif as primary heading font.

Scale:
11 px — micro labels only
12 px — badges, keyboard hints
13 px — secondary metadata
14 px — standard UI text
15 px — dense readable content
16 px — question body / important reading
18 px — small page section heading
20 px — page title
24 px — large Home greeting / headline maximum

No marketing giant typography. Question text prioritizes readability.

---

## 7. DESIGN TOKENS

Semantic tokens, not hard-coded.

LIGHT
- app background: #F6F5F1
- primary surface: #FCFBF8
- elevated surface: #FFFFFF
- primary text: #1E1E1B
- secondary text: #6F6D68
- border: #E2E0DA
- brand/accent: #B94A34 (restrained vermilion)

DARK
- app background: #10110F
- primary surface: #171815
- elevated surface: #1D1E1A
- primary text: #F2F0EA
- secondary text: #A09D95
- border: #2B2C27
- brand/accent: suitable accessible vermilion for dark (to be verified for contrast)

Verify semantic contrast for: body text, muted text, primary buttons, selected states, focus states, correct/wrong states. Do not rely on color alone for semantic status.

---

## 8. SPACING

4 px base grid.

Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.

Avoid arbitrary values. Major spacing calm but not empty (not a marketing page with huge whitespace).

---

## 9. RADIUS

Restrained.

Small controls: 4 px
Buttons / inputs: 6 px
Standard surfaces: 8 px
Large modal / drawer: 10–12 px max
999 px: ONLY badges, status dots, tiny chips when genuinely appropriate.

Avoid "everything is a pill". Nested radii must remain concentric.

---

## 10. BORDERS AND SHADOWS

Primary separation from: layout, whitespace, subtle surface differences, 1 px borders — not shadows.

Standard card/surface: 1 px subtle border, no shadow by default.
Elevated elements (dialog, dropdown, command palette, temporary drawer) may use restrained layered shadows.

Buttons must not have large shadows. No glowing borders. No gradient borders.

---

## 11. MOTION

Motion explains state changes, not decorates.

Timing: fast 120 ms / normal 180 ms / slow 260 ms.
Allowed properties: opacity, transform, background-color, border-color.

Avoid: bouncing, floating, perpetual pulsing, rotating theme buttons, shimmer unless genuine loading, decorative card entrance, parallax, glowing animations.
Respect prefers-reduced-motion.

---

## 12. ICON SYSTEM

One consistent thin/stroke family (Lucide preferred direction, vendored locally for offline use — do not depend on CDN at runtime).

Sizes: 16 px navigation/action, 18 px primary action, 20 px only where necessary.
No emoji interface icons. Text labels remain available where meaning not obvious.

---

## 13. HOME — FINAL DIRECTION

Home is NOT a launcher.

Strongest element: Continue Learning.

Must answer: "What should I continue doing?"

Hierarchy:
- Page greeting / context
- Continue Learning
  - current/recent question bank
  - progress
  - answered / total
  - primary Continue Practice action
- Recent Question Banks (compact list, NOT giant cards)
- Review (wrong questions requiring attention)
- Learning Snapshot (only metrics currently supported by existing app data: total answered, total correct, current stats — do NOT invent unsupported historical trends)
- Course Console (small secondary entry under Tools / Recent Activity)

No dashboard of 8–12 statistic cards. No invented historical data.

Empty home state when no bank imported: calm empty state with Import action, no decorative illustration required (can use simple icon + text).

---

## 14. PRACTICE — HIGHEST PRIORITY PAGE

Attention hierarchy must be:
1. Question
2. Answer choices / interaction
3. Answer feedback
4. Explanation
5. Progress / context
6. Navigation / utilities

Stat/navigation/decor must not compete with question.

Wide desktop layout:
- Main readable question region: ~680–760 px
- Optional contextual panel: ~300–340 px
- Overall workspace uses wider available screen

Top page context compact: bank name, section/category, position, simple progress. No 6-stat-chip header.

Question Navigator: deliberate button (not permanently expanded right-edge hover sidebar). Opening shows drawer/panel with question grid/list, correct/wrong/unanswered states, explicit legend.

Explanation: wide screens = optional right Context Panel; compact = drawer; narrow = stacked below or drawer.

Primary answer actions close to question flow. No translucent floating bottom pill. Restrained sticky action region inside Practice workspace acceptable when needed.

Preserve keyboard interaction conceptually (digit selection, arrow navigation, submit).

---

## 15. QUESTION BANKS

Productivity LIST view, not gallery of large cards.

Row content: name, question count if available, progress if available, concise secondary status, context menu/action.

Primary page action: Import Question Bank.

States: empty, populated, import error, resumable progress.
No invented "last studied 2 hours ago" unless app actually stores that.

---

## 16. REVIEW

Promotes existing wrong-question functionality to first-class destination.

Use existing concepts: wrong count, consecutive correct count, removal threshold, filtered review.
Provide clear filters.
Avoid excessive badges.
Primary action: Start Review.
Page explains why questions appear here without requiring tooltip.

---

## 17. STATISTICS

Only around metrics repository supports (total answered, total correct, session statistics, wrong counts, accuracy).

Avoid pretending rich historical trend data exists.

Prefer: 2–4 important metrics, one simple visual distribution if data supports, clear table/list for mistake patterns. No business analytics dashboard.

---

## 18. COURSE CONSOLE

More technical feel than Practice, but same product.

Keep same: sidebar, top bar, typography, spacing, semantic colors, component family.

Do NOT restore: cyan cyberpunk palette, HUD, laser timeline, background grid, neon glow, glass everywhere.

Wide structure: header/context → course setup or active execution → main workspace (left = timeline/tasks, right = execution/status) → logs (collapsible/resizable lower region or clearly separated technical panel).

Use monospace for logs only. Status states must include text/symbol in addition to color.

---

## 19. SETTINGS

Real navigation destination.

Version 1 includes only real current functionality or necessary product info:

Appearance: Light / Dark
Note: System option is NOT enabled in V1 because current application only supports Light/Dark via base.css theme toggle. System may be added as a future enhancement only when actual system-theme detection is implemented. Do NOT render System as an enabled selectable option without that behavior.
Practice: wrong-question removal threshold, existing practice preference where appropriate
Keyboard: shortcut reference
About / Legal: legal/disclaimer content, application info

No speculative account/cloud/team features.

---

## 20. LEGAL ACKNOWLEDGEMENT

Existing legal acknowledgement semantics preserved.

Visual presentation may be redesigned, but do not silently convert required acknowledgment into a dismissible informational banner without separate authorization.

---

## 21. COMPONENT INVENTORY (Specifications)

For each important component, specify purpose, size, visual states, interaction states, accessibility behavior, responsive behavior.

Required specification coverage for:

AppShell | Sidebar | SidebarItem | TopBar | PageHeader | Button | IconButton | Input | Select | Checkbox | Radio | Badge | Progress | QuestionView | OptionItem | MatchingInteraction | FeedbackMessage | ContextPanel | Drawer | Modal/Dialog | BankRow | Metric | FilterControl | EmptyState | ErrorState | LoadingState | Toast | CourseTimeline | CourseTaskRow | LogPanel | ThemeControl

---

## 21B. COMPONENT CONTRACTS (Implementation-Ready)

AppShell — Purpose: root container. Expanded sidebar mode: sidebar 224 px + top bar 52 px + content area. Collapsed: sidebar 56 px. Narrow: full-width content with temporary drawer. States: expanded / collapsed / narrow-drawer-open / light / dark. Focus: not applicable (layout only). Accessibility: landmark roles header/main/aside/navigation. Responsive: switches layout based on viewport (wide >1200, compact 900–1199, narrow <900). Keyboard: no direct interaction; focus must route correctly through regions.

Sidebar — Purpose: navigation region. Default width 224 px (expanded), 56 px (collapsed). States: expanded / collapsed. Focus-visible: visible indicator on focus. Disabled: not applicable. Responsive: collapses to 56 px in compact; becomes temporary overlay in narrow. Accessibility: navigation landmark; each item has accessible label. Keyboard: Tab / Shift+Tab through items; Enter activates. Arrow-key behavior not required for standard navigation links.

SidebarItem — Purpose: individual nav link. Size: 32 px minimum height, full sidebar width. States: default / hover / active / focus-visible. Hover: subtle surface tint. Active: stronger text/icon, optional restrained accent bar (not full pill). Focus-visible: 2 px outline with accent at 20% opacity. Disabled: reduced opacity but text must remain readable (>3:1). Responsive: same behavior at 224 px and 56 px (label hidden in collapsed, icon remains). Accessibility: aria-current="page" when active; text label hidden visually in collapsed mode but available to screen readers.

TopBar — Purpose: current context + actions. Height: 52 px. States: default / compact (same). Focus-visible: visible ring on focusable children. No hover-only actions. Responsive: consistent at all widths; may hide less-important utilities in narrow mode (show hamburger). Accessibility: banner/header role; page title as heading.

PageHeader — Purpose: page-level title + subtitle. Size: flexible height based on content (min ~40 px); page title 20 px, subtitle 14 px. States: default only. Focus-visible: not primary interactive region. Accessibility: heading hierarchy preserved (h1 at page level, not duplicated in sidebar).

Button — Variants: Primary / Secondary / Ghost / Danger. Size: standard 36 px height, compact 32 px, prominent up to 40 px max. Radius 6 px. States: default / hover / active/pressed / focus-visible / disabled / loading. Default: no gradient, no shadow. Hover: subtle background shift; no glow. Active/pressed: slightly darker; no scale bounce. Focus-visible: visible ring (2 px outline, accent color at 20%). Disabled: distinguishable but text readable (>3:1 against surface); no opacity-only fade to invisible. Loading: preserve width; show loading indicator (spinner/dot); prevent duplicate submission; accessible live region announces "processing" or equivalent. Responsive: same dimensions; stack vertically only when space genuinely insufficient. Accessibility: button element, accessible name from text or aria-label.

IconButton — Purpose: icon-only actions (Question Navigator, Theme, Close, More actions). Size: 32 × 32 px control box. States: default / hover / active / focus-visible / disabled. Hover: subtle surface tint. Focus-visible: visible ring. Disabled: visible enough to recognize control; accessible name required (aria-label). Responsive: same box size; never shrink below 32 × 32 px touch target. Accessibility: aria-label mandatory; tooltip when meaning not universally obvious; tooltip shows on keyboard focus as well as hover.

Input — Purpose: text entry. Size: min 36 px height, 6 px radius. States: default / hover / focus-visible / filled / error. Default: 1 px border. Focus-visible: 2 px outline in accent; no inner glow. Error: border color change + error text below; not color-only. Disabled: reduced but readable. Responsive: full width in narrow; may shrink to compact width (min 200 px) in wide layouts. Accessibility: associated label; error message programmatically linked (aria-describedby or similar).

Select — Purpose: dropdown selection. Size: same as Input (36 px height, 6 px radius). States: default / open / focused / disabled / error. Focus-visible: visible ring. Disabled: distinguishable but readable. Responsive: same as Input. Accessibility: labeled; options readable; keyboard open/close/navigate/select; no mouse-only interaction.

Checkbox — Purpose: binary choice (threshold toggle, preference). Visual control: 16–18 px; interactive hit area >= 32 × 32 px. States: default / hover / checked / indeterminate (if needed) / focus-visible / disabled / error. Hover: subtle tint. Checked: accent fill + white check; border visible. Focus-visible: visible ring. Disabled: visible but muted; readable. Error: border change + error text. Responsive: same behavior. Accessibility: native input preferred; label associated; keyboard togglable (Space).

Radio — Same pattern as Checkbox except only one selected in group. Size: 16–18 px visual; >= 32 × 32 px hit. States: default / selected / focus-visible / disabled / error. Accessibility: group label; keyboard arrow navigation.

Badge — Purpose: small status/count indicator. Size: small pill; 999 px radius allowed ONLY for badges; height ~20–24 px; font 11–12 px. States: default / selected / error / info. No decorative animation (no pulse). Responsive: scales slightly with text; never overflows container. Accessibility: text label or aria-label; never icon-only semantic status.

Progress — Purpose: linear progress indicator. Thin line (~4 px thick), full container width. States: empty / partial / complete. No gradient fill (solid subtle color acceptable). Responsive: same width behavior. Accessibility: aria-valuenow / aria-valuemin / aria-valuemax or aria-label with current/total.

QuestionView — Purpose: displays current question. Default: card surface with 1 px border, 8 px radius, readable column ~680–760 px centered. States: unanswered / correct / wrong / finished. Unanswered: neutral surface, focus on options. Correct: subtle success indicator (check + text) + green border; color not only cue. Wrong: subtle wrong indicator (text + symbol) + red-tinted border; explanation available/auto-shown depending on design. Focus-visible: question card does not steal focus; focus on interactive children. Responsive: full width in narrow (<900); centered readable column in wide. Accessibility: heading or region for question text; options as list items; status announced to assistive tech.

OptionItem — Purpose: selectable answer option. Size: min 48 px height; full width of option container; 6 px radius container; inner padding 12 px. States: default / hover / selected / submitted-correct / submitted-wrong / correct-answer-revealed / disabled/locked-after-answer. Default: neutral surface; letter indicator (A/B/C...) in muted color; text readable. Hover: subtle background shift; letter slightly stronger. Selected: accent border + light tint; letter stronger. Submitted-correct: green symbol + text + green-tinted surface; green is NOT the only cue. Submitted-wrong: wrong indicator + text + red-tinted surface; wrong is NOT the only cue. Disabled after answer: visually distinct but readable; keyboard still navigable but selection blocked. Responsive: stacks naturally in narrow mode; same height rules apply. Accessibility: selectable state announced; correct/wrong announced via text/symbol, not only color; keyboard selectable (number keys for single choice, arrow/tab for navigation, submit for multi).

MatchingInteraction — Purpose: matching (click-to-pair) interaction. Size: pairs of items shown clearly; each item min 48 px; container gap >= 16 px. States: unpaired / selected-left / selected-right / paired / submitted-correct / submitted-wrong / disabled-after-submission. Never drag-only. Click selects; second click pairs; click paired item unpairs. Submit button appears when pairing complete. After submit: pairs marked correct (green) or wrong (red) with text/symbol; not color-only. Disabled: after submission, interaction blocked; keyboard accessible as review. Responsive: left/right columns stack vertically in narrow mode (<600). Accessibility: each item has accessible label; pairing action described; submit required; results announced.

FeedbackMessage — Purpose: shows correct/wrong result after submission. Size: flexible width inside content area, padding 16 px, 6 px radius, border-left 3 px accent. States: correct / wrong. Correct: check symbol + "Correct" message + green-tinted surface. Wrong: error message + correct answer revealed + explanation link + red-tinted surface. Never relies on color only (symbol + text always present). Responsive: same behavior; does not overlap content unexpectedly. Accessibility: status change announced (live region concept); explanation link keyboard-accessible.

ContextPanel — Purpose: right-side explanation/detail panel (wide). Size: 300–340 px wide. States: hidden / visible / explanation-loaded / empty. Hidden: opacity 0, not interactive. Visible: slides in smoothly; contains explanation, memo, translation where data exists. Empty: shows nothing or calm placeholder; does not display empty sections. Focus: non-modal (does not trap focus); background remains interactive; when programmatically focused, closing restores focus to trigger; Escape may close. Responsive: on compact becomes Drawer; on narrow becomes stacked region or drawer. Never overlaps sidebar/navigation. Accessibility: region with label; focus management; close button accessible.

Drawer — Purpose: temporary overlay content (navigation, filters, navigator). Size: desktop ~360 px; narrow <= 90vw. States: open / closing / hidden. Open: slides in; background interaction inert (modal-like) unless explicitly non-modal; close button visible. Closing: smooth transition. Hidden: not interactive; focus restored to trigger. Focus: when open, focus moves inside; Tab cycles inside; Escape closes; focus returns to trigger on close. Responsive: same behavior scaled; may become full-width overlay in very narrow mode. Accessibility: overlay drawer uses native dialog semantics (dialog role; aria-modal when modal); navigation drawer uses native navigation semantics (<nav>); labeled; focus management; keyboard close; close button aria-label; focus restoration.

Modal/Dialog — Purpose: important decision/confirmation/display. Size: small ~400 px, medium ~520 px, large ~680 px (max-width, centered, responsive). States: open / closing / hidden. Open: background inert; focus moves inside; trap Tab; Escape closes (unless acknowledgment requires explicit action). Focus-visible: visible ring on interactive elements inside. Disabled: primary safe action preferred initially for destructive confirmations. Responsive: scales with vw/max-width; padding preserved; never overflows viewport. Accessibility: dialog role; aria-modal; title; focus management; focus restoration.

BankRow — Purpose: list item for a bank. Size: min 52 px height. States: default / hover / selected / resumable-progress-indicated. Default: name, count, status. Hover: subtle lift; no shadow explosion. Selected: accent border or stronger surface; action clear. Responsive: full width; text does not truncate meaninglessly; action menu collapsible if needed. Accessibility: row role with label; actions keyboard-accessible; resumable progress clearly indicated.

Metric — Purpose: single number/statistic display. Size: flexible based on context; text 20–24 px for primary metric, 14 px label below. States: default / emphasized. Never decorative animation. Responsive: scales with container. Accessibility: number accessible as text; label present.

FilterControl — Purpose: filter selection (e.g., wrong count filter). Size: compact row; buttons or dropdown. States: default / active / disabled. Active: clear selected state; not ambiguous. Responsive: wraps if multiple filters; never overlaps content unexpectedly. Accessibility: filter label; selected state announced; keyboard selectable.

EmptyState — Purpose: no content available. Size: centered within content region; calm message; valid next action (e.g., Import, Start Practice); icon only if helpful (no emoji). States: bank-empty / review-empty / stats-empty / navigator-empty. Never dead-end. Responsive: same calm presentation; does not dominate entire viewport. Accessibility: message readable; next action clearly labeled.

ErrorState — Purpose: something failed. Size: message region; preserves user-entered data where practical; error message specific; retry/recovery action available. States: import-error / load-error / submit-error. Never generic only; describe failure where possible. Responsive: same behavior; message readable; recovery action visible. Accessibility: error message announced (live region); recovery action keyboard-accessible.

LoadingState — Purpose: data being fetched/processed. Size: matches expected content layout (avoid layout shift). States: initial / processing / complete. Processing: compact indicator (not persistent shimmer); no bounce; no decorative animation. If content structure known, use skeleton matching content layout; otherwise use compact centered indicator. Responsive: same. Accessibility: status announced; not interactive during load.

Toast — Purpose: transient non-blocking feedback (bank saved, setting updated, copy succeeded, import completed). Size: small floating region; appears briefly; auto-dismisses or requires acknowledgment only for important actions. States: info / success / error. Never the ONLY place important information exists; important messages must also appear in content/page. Does NOT overlap action region; positioned away from top bar and sidebar; does not block interaction. Accessibility: announced briefly via live region; does not steal focus from user task; dismissible if acknowledgment needed. Responsive: positioned safely; does not overlap bottom sticky regions in unreadable way.

CourseTimeline — Purpose: task timeline display. Size: vertical list; each node ~32–36 px; timeline track ~4 px wide. States: node completed / running / queued / skipped / failed / stopped. Each state uses text + symbol + color (not color only); running node has subtle pulse only if genuine live process (optional, restrained); completed nodes show check; failed show error symbol; skipped show skip symbol. Focus-visible: nodes may be selectable/reviewable. Responsive: vertical list always (not horizontal); scrollable if long; does not break layout. Accessibility: state announced; text labels; semantic list/region structure (not a non-standard timeline role).

CourseTaskRow — Purpose: individual task/item in execution view. Size: min 48 px row; name + kind + progress % + bar. States: running / completed / failed / stopped / queued. Progress bar: thin (~6 px), solid fill, no gradient glow; percentage text always visible. Status symbol + text always present. Responsive: same row layout; does not overlap timeline; text readable. Accessibility: progress announced via aria-valuenow or label.

LogPanel — Purpose: technical log display in console. Size: min usable height 160 px; collapsible/resizable concept reserved; visible by default in running state. Font: monospace; 12–13 px text; line-height 1.6. States: visible / collapsed / empty. Empty: calm placeholder message ("No logs yet — analysis starts soon"). Responsive: collapsible to header only; does not overlap timeline. Accessibility: logs are technical; region labeled; new lines not continuously announced (would overwhelm); important events maybe summarized elsewhere.

ThemeControl — Purpose: theme selection. Size: compact row/item (Light / Dark / System placeholder). States: selected / unselected / disabled. Selected: clear indicator (not ambiguous). System option: must NOT be presented as enabled unless system-theme behavior is actually implemented. If not implemented, show as disabled or future item, clearly labeled. Responsive: same. Accessibility: group label; selected state announced; keyboard selectable.

---

## 21C. BUTTON CONTRACT

Major variants only: Primary / Secondary / Ghost / Danger.

Primary: reserved for the strongest action in the current region. Do NOT place multiple equally dominant Primary buttons adjacent unless the workflow genuinely requires equal actions (rare). No gradients. No large shadows. No pill radius.

Secondary: subordinate action; outline or subtle filled style; never competes with Primary.

Ghost: text-only or minimal outline; used for low-priority actions (e.g., secondary filter); never the only primary action.

Danger: reserved for destructive actions only (delete, reset, clear). Visually distinct (accent in danger tone, not just red); must have confirmation or recovery path.

Loading state: preserve width where possible; show loading indicator (spinner/dot); prevent duplicate submission; accessible live region announces "processing" or equivalent; disabled visually while maintaining readability.

Disabled: distinguishable from default; text must remain readable (>3:1); never rely only on opacity reduction to near-invisibility.

---

## 21D. ICONBUTTON CONTRACT

Purpose: icon-only actions (Question Navigator, Theme, Close, More actions).

Size: 32 × 32 px minimum control box; never shrink below 32 × 32 px touch target.

States: default / hover (subtle surface tint) / active/pressed (slightly darker) / focus-visible (visible ring) / disabled (visible but muted; readable name required).

Accessibility: aria-label mandatory; tooltip when meaning not universally obvious; tooltip visible on keyboard focus (not hover-only); no emoji; accessible name available at all times.

Responsive: same 32 × 32 px minimum at all widths.

---

## 21E. PRACTICE OPTION CONTRACT

States: default / hover / keyboard focus / selected / submitted-correct / submitted-wrong / correct-answer-revealed / disabled/locked-after-answer.

Default: neutral surface; letter indicator (A/B/C...) in muted color; text readable; 48 px minimum height; full width of container.

Hover: subtle background shift; letter stronger; no glow.

Keyboard focus: visible focus-visible ring (not hidden by sticky elements).

Selected: accent border + light tint; letter stronger; clear selected indicator.

Submitted-correct: check symbol + "Correct" message/text + green-tinted surface; green is NEVER the only cue — symbol + text always present.

Submitted-wrong: wrong symbol + error message/text + red-tinted surface + correct answer revealed; wrong is NEVER the only cue.

Correct-answer-revealed (after wrong): correct option clearly marked; explanation available; user may review but cannot change answer.

Disabled/locked-after-answer: visually distinct (subtle muted state); keyboard navigable for review; selection blocked; no hidden interaction.

Keyboard: single choice — number keys select existing options (preserve current behavior); arrow/tab navigates; submit activates (multi). Multi — toggle options with number/Space; Submit activates. Matching — never drag-only; click selects; second click pairs; click paired unpairs; Submit activates; keyboard accessible review.

Responsive: stacks naturally in narrow; minimum 48 px height preserved; text never truncated meaninglessly.

Accessibility: selectable state announced; correct/wrong announced via text + symbol (not only color); keyboard selectable and navigable.

---

21F. QUESTION NAVIGATOR — FIXED DESIGN

Fixed per instruction G.

Wide layout: Question Navigator is a DELIBERATE button-triggered ContextPanel/Drawer on the right side. The Practice question workspace remains fully visible. Navigator does NOT replace the workspace.

Structure (wide):
| Sidebar | Question Workspace (680–760 px) | Question Navigator (300–340 px context/drawer) |

Navigator contents:
- Section/category context (if useful) — small, not dominant
- Question number grid / list
- Current question clearly highlighted
- States shown with symbol + text + restrained color (not color-only): correct (check), wrong (cross), unanswered (dash/empty), current (accent indicator)
- Explicit legend text (e.g., "✓ Correct  ✗ Wrong  — Unanswered")
- Close button (clear label: "Close Navigator")
- Escape closes; focus returns to trigger button

Compact (900–1199): Navigator becomes overlay Drawer (~360 px); question remains visible behind (not hidden); background interaction inert when open.

Narrow (<900): Navigator becomes overlay Drawer; may become full-width; question remains in background; close control visible; focus trapped inside drawer until closed; focus returns to trigger.

Opening/closing: must not destroy question state. Must not lose selected/unselected/answered state. Must not reload question content. Must be smooth transition; must respect prefers-reduced-motion (no decorative slide explosion).

---

21G. PRACTICE WRONG + EXPLANATION — FIXED WIREFRAME

Fixed per instruction H.

Wide answered/wrong state clearly demonstrates:

| Sidebar | Question / Feedback (dominant) | Explanation ContextPanel (300–340 px) |

Question remains dominant. Explanation panel appears beside (not inside/replacing card). Explanation contains only sections with existing data: Explanation (analysis), Memo, Translation. Empty sections must NOT be shown (no empty headings, no placeholder sections).

Content hierarchy in panel:
- Section label: Explanation (if analysis exists)
- Section label: Memo (if memo exists)
- Section label: Translation (if q_trans exists)

Feedback (FeedbackMessage component): appears in content area, not overlapping explanation. Uses symbol + text + tinted surface; never color-only. Contains correct message or wrong message with correct answer revealed and explanation link/button.

Compact: ContextPanel becomes Drawer (overlay, ~360 px desktop, <=90vw narrow). Explanation content same; only container changes.

Narrow: explanation may become drawer or clearly separated stacked region below feedback; never ambiguous; never hidden without user action; close control always present.

---

---

## 22. INTERACTION AND ACCESSIBILITY CONTRACT (Testable Requirements)

Baseline: WCAG 2.2 AA for redesigned UI.

Text contrast: normal text >= 4.5:1; large text >= 3:1.
UI states must not rely on color alone.

Keyboard:
- All important flows operable via keyboard (Tab, Shift+Tab, Enter, Space, Arrow, Escape, number keys for single-choice options).
- Focus never hidden behind sticky TopBar, sticky Practice action region, drawer, or overlay.
- Focus-visible visible on all keyboard-operable controls.
- Semantic HTML landmarks (header, main, navigation, aside, region, dialog, button, list, label).
- Icon-only buttons have accessible names (aria-label).
- Modal: focus trapped; Escape closes (unless acknowledgment requires explicit action); focus restored to trigger on close.
- Drawer: focus trapped or managed appropriately; Escape closes; focus restored to trigger on close.
- No interaction depends only on hover.
- prefers-reduced-motion: motion uses reduced-motion when user preference set; no perpetual decorative animation.
- Empty/loading/error/success states exist for all relevant components.
- Destructive actions visually and semantically distinct; confirmation preferred.
- No dead-end screens.

Touch: secondary; interactions must work without hover.

Accessibility testing baseline (must pass before implementation accepted):
1. All interactive elements keyboard-reachable.
2. Focus-visible ring visible on every keyboard-operable control.
3. No semantic status (correct/wrong/selected/current) expressed by color alone; symbol + text always present.
4. IconButton aria-label present for all icon-only actions.
5. Modal focus trapping works; Escape closes non-mandatory dialogs; focus returns to trigger.
6. Drawer focus management works; close control exists; focus returns to trigger.
7. prefers-reduced-motion disables non-functional motion.
8. Empty, loading, error, success states defined and visible for Practice / Banks / Review / Stats / Console.
9. Disabled buttons/text readable (>3:1); disabled state distinguishable without opacity-only fade to invisible.
10. Legal acknowledgment semantics preserved; acknowledgment behavior preserved per Section 20.

---

## 22M. MODAL / DIALOG CONTRACT

When open:
- Background interaction becomes inert (inert overlay or inert background).
- Focus moves into dialog.
- Tab / Shift+Tab cycle inside dialog (focus trap).
- Escape closes when dismissal permitted.
- Explicit Close / Cancel / Primary control exists.
- Dialog has accessible title (aria-labelledby or aria-label).
- Focus-visible visible on all interactive elements inside.

Destructive confirmation: initial focus favors safe/non-destructive action; destructive action requires explicit selection.

When closed:
- Focus restored to element that triggered dialog.
- No state lost (user-entered content preserved where practical).

Size: small ~400 px, medium ~520 px, large ~680 px (max-width, centered, responsive with viewport max-width and padding).

Accessibility: dialog role; aria-modal; labeled title; focus management; focus restoration; keyboard close where permitted.

---

## 22N. DRAWER CONTRACT

Two conceptual drawer types:

ContextPanel (wide non-modal):
- Persistent secondary content beside main workspace (e.g., explanation panel in Practice wide layout).
- Does NOT trap focus; background content remains fully interactive.
- Normal document focus order preserved; user may Tab between ContextPanel content and main workspace content freely.
- If opening programmatically moves focus into panel (optional), closing must restore focus to the trigger control.
- Close button visible; Escape may close; focus returns to trigger on close.
- Content: explanation sections shown only when data exists; no empty placeholder sections.

Accessibility: labeled region (not a focus trap); close button has accessible label; focus restoration to trigger when programmatically focused; background content remains interactive at all times.

Overlay Drawer (temporary):
- Used in compact/narrow for Question Navigator, filters, temporary panels.
- Open: slides in; background interaction inert; close button visible; focus moves inside; Tab cycles inside; Escape closes; focus returns to trigger.
- Hidden: not interactive; focus restored.
- Size: desktop ~360 px; narrow <= 90vw.
- Responsive: same focus rules at all sizes.

Accessibility: labeled region (drawer or dialog semantics as appropriate); focus management; keyboard close; close button aria-label; focus restoration.

---

## 23. COPYWRITING

Concise product language.

Prefer "Import Question Bank" over vague "Continue" when action requires specific result.

Chinese UI likely primary locale; internal component names can remain English.

No mixed terminology for the same concept.

Terminology table:
- Question Bank
- Practice
- Review
- Statistics
- Course Console
- Settings
- Explanation
- Progress

---

## 24. REQUIRED WIREFRAMES (ASCII Structural)

Inside this document, structural wireframes (not decorative art):

1. Home — populated
2. Home — empty
3. Practice — unanswered
4. Practice — answered/wrong + explanation
5. Question Navigator open
6. Question Banks
7. Review
8. Statistics
9. Course Console — setup
10. Course Console — running
11. Settings
12. Legal acknowledgement
13. Narrow/compact Practice layout

Each clearly labels visual hierarchy and regions: sidebar / top bar / content / context panel / action region.

---

## 25. STATE MATRIX (Populated Tables)

HOME — no bank: Main visual focus = welcome/empty message + Import action. Primary action = Import Question Bank. Secondary action = Format guide / About. Error/recovery = none; next step = import or view format guide. No dead-end.

HOME — active bank: Main visual focus = Continue Learning. Primary action = Continue Practice (current/recent bank, progress, answered/total). Secondary actions = Recent Question Banks list, Review (wrong count), Learning Snapshot, Course Console entry. Error/recovery = none expected; next step = practice or review.

PRACTICE — not started: Main visual focus = start region. Primary action = Start Practice. Secondary = Question Navigator (closed by default), progress context. Error/recovery = none; next step = begin.

PRACTICE — unanswered: Main visual focus = question card. Primary action = select option / submit multi / pair matching. Secondary = Question Navigator button, next/previous (if applicable). Error/recovery = invalid selection prevented by UI; next step = answer or navigate.

PRACTICE — selected (multi before submit): Main visual focus = selected options + Submit button. Primary action = Submit. Secondary = change selection. Next step = submit.

PRACTICE — correct: Main visual focus = feedback success + explanation available. Primary action = Next (or view explanation). Secondary = open explanation / previous. Next step = continue practice or review explanation.

PRACTICE — wrong: Main visual focus = feedback wrong + correct answer revealed + explanation (auto-shown or available). Primary action = view explanation / Next. Secondary = previous. Next step = review explanation, then continue.

PRACTICE — explanation open: Main visual focus = explanation panel content + question still visible. Primary action = close explanation / continue. Secondary = navigate previous. Next step = close panel or proceed.

PRACTICE — finished: Main visual focus = finish card (completion message, metrics). Primary action = restart practice / review wrong / return to banks. Secondary = none critical. Next step = decide next practice/review.

QUESTION BANKS — loading: Main visual focus = loading indicator. Primary/secondary = none interactive; wait. Recovery = automatic retry or user refresh.

QUESTION BANKS — empty: Main visual focus = empty message + import action. Primary action = Import Question Bank. Secondary = format guide. Next step = import.

QUESTION BANKS — populated: Main visual focus = bank list. Primary action per row = select/practice; page-level = Import. Secondary = context menu. Next step = select bank.

QUESTION BANKS — import error: Main visual focus = error message. Primary action = retry / select different file. Secondary = format guide. Recovery = preserve selected file if practical; show specific error message (not generic only).

QUESTION BANKS — resumable progress: Main visual focus = bank with resume option. Primary action = Continue (resume) or Restart. Secondary = select other. Next step = confirm resume/restart.

REVIEW — empty: Main visual focus = empty message. Primary action = practice or import. Secondary = settings (threshold). Next step = generate review questions (requires existing wrong records).

REVIEW — populated: Main visual focus = filtered wrong questions + Start Review. Primary action = Start Review (with filter selection). Secondary = change filter. Next step = start review session.

REVIEW — filtered: Main visual focus = filtered question set ready. Primary action = Start Review / adjust filter. Secondary = none critical. Next step = begin.

REVIEW — completed: Main visual focus = review complete message + metrics. Primary action = restart review / return to practice. Secondary = settings (threshold). Next step = continue learning.

STATISTICS — no data: Main visual focus = calm empty state + explanation. Primary action = practice (generate data). Secondary = settings. No dead-end.

STATISTICS — data available: Main visual focus = metrics (2–4 important values) + simple distribution/table. Primary action = none required (informational); user may return to practice/review. Secondary = settings (threshold). No invented historical trend charts.

COURSE CONSOLE — idle: Main visual focus = parameter setup form + side instructions. Primary action = Analyze Course. Secondary = Fill Demo Parameters. Next step = analyze.

COURSE CONSOLE — analyzing: Main visual focus = scanning ring / progress indicator. Primary/secondary = none (wait). Next step = ready state.

COURSE CONSOLE — ready: Main visual focus = timeline/tasks + start action. Primary action = Start Execution. Secondary = reset/reconfigure. Next step = start.

COURSE CONSOLE — running: Main visual focus = current task + progress + timeline + live logs. Primary action = Stop (if user needs stop) / wait. Secondary = view timeline / logs. Next step = continue or stop.

COURSE CONSOLE — stopped: Main visual focus = stopped message + timeline state. Primary action = reconfigure / reset. Secondary = restart same. Next step = reset or new course.

COURSE CONSOLE — finished: Main visual focus = finished summary + timeline completed. Primary action = reconfigure (next course). Secondary = reset. Next step = new setup.

COURSE CONSOLE — error: Main visual focus = error message + status. Primary action = reset / reconfigure. Secondary = review logs. Next step = fix parameters or reset.

GLOBAL — modal open: Main visual focus = dialog content. Background inert. Primary action = confirm/cancel/close. Secondary = close via close button or Escape (when permitted). Focus trapped inside. Next step = complete action or cancel.

GLOBAL — legal acknowledgement open: Main visual focus = acknowledgment content. Background inert. Primary action = explicit Acknowledge and Proceed (not dismissible via Escape or backdrop click per Section 20). Secondary = none (required). Next step = proceed to hub.

GLOBAL — context panel open (wide): Main visual focus = context content beside question. Question remains fully visible. Primary action = use panel / close. Secondary = navigate question. Focus: when open, focus may move inside panel (optional management); close returns to trigger. Next step = review explanation or close.

GLOBAL — overlay drawer open: Main visual focus = drawer content; background inert; focus inside. Primary action = complete drawer action / close. Secondary = cancel/close. Next step = close and return to trigger.

GLOBAL — light theme: All light theme tokens active.
GLOBAL — dark theme: All dark theme tokens active; console follows same theme (not cyan).
GLOBAL — expanded sidebar: sidebar 224 px visible.
GLOBAL — collapsed sidebar: sidebar 56 px; labels hidden; icons visible.
GLOBAL — narrow navigation open: sidebar hidden; temporary overlay navigation drawer open; focus inside drawer; close returns to trigger; background interaction inert.

---

## 25P. LOADING / ERROR / EMPTY / SUCCESS CONTRACTS

Shared rules for all pages/components.

Loading state:
- Preserve layout structure where practical (avoid layout shift when content loads).
- Do NOT use decorative shimmer (no shimmer animation) unless genuine background loading.
- Use compact centered indicator or skeleton only when skeleton matches actual content layout.
- If long process (course analysis/execution), show progress indicator (not just generic spinner) where data supports it.
- Not interactive during load (input disabled, submit blocked).
- Status announced briefly (loading region); not continuously announced (would overwhelm).
- Reduced-motion: indicator stops or simplifies if prefers-reduced-motion set.

Empty state:
- Must explain what is absent (calm message, not technical error).
- Must provide a valid next action (e.g., Import, Practice, Settings, Format Guide).
- Not a dead-end screen.
- Icon optional; no emoji. No decorative large illustration required.
- Responsive: centered within content region; does not dominate entire viewport.
- Accessibility: message readable; next action clearly labeled.

Error state:
- Must describe what failed (specific when possible, not generic "Something went wrong" only).
- Must preserve user-entered data where practical (file selection preserved, parameters preserved, selection preserved).
- Must provide retry/recovery action (Retry, Reconfigure, Clear, Import Different File, Reset).
- Never hide the error behind ambiguous styling; error message visible in content region; not only color change.
- Responsive: message readable; recovery action visible; does not overlap sticky elements in unreadable way.
- Accessibility: error message announced (live region); recovery action keyboard-accessible.

Success state:
- Not over-celebrated (no bounce, no glow, no decorative animation).
- Confirm action completed (message visible briefly; for persistent results, show within content, not transient only).
- Toast acceptable for transient success (saved, updated); persistent success should appear in content (e.g., bank imported, practice completed).
- If Toast used: does not steal focus; brief; positioned away from top bar/sidebar; dismissible; not only location of important info.

Destructive action (Danger button / destructive confirmation):
- Visually distinct (danger tone, not only red; clear label).
- Confirmation preferred (Modal with safe default focus; destructive requires explicit selection).
- Recovery path available (Cancel, Undo if practical, confirmation before proceed).

---

## 26. FRAMEWORK

Not selected in this specification. Conceptual component descriptions only. Framework decision after UI design approval.

---

## 27. DESIGN CONTRACT SUMMARY (For Implementation)

Visual identity: calm, precise, warm neutral, restrained vermilion, subtle 学. No decorative themes.
Shell: sidebar (224/56) + top bar (52) + content (32 px padding). Three responsive modes.
Colors: semantic tokens for light/dark. Verify contrast; do not rely on color alone.
Typography: system sans-serif. No serif headings. No CDN fonts required (offline).
Components: 31 specified components with states and accessibility requirements.
Pages: 7 primary (Home, Practice, Banks, Review, Stats, Console, Settings) plus Legal.
Motion: minimal, functional, 120/180/260 ms, respects reduced-motion.
Icons: Lucide-style thin stroke, local, no emoji.
Accessibility: full contract specified — keyboard, focus, landmarks, names, reduced-motion, empty/loading/error states, no hover-only interactions.

All existing functionality preserved (6 types, wrong book, statistics, explanations, import/format, progress persistence, console execution, keyboard shortcuts, theme, legal acknowledgment).

Migration: backend untouched; presentation rebuilt; state/storage reused; new shell around same routes.

---

## STRUCTURAL WIREFRAMES (ASCII)

### 1. Home — Populated
```
+--------------------------------------------------+
| Home                    [theme] [settings]           <- Top bar (52px, no duplicated brand)
+--------------------------------------------------+
|        |                                         |
|  Nav   |  Page greeting / context                 |
|  Home  |                                         |
|  Learn > Practice  |  Continue Learning          |
|      > Banks     |  [Bank name]  42/50 done     |
|      > Review    |  [Continue Practice]          |
|  Insights > Stats|                                         |
|  Tools > Console|  Recent Question Banks         |
|  Settings        |  [Bank list, compact]         |
|        |  Review (wrong questions...)  |
|        |  Learning Snapshot              |
|        |  Course Console (small entry)  |
+--------------------------------------------------+
```

### 2. Home — Empty
```
+--------------------------------------------------+
| Home                    [theme]                    <- Top bar (52px; no duplicated brand)
+--------------------------------------------------+
|        |  Welcome / context                      |
|  Nav   |                                         |
|        |  [Import Question Bank]                  |
|        |  No banks yet — start by importing      |
|        |  [Format guide / About]                 |
+--------------------------------------------------+
```

### 3. Practice — Unanswered
```
+--------------------------------------------------+
| Practice  ·  Demo Bank  ·  Chap 1  ·  3/50  <- Context (compact)
+--------------------------------------------------+
|        |  Question card (680-760px centered)    |
|  Nav   |  [type label]  #3                      |
|        |  What is...?                            |
|        |  A. ...  B. ...  C. ...  D. ...        |
|        |  [Select option]  [Submit if multi]    |
|        |                                         |
|        |  [Question Navigator button]          |
|        |  [Progress bar — thin]                 |
|        |                                         |
+--------------------------------------------------+
```

### 4. Practice — Answered / Wrong + Explanation
```
+--------------------------------------------------+
| ... context header ...                            |
+--------------------------------------------------+
|        |  [Correct / Wrong indicator subtle]     |
|  Nav   |  Question card (dominant, 680–760px)     |
|        |  [Options with correct highlighted]     |
|        |                                         |
|        |  | Sidebar | Question (dominant) | Explanation ContextPanel (300–340 px right) |
|        |                                         |
|        |  [Next]  [Previous]  [Explanation if open]  |
+--------------------------------------------------+
```

### 5. Question Navigator Open (Drawer — Wide Layout)
```
+-------------------------------------------------------------------+
| Practice / Demo Bank / Chapter 1 / 3 of 50              actions   |
+-------------------------------------------------------------------+
| Sidebar | Question Workspace (680–760 px)  | Navigator (drawer)  |
|         |                               |                     |
| Nav     | [type] #3                    | Questions            |
|         | What is...?                   | 01 ✓  02 ✗  03 ●    |
|         | A. ...                        | 04 —  05 ✓  06 —    |
|         | B. ...                        |                     |
|         | C. ...                        | Legend:              |
|         | D. ...                        | ✓ Correct  ✗ Wrong   |
|         |                               | ● Current  — Unans.  |
|         | [Options] [Submit if multi]  |                     |
|         |                               | [Close Navigator]    |
+-------------------------------------------------------------------+
```
Note: Navigator appears beside workspace; Question remains fully visible; does not replace workspace content.

### 6. Question Banks
```
+--------------------------------------------------+
| Question Banks                                |
+--------------------------------------------------+
|        |  [Import Question Bank]                  |
|  Nav   |                                         |
|        |  Bank A  ·  120 questions  ·  45% done  |
|        |  Bank B  ·  80 questions  ·  resume      |
|        |  [actions per row]                      |
+--------------------------------------------------+
```

### 7. Review
```
+--------------------------------------------------+
| Review  ·  Wrong Questions                   |
+--------------------------------------------------+
|        |  Filter: [All] [1 error] [2 errors]...  |
|  Nav   |                                         |
|        |  [Start Review]                          |
|        |  Why these appear: wrong count + threshold|
|        |  12 questions ready                      |
+--------------------------------------------------+
```

### 8. Statistics
```
+--------------------------------------------------+
| Statistics                                    |
+--------------------------------------------------+
|        |  Total Answered: 142                      |
|  Nav   |  Total Correct: 98  ·  Accuracy: 69%     |
|        |  Session Incorrect: 12  (Review)         |
|        |  [Simple distribution / mistake table]     |
+--------------------------------------------------+
```

### 9. Course Console — Setup
```
+--------------------------------------------------+
| Course Console  ·  Setup                      |
+--------------------------------------------------+
|        |  [Parameters form / instructions]         |
|  Nav   |  [Analyze Course]                        |
+--------------------------------------------------+
```

### 10. Course Console — Running
```
+--------------------------------------------------+
| ... context ...                                    |
+--------------------------------------------------+
|        |  Timeline / Tasks                       |
|  Nav   |  [Progress bars, states: done/running]   |
|        |                                         |
|        |  Current task · Status · %              |
|        |                                         |
|        |  Log panel (collapsible / lower region)  |
+--------------------------------------------------+
```

### 11. Settings
```
+--------------------------------------------------+
| Settings                                      |
+--------------------------------------------------+
|        |  Appearance  ·  Light / Dark              |
|  Nav   |  Practice  ·  Threshold [3]              |
|        |  Keyboard  ·  Shortcuts reference         |
|        |  About / Legal  ·  Disclaimer              |
+--------------------------------------------------+
```

### 12. Legal Acknowledgement
```
+--------------------------------------------------+
|  [Calm overlay / panel — preserved semantics]     |
|        |  Use terms and disclaimer content          |
|        |  [Acknowledge and proceed]                 |
+--------------------------------------------------+
```

### 13. Narrow / Compact Practice Layout
```
+--------------------------------------------------+
|  [Hamburger nav]  Practice  ·  Bank  ·  3/50      |
+--------------------------------------------------+
|  Question card (full width, readable)            |
|  [Options stacked]                                |
|  [Explanation below or drawer]                    |
+--------------------------------------------------+
```

---

## CONFLICTS WITH EXISTING FUNCTIONALITY (Acknowledged)

1. Yuketang console currently has independent cyan/blue theme (`yuketang.css` — 1150+ lines of v4–v6 iterations) vs site theme. Specification requires same product identity; console will use site dark/light palette (not cyan). Existing `yuketang.js` selects elements by ID; new shell must preserve IDs or update JS minimally.

2. Existing legal acknowledgment is mandatory first-time overlay (`hub.html` `#legalOverlay`). Specification preserves semantics but allows calmer visual presentation — does not silently convert to banner; if redesign wants a less blocking format, separate authorization needed per spec section 20.

3. Existing bottom floating pill (`bottom-bar`) with opacity 0.45 is a distinctive interaction choice from v1.2. Specification replaces with restrained sticky action region inside Practice — preserves all actions, changes presentation only.

4. Existing sidebar uses hover-expand (60px → 240px). Specification requires deliberate Question Navigator button + drawer — breaks hover dependency (improves accessibility and touch). Existing sidebar content (question index) moves to navigator drawer.

5. Theme toggle currently only toggles `data-theme` between light/dark via `base.css`; yuketang ignores it. New system requires unified theme application across all pages — requires `yuketang.css` redesign or theme inheritance fix.

6. Existing statistics bar (6 pill chips with emoji) competes with question for attention. Specification moves compact progress to top context, statistics to dedicated page / sidebar, removing competitive header.

No application backend behavior changed. All 6 question types, wrong-book logic, progress persistence, keyboard shortcuts, import/format, console execution preserved conceptually.

---

## 5 MOST IMPORTANT DESIGN DECISIONS

1. Desktop-first sidebar shell (224/56 px) with unified navigation — resolves current 3-page layout inconsistency and creates product identity.
2. Practice page hierarchy enforced: question > interaction > feedback > explanation > progress — prevents statistics/navigation from competing with content.
3. No decorative themes, no emoji icons, no gradient borders, no pill-everything, no giant marketing typography — defines the "not generic AI SaaS" direction explicitly.
4. Issue resolved: yuketang console must belong to same theme family (not independent cyan HUD) — eliminates largest visual identity conflict in current repo.
5. Accessibility contract and state matrix included in specification — design not only defines appearance but required interaction, focus, reduced-motion, and error-state behavior.

---

## CONFIRMATIONS

- Path of specification: `UI_V2_SPEC.md`
- No application source files modified (.git tracked source untouched; only `UI_V2_SPEC.md` and earlier `DESIGN_REVIEW_REPORT.md` created)
- All templates, CSS, JS, Python, test files, banks preserved unmodified
- Existing functionality preserved in specification (section 4, component contracts, state matrix)
- Implementation framework not selected per section 26

---

## 29. UI V2 IMPLEMENTATION ACCEPTANCE CHECKLIST

This checklist makes the specification verifiable. Each item is an objective check, not a subjective opinion.

Shell / Navigation:
[ ] Sidebar expands to 224 px / collapses to 56 px.
[ ] Top bar is 52 px; does NOT contain duplicated product branding (brand only in sidebar).
[ ] All 7 destinations accessible: Home, Practice, Banks, Review, Stats, Console, Settings.
[ ] Three responsive modes work (wide >1200, compact 900–1199, narrow <900).

Brand / Visual Identity:
[ ] No decorative themes; no emoji icons in interface.
[ ] No gradient buttons; no gradient borders; no pill radius on standard buttons.
[ ] Restrained vermilion accent (#B94A34 or verified accessible dark equivalent) used consistently.
[ ] Subtle "学" brand mark present; no red/gold decorative seal.
[ ] System sans-serif only; no serif headings; no external font CDN dependency.

Practice (highest priority):
[ ] Practice page attention hierarchy: question > interaction > feedback > explanation > progress > utilities.
[ ] No 6-stat-chip header competing with question.
[ ] Question Navigator is deliberate button-triggered drawer/panel; does NOT replace question workspace on Wide; close control present; Escape closes; focus returns to trigger.
[ ] Explanation shows only existing data sections (Analysis / Memo / Translation); empty sections NOT shown.
[ ] Explanation visible beside question on Wide; drawer on compact; stacked or drawer on narrow.
[ ] OptionItem states fully defined (default, hover, selected, submitted-correct with text+symbol, submitted-wrong with text+symbol, disabled after answer) — never color-only.
[ ] All 6 existing question types (single, judge, multi, TF, en_single, matching) remain usable; matching never drag-only, keyboard review available.
[ ] Keyboard shortcuts preserved: number selection (single), arrow/tab (navigation), submit (multi/matching).

Question Banks / Review / Statistics:
[ ] Banks use productivity list view (not large card gallery).
[ ] Review promoted to first-class destination with clear filters and Start Review.
[ ] Statistics only shows metrics supported by existing data (total answered, total correct, accuracy, wrong count); no invented historical trends; 2–4 important metrics max.

Course Console:
[ ] Console uses site theme (not independent cyan HUD); no laser timeline; no neon glow; no background grid; no decorative glass.
[ ] Status states include text + symbol + color (not color-only).
[ ] Logs in monospace only; other content uses site typography.

Button / Component Contracts:
[ ] Only 4 major button variants: Primary / Secondary / Ghost / Danger.
[ ] Primary reserved for strongest action; no adjacent competing Primary buttons unless genuinely equal actions.
[ ] Button sizes enforce minimums: standard 36 px, compact 32 px, prominent max 40 px; radius 6 px; no pill radius for standard buttons.
[ ] Loading buttons preserve width; prevent duplicate submission; accessible status announced.
[ ] Disabled buttons readable (>3:1); not invisible by opacity alone.
[ ] IconButton 32 × 32 px minimum; aria-label mandatory; tooltip on keyboard focus; no emoji.
[ ] Interactive desktop targets >= 32 × 32 px; narrow touch preferred >= 44 × 44 px where practical.

Modal / Drawer / Focus / Accessibility:
[ ] Modal focus trapped; Escape closes non-mandatory dialogs; focus restored to trigger; dialog role + title present.
[ ] Drawer (overlay) focus managed; close button visible; Escape closes; focus restored; not hover-only.
[ ] ContextPanel (wide explanation) visible beside question; not overlapping; focus optional inside; close returns focus.
[ ] No operation depends only on hover.
[ ] No semantic status (correct/wrong/selected/current) expresses by color alone; symbol + text always present.
[ ] Focus-visible visible on all keyboard-operable controls; never hidden by sticky elements.
[ ] prefers-reduced-motion respected (motion simplified or disabled).

State / Empty / Error / Loading:
[ ] Empty states exist (Home empty, Banks empty, Review empty, Stats empty, Navigator empty) — calm message + valid next action; no dead-ends.
[ ] Loading states preserve layout; compact indicator; not decorative shimmer; reduced-motion stops/simplifies.
[ ] Error states show specific message; preserve entered data; provide retry/recovery; not generic only.
[ ] Success states not over-celebrated; Toast acceptable for transient feedback; persistent results shown in content; Toast does not steal focus or overlap action regions unreadably.

Settings / Theme / Data:
[ ] Settings real navigation with Appearance: Light / Dark (enabled only); no enabled System option unless system-theme behavior implemented.
[ ] Practice threshold, keyboard shortcuts, About/Legal included; no speculative cloud/account/team features.
[ ] Legal acknowledgment semantics preserved; acknowledgment required before proceeding; not silently converted to dismissible banner without authorization.
[ ] Theme applies consistently to all pages (no cyan console theme); no gradient backgrounds in site theme; no decorative SVG patterns.
[ ] No invented historical metrics; no unsupported analytics.

Migration / Preservation:
[ ] All 6 question types preserved conceptually.
[ ] Wrong-book (wrong count, consecutive correct, removal threshold, filtered review) preserved.
[ ] Statistics based on existing supported data only.
[ ] Progress persistence (localStorage keys) preserved; resume progress behavior preserved.
[ ] Import/export format and validation logic preserved.
[ ] Console execution (mock/real) preserved; only presentation redesigned.
[ ] Keyboard interaction concept preserved.
[ ] No backend source files modified; presentation rebuilt around same routes/API/state.

Verification: All above items must be demonstrable by implementation review (not subjective preference). Pass = all checked; fail = any missing.

---

READY FOR IMPLEMENTATION REVIEW
