// Prototype — minimal vanilla JS; no framework; no CDN; no production source changes

// Design system reference (matches UI_V2_SPEC.md Section 11 / Section 4B)
// Sidebar expanded: 224px; collapsed: 56px
// TopBar: 52px; Button standard: 36px; IconButton: 32x32; Interactive target >=32x32

// Mock data only (never touches production localStorage)
const MOCK_STATE = {
  theme: 'light', // 'light' or 'dark'
  sidebarCollapsed: false,
  currentBank: '数据库系统原理',
  currentProgress: { answered: 42, total: 50, accuracy: 69 },
  wrongReviewCount: 12,
};

// Theme toggle
function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  MOCK_STATE.theme = next;
  // Note: no production storage key used; isolated prototype
}

// Sidebar collapse (responsive behavior: wide only)
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('collapsed');
    MOCK_STATE.sidebarCollapsed = sidebar.classList.contains('collapsed');
  }
}

// Make theme control accessible (keyboard)
document.addEventListener('DOMContentLoaded', () => {
  const themeBtn = document.querySelector('.icon-btn');
  if (themeBtn) {
    themeBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleTheme();
      }
    });
  }
  // Note: keyboard navigation through sidebar links uses native Tab/Enter (not Arrow keys)
  // This aligns with Section 6 / Section 22 contract (no artificial Arrow-key menu)
});
