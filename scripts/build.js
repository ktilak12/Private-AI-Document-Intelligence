const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
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
<!-- Global API Client & App Controller -->
<script src="api-client.js"></script>
<script src="app.js"></script>

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
      <div onclick="executeCommandQuery('Explain the cryptographic key rotation schedule and enclave security standards')" class="flex items-center gap-3 px-3 py-2 rounded hover:bg-surface-container-high hover:text-on-surface transition-colors cursor-pointer">
        <span class="material-symbols-outlined text-[18px] text-tertiary">auto_awesome</span>
        <span>Explain the cryptographic key rotation schedule and enclave security standards</span>
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
  toast.innerHTML = '<span class="material-symbols-outlined text-[18px]">' + icon + '</span><span>' + message + '</span>';
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
document.querySelectorAll('header input[type="text"]').forEach(input => {
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

// Helper to clean mock data from templates so pages load with live data
function cleanDummyData(html, fileName) {
  if (fileName === 'documents.html') {
    // Strip bulk selection action strip
    const bulkStart = html.indexOf('<!-- BULK SELECTION ACTION STRIP -->');
    const gridComment = '<!-- DOCUMENT GRID (6 BESPOKE TECHNICAL CARDS) -->';
    const gridStart = html.indexOf(gridComment);

    if (bulkStart !== -1 && gridStart !== -1) {
      html = html.substring(0, bulkStart) + html.substring(gridStart);
    }

    const recheckGridStart = html.indexOf(gridComment);
    const recheckGridEnd = html.indexOf('<!-- FOOTER: STORAGE TELEMETRY & PAGINATION -->');
    if (recheckGridStart !== -1 && recheckGridEnd !== -1) {
      html = html.substring(0, recheckGridStart) +
        '<!-- DOCUMENT GRID (LIVE DYNAMIC ENCLAVE) -->\n<div id="documents-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>\n' +
        html.substring(recheckGridEnd);
    }
  }

  if (fileName === 'assistant.html') {
    const sessionStart = html.indexOf('<!-- Session List -->');
    const sessionEnd = html.indexOf('<!-- Scope Metadata Summary Footer -->');
    if (sessionStart !== -1 && sessionEnd !== -1) {
      html = html.substring(0, sessionStart) +
        '<!-- Session List -->\n<div id="sessions-container" class="flex-1 overflow-y-auto px-2 space-y-1"></div>\n' +
        html.substring(sessionEnd);
    }

    const chatStart = html.indexOf('<!-- Dialogue History Canvas -->');
    const chatEnd = html.indexOf('<!-- Bottom Pinned Command Prompt -->');
    if (chatStart !== -1 && chatEnd !== -1) {
      html = html.substring(0, chatStart) +
        '<!-- Dialogue History Canvas -->\n<div id="chat-messages" class="flex-1 overflow-y-auto px-6 py-6 space-y-6"></div>\n' +
        html.substring(chatEnd);
    }

    // Clean static inspect drawer defaults
    html = html.replace(/<span[^>]*id=["']inspect-doc["'][^>]*>[\s\S]*?<\/span>/i, '<span class="font-headline-sm text-headline-sm text-on-surface truncate font-medium" id="inspect-doc">No Reference Selected</span>');
    html = html.replace(/<span[^>]*id=["']inspect-loc["'][^>]*>[\s\S]*?<\/span>/i, '<span class="font-code-citation text-code-citation text-outline" id="inspect-loc">Click any citation [1], [2]</span>');
    html = html.replace(/<span[^>]*id=["']inspect-score["'][^>]*>[\s\S]*?<\/span>/i, '<span class="font-code-citation text-code-citation text-tertiary font-semibold" id="inspect-score">--% Similarity</span>');
    html = html.replace(/<p[^>]*id=["']inspect-text["'][^>]*>[\s\S]*?<\/p>/i, '<p class="font-body-md text-body-md italic text-on-surface-variant" id="inspect-text">Select any citation badge [1], [2] in an answer to inspect verified source chunk text, similarity match score, and chunk coordinate.</p>');
    html = html.replace(/<span[^>]*id=["']inspect-chunk["'][^>]*>[\s\S]*?<\/span>/i, '<span class="text-on-surface" id="inspect-chunk">--</span>');
  }

  if (fileName === 'dashboard.html') {
    // Strip static table rows
    html = html.replace(/<tbody[^>]*>[\s\S]*?<\/tbody>/i, '<tbody id="dashboard-recent-docs"></tbody>');

    // Strip static Knowledge Activity events
    const actStart = html.indexOf('<!-- Card 1: Recent Knowledge Activity -->');
    const actEnd = html.indexOf('<!-- Card 2: Security & Privacy Guarantee -->');
    if (actStart !== -1 && actEnd !== -1) {
      const feedStart = html.indexOf('<div class="flex flex-col gap-4 relative pl-2">', actStart);
      if (feedStart !== -1 && feedStart < actEnd) {
        const card1End = html.lastIndexOf('</div>', actEnd);
        if (card1End !== -1) {
          html = html.substring(0, feedStart) +
            '<div id="dashboard-activity-feed" class="flex flex-col gap-4 relative pl-2"><div class="absolute left-4 top-2 bottom-2 w-[1px] bg-outline-variant/30"></div></div>\n</div>\n' +
            html.substring(actEnd);
        }
      }
    }
  }

  if (fileName === 'evaluation.html') {
    // Strip static table rows in evaluation table
    html = html.replace(/<tbody class="divide-y divide-outline-variant\/20 font-body-sm text-body-sm text-on-surface">[\s\S]*?<\/tbody>/i, '<tbody id="eval-table-body" class="divide-y divide-outline-variant/20 font-body-sm text-body-sm text-on-surface"></tbody>');

    // Strip static right panel
    const evalRightStart = html.indexOf('<!-- RIGHT PANEL: LIVE RUN INSPECTOR & DIFF TELEMETRY (40%) -->');
    const evalRightEnd = html.indexOf('<!-- BOTTOM BENCHMARKING REPOSITORY & CLUSTER STATUS BAR -->');
    if (evalRightStart !== -1 && evalRightEnd !== -1) {
      html = html.substring(0, evalRightStart) +
        '<!-- RIGHT PANEL: LIVE RUN INSPECTOR & DIFF TELEMETRY (40%) -->\n<div id="eval-inspector-container" class="lg:col-span-5 bg-surface-container-low rounded-xl border border-outline-variant/30 flex flex-col p-5 space-y-4"></div>\n' +
        html.substring(evalRightEnd);
    }
  }

  if (fileName === 'audit.html') {
    // Strip pinned cards
    const pinnedStart = html.indexOf('<!-- Pinned Card 1 -->');
    const pinnedEnd = html.indexOf('<!-- Section 3: Search, Faceted Filtering, and Sort Controls -->');
    if (pinnedStart !== -1 && pinnedEnd !== -1) {
      const gridContainerStart = html.lastIndexOf('<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">', pinnedStart);
      if (gridContainerStart !== -1) {
        html = html.substring(0, gridContainerStart) +
          '<div id="audit-pinned-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>\n</div>\n' +
          html.substring(pinnedEnd);
      }
    }

    // Strip timeline
    const timelineStart = html.indexOf('<!-- Primary Context Canvas: Chronological Sessions (xl:col-span-8) -->');
    const timelineEnd = html.indexOf('<!-- Auxiliary Analytical Inspector & Telemetry Rail (xl:col-span-4) -->');
    if (timelineStart !== -1 && timelineEnd !== -1) {
      html = html.substring(0, timelineStart) +
        '<!-- Primary Context Canvas: Chronological Sessions (xl:col-span-8) -->\n<div id="audit-timeline-container" class="xl:col-span-8 flex flex-col gap-6 min-w-0"></div>\n' +
        html.substring(timelineEnd);
    }

    // Strip static frequent citations
    const freqStart = html.indexOf('<!-- Frequent Citations Module -->');
    const freqEnd = html.indexOf('<!-- Data Privacy Guarantee Panel -->');
    if (freqStart !== -1 && freqEnd !== -1) {
      html = html.substring(0, freqStart) +
        `<!-- Frequent Citations Module -->
<div class="p-5 rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-3.5">
<div class="flex items-center justify-between border-b border-surface-container-high pb-3">
<div class="flex items-center gap-2">
<span class="material-symbols-outlined text-secondary text-[20px]">auto_stories</span>
<h3 class="font-headline-sm text-headline-sm text-on-surface font-semibold">Frequent Citations</h3>
</div>
<span class="font-code-citation text-code-citation text-on-surface-variant">RANKED BY OCCURRENCE</span>
</div>
<div id="audit-frequent-citations" class="flex flex-col gap-2.5"></div>
</div>\n` +
        html.substring(freqEnd);
    }

    // Clean hardcoded counts in filter buttons
    html = html.replace(/All Sessions \(\d+\)/g, 'All Sessions');
    html = html.replace(/Legal &amp; Compliance \(\d+\)/g, 'Legal &amp; Compliance');
    html = html.replace(/Financial \/ SEC \(\d+\)/g, 'Financial / SEC');
    html = html.replace(/Research &amp; Technical \(\d+\)/g, 'Research &amp; Technical');
    html = html.replace(/Bookmarked \(\d+\)/g, 'Bookmarked');
  }

  return html;
}

pages.forEach(p => {
  let content = fs.readFileSync(path.join(rawDir, p.file), 'utf8');
  content = normalizeNav(content, p.currentPath);
  content = cleanDummyData(content, p.file);

  // Insert common enhancements right before closing </body>
  content = content.replace('</body>', commonEnhancements + '\n</body>');

  fs.writeFileSync(path.join(baseDir, p.target), content, 'utf8');
  console.log('Processed & Created ' + p.target);
});
