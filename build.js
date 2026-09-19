const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const rawDir = path.join(baseDir, '_stitch_raw');

// Define the pages to process
const pages = [
  { file: 'dashboard.html', target: 'index.html', currentPath: 'dashboard' },
  { file: 'dashboard.html', target: 'dashboard.html', currentPath: 'dashboard' },
  { file: 'assistant.html', target: 'assistant.html', currentPath: 'ai-assistant' },
  { file: 'documents.html', target: 'documents.html', currentPath: 'documents' },
  { file: 'evaluation.html', target: 'evaluation.html', currentPath: 'evaluation' },
  { file: 'audit.html', target: 'audit.html', currentPath: 'history' },
  { file: 'settings.html', target: 'settings.html', currentPath: 'settings' }
];

// Helper to normalize navigation hrefs and active styles
function normalizeNav(html, activePath) {
  // Navigation links
  html = html.replace(/data-path=["']dashboard["']\s+href=["'][^"']*["']/g, 'data-path="dashboard" href="index.html"');
  html = html.replace(/data-path=["']documents["']\s+href=["'][^"']*["']/g, 'data-path="documents" href="documents.html"');
  html = html.replace(/data-path=["'](ai-assistant|assistant)["']\s+href=["'][^"']*["']/g, 'data-path="ai-assistant" href="assistant.html"');
  html = html.replace(/data-path=["']search["']\s+href=["'][^"']*["']/g, 'data-path="search" href="javascript:void(0)" onclick="openCommandPalette()"');
  html = html.replace(/data-path=["']collections["']\s+href=["'][^"']*["']/g, 'data-path="collections" href="documents.html#collections"');
  html = html.replace(/data-path=["'](history|audit)["']\s+href=["'][^"']*["']/g, 'data-path="history" href="audit.html"');
  html = html.replace(/data-path=["']analytics["']\s+href=["'][^"']*["']/g, 'data-path="analytics" href="evaluation.html#analytics"');
  html = html.replace(/data-path=["']evaluation["']\s+href=["'][^"']*["']/g, 'data-path="evaluation" href="evaluation.html"');
  html = html.replace(/data-path=["']settings["']\s+href=["'][^"']*["']/g, 'data-path="settings" href="settings.html"');

  // Replace logo with local asset
  html = html.replace(/src=["']https:\/\/lh3\.googleusercontent\.com\/aida\/[^"']*["']\s+alt=["']PAIDI Security & Intelligence Logo["']/g, 'src="assets/logo.svg" alt="PAIDI Security & Intelligence Logo"');

  return html;
}

// Build common interactive modal & command palette injection
const commonEnhancements = `
<!-- Global Command Palette Modal (⌘K) -->
<div id="cmd-palette" class="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm hidden items-start justify-center pt-24 px-4">
  <div class="bg-surface-container-low border border-outline-variant/40 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
    <div class="flex items-center px-4 py-3 border-b border-outline-variant/30 gap-3">
      <span class="material-symbols-outlined text-primary text-[22px]">search</span>
      <input id="cmd-palette-input" type="text" placeholder="Search commands, documents, or ask AI... (Press Esc to close)" class="w-full bg-transparent text-on-surface font-body-md focus:outline-none placeholder:text-outline" />
      <span class="font-code-citation text-code-citation px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant/30">ESC</span>
    </div>
    <div class="p-2 max-h-96 overflow-y-auto space-y-1 text-on-surface-variant font-body-sm" id="cmd-palette-results">
      <div class="px-3 py-1.5 text-label-sm font-label-sm uppercase tracking-wider text-outline">Quick Navigation</div>
      <a href="index.html" class="flex items-center justify-between px-3 py-2 rounded hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer">
        <div class="flex items-center gap-3"><span class="material-symbols-outlined text-[18px] text-primary">grid_view</span><span>Dashboard</span></div>
        <span class="font-code-citation text-outline">G D</span>
      </a>
      <a href="assistant.html" class="flex items-center justify-between px-3 py-2 rounded hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer">
        <div class="flex items-center gap-3"><span class="material-symbols-outlined text-[18px] text-primary">smart_toy</span><span>AI Assistant & Verification</span></div>
        <span class="font-code-citation text-outline">G A</span>
      </a>
      <a href="documents.html" class="flex items-center justify-between px-3 py-2 rounded hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer">
        <div class="flex items-center gap-3"><span class="material-symbols-outlined text-[18px] text-primary">description</span><span>Document Library</span></div>
        <span class="font-code-citation text-outline">G L</span>
      </a>
      <a href="evaluation.html" class="flex items-center justify-between px-3 py-2 rounded hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer">
        <div class="flex items-center gap-3"><span class="material-symbols-outlined text-[18px] text-primary">fact_check</span><span>Evaluation & Observability</span></div>
        <span class="font-code-citation text-outline">G E</span>
      </a>
      <a href="audit.html" class="flex items-center justify-between px-3 py-2 rounded hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer">
        <div class="flex items-center gap-3"><span class="material-symbols-outlined text-[18px] text-primary">history</span><span>History & Query Audit</span></div>
        <span class="font-code-citation text-outline">G H</span>
      </a>
      <a href="settings.html" class="flex items-center justify-between px-3 py-2 rounded hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer">
        <div class="flex items-center gap-3"><span class="material-symbols-outlined text-[18px] text-primary">settings</span><span>System Configuration</span></div>
        <span class="font-code-citation text-outline">G S</span>
      </a>
      <div class="px-3 py-1.5 text-label-sm font-label-sm uppercase tracking-wider text-outline pt-2">Sample Quick Queries</div>
      <div onclick="executeCommandQuery('Summarize termination covenants with financial liability')" class="flex items-center gap-3 px-3 py-2 rounded hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer">
        <span class="material-symbols-outlined text-[18px] text-tertiary">auto_awesome</span>
        <span>Summarize termination covenants with financial liability</span>
      </div>
      <div onclick="executeCommandQuery('Extract compliance deadlines for Q3 2026')" class="flex items-center gap-3 px-3 py-2 rounded hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer">
        <span class="material-symbols-outlined text-[18px] text-tertiary">auto_awesome</span>
        <span>Extract compliance deadlines for Q3 2026</span>
      </div>
    </div>
  </div>
</div>

<!-- Global Toast Notification -->
<div id="toast-container" class="fixed bottom-6 right-6 z-[110] flex flex-col gap-2 pointer-events-none"></div>

<script>
// Global Command Palette Logic
function openCommandPalette() {
  const modal = document.getElementById('cmd-palette');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const input = document.getElementById('cmd-palette-input');
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

function closeCommandPalette() {
  const modal = document.getElementById('cmd-palette');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function executeCommandQuery(q) {
  closeCommandPalette();
  window.location.href = 'assistant.html?q=' + encodeURIComponent(q);
}

document.addEventListener('keydown', function(e) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    const modal = document.getElementById('cmd-palette');
    if (modal && !modal.classList.contains('hidden')) {
      closeCommandPalette();
    } else {
      openCommandPalette();
    }
  }
  if (e.key === 'Escape') {
    closeCommandPalette();
  }
});

const cmdModal = document.getElementById('cmd-palette');
if (cmdModal) {
  cmdModal.addEventListener('click', function(e) {
    if (e.target === cmdModal) closeCommandPalette();
  });
}

// Global Toast Messenger
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
  const color = type === 'success' ? 'text-tertiary border-tertiary/40' : type === 'error' ? 'text-error border-error/40' : 'text-primary border-primary/40';
  toast.className = 'pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-lg bg-surface-container-high border ' + color + ' shadow-2xl text-on-surface font-body-sm transition-all transform duration-300 translate-y-2 opacity-0';
  toast.innerHTML = '<span class=\"material-symbols-outlined text-[18px]\">' + icon + '</span><span>' + message + '</span>';
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Bind header search input to Command Palette
document.querySelectorAll('header input[type=\"text\"]').forEach(input => {
  input.addEventListener('click', (e) => {
    e.preventDefault();
    openCommandPalette();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommandQuery(input.value);
    }
  });
});
</script>
`;

pages.forEach(p => {
  let content = fs.readFileSync(path.join(rawDir, p.file), 'utf8');
  content = normalizeNav(content, p.currentPath);

  // Insert common enhancements right before closing </body>
  content = content.replace('</body>', commonEnhancements + '\n</body>');

  fs.writeFileSync(path.join(baseDir, p.target), content, 'utf8');
  console.log('Processed & Created ' + p.target);
});
