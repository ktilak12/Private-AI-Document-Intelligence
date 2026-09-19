const fs = require('fs');
const path = require('path');

const baseDir = __dirname;

// 1. Enhance index.html / dashboard.html
function enhanceDashboard(content) {
  const customScript = `
<script>
  // Dashboard Specific Interactivity
  function setScope(scopeName) {
    const scopeText = document.getElementById('scope-text');
    if (scopeText) scopeText.innerText = 'Scope: ' + scopeName;
    const menu = document.getElementById('scope-menu');
    if (menu) menu.classList.add('hidden');
  }

  const scopeBtn = document.getElementById('scope-btn');
  if (scopeBtn) {
    scopeBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const menu = document.getElementById('scope-menu');
      if (menu) menu.classList.toggle('hidden');
    });
  }

  document.addEventListener('click', function() {
    const menu = document.getElementById('scope-menu');
    if (menu && !menu.classList.contains('hidden')) menu.classList.add('hidden');
  });

  function fillQuery(text) {
    const input = document.getElementById('ai-query-input');
    if (input) {
      input.value = text;
      input.focus();
    }
  }

  function submitDashboardQuery() {
    const input = document.getElementById('ai-query-input');
    if (input && input.value.trim()) {
      window.location.href = 'assistant.html?q=' + encodeURIComponent(input.value.trim());
    } else {
      window.location.href = 'assistant.html';
    }
  }

  const queryInput = document.getElementById('ai-query-input');
  if (queryInput) {
    queryInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitDashboardQuery();
      }
    });
  }

  // Bind Ask AI button
  document.querySelectorAll('button').forEach(btn => {
    if (btn.innerText.includes('Ask AI')) {
      btn.onclick = submitDashboardQuery;
    }
    if (btn.innerText.includes('New Query')) {
      btn.onclick = () => window.location.href = 'assistant.html';
    }
    if (btn.innerText.includes('Upload Documents')) {
      btn.onclick = () => window.location.href = 'documents.html?action=upload';
    }
  });
</script>
`;
  return content.replace('</body>', customScript + '\n</body>');
}

// 2. Enhance assistant.html
function enhanceAssistant(content) {
  const customScript = `
<script>
  // Enhanced Assistant Chat & Source Inspector
  const sampleCorpus = {
    "Notice & Indemnity": {
      title: "Employment Notice & Indemnity",
      query: "What are the notice periods and severance liability conditions in Section 4?",
      response: "Under Section 4.2 of the **Executive Employment Agreement (MSA_2026_V4)**, termination without cause requires a mandatory notice period of **90 calendar days** [DOC-01 §4.2]. In lieu of notice, the company must provide an immediate severance lump sum equal to **6 months of base salary** plus accelerated vesting of Tier-1 equity options [DOC-01 §4.3].\\n\\nFurthermore, per **Vendor Mutual Indemnity Addendum (§11.1)**, standard indemnification covers third-party IP claims up to **$5,000,000**, excluding gross negligence or willful misconduct [DOC-02 §11.1].",
      sources: [
        {
          id: "DOC-01",
          name: "Executive_MSA_2026_V4.pdf",
          loc: "Section 4.2 · Page 18",
          score: "0.982 COSINE",
          text: "4.2 Termination without Cause. Company may terminate Employee without Cause upon ninety (90) calendar days prior written notice. During such 90-day period, Employee shall continue to receive base compensation and benefits. In lieu of notice, Company may elect to provide immediate lump-sum payment of six (6) months Base Salary.",
          chunk: "CHUNK_0488_A2",
          index: "Qdrant / collection:msa_vault"
        },
        {
          id: "DOC-02",
          name: "Vendor_Indemnity_Addendum.pdf",
          loc: "Clause 11.1 · Page 4",
          score: "0.941 COSINE",
          text: "11.1 Mutual Indemnification. Each party shall defend, indemnify, and hold harmless the other party against all third-party claims arising out of intellectual property infringement up to an aggregate cap of $5,000,000.00 USD.",
          chunk: "CHUNK_0112_C9",
          index: "Qdrant / collection:legal_contracts"
        },
        {
          id: "DOC-03",
          name: "Corporate_Governance_Handbook_2026.pdf",
          loc: "Section 8.4 · Page 42",
          score: "0.887 COSINE",
          text: "8.4 Severance Protocols. All executive severance packages exceeding 3 months of base compensation require prior written authorization from the Compensation Committee.",
          chunk: "CHUNK_0921_F4",
          index: "Qdrant / collection:governance"
        }
      ]
    },
    "Q4 Guidance Analysis": {
      title: "Q4 Guidance & Financial Analysis",
      query: "Summarize Q4 revenue forecast and operating margin risks",
      response: "Based on the **Q4 2026 Financial Projections (SEC_Form_10Q)**, projected GAAP net revenue is targeted at **$48.5M - $52.0M**, representing a 14% YoY increase [DOC-04 §2.1].\\n\\nPrimary operating margin risks include increased compute infrastructure costs (up 22% due to local LLM cluster expansion) and extended enterprise sales cycles [DOC-04 §3.4].",
      sources: [
        {
          id: "DOC-04",
          name: "SEC_Form_10Q_Q4_2026.pdf",
          loc: "Item 2 · Management Discussion · Page 14",
          score: "0.964 COSINE",
          text: "Item 2. Financial Condition and Results of Operations. Consolidated net revenues for the fourth quarter are projected in the range of $48.5M to $52.0M. Compute infrastructure costs expanded by 22% quarter-over-quarter.",
          chunk: "CHUNK_0734_B1",
          index: "Qdrant / collection:financial_filings"
        }
      ]
    },
    "AI Regulatory Audit": {
      title: "EU AI Act Compliance Audit",
      query: "Does PAIDI meet EU AI Act Tier 2 requirements for high-risk document extraction?",
      response: "Yes. PAIDI conforms to **EU AI Act Article 14 (Human Oversight)** and **Article 10 (Data Governance)** requirements [DOC-05 §A14]. All retrieval vectors are strictly air-gapped on private dedicated clusters with deterministic audit logging and zero telemetry egress [DOC-05 §A10].",
      sources: [
        {
          id: "DOC-05",
          name: "EU_AI_Act_Compliance_Audit_2026.pdf",
          loc: "Article 14 Assessment · Page 7",
          score: "0.978 COSINE",
          text: "Article 14 Human Oversight Verification. System provides interactive citation provenance, bounding-box ground truth verification, and real-time operator intervention prior to downstream report synthesis.",
          chunk: "CHUNK_0290_E7",
          index: "Qdrant / collection:compliance"
        }
      ]
    }
  };

  function loadSession(sessionKey) {
    const session = sampleCorpus[sessionKey];
    if (!session) return;
    
    // Update session title
    const headerTitle = document.querySelector('section .font-headline-sm');
    if (headerTitle) headerTitle.innerText = session.title;

    // Update conversation messages
    const chatContainer = document.querySelector('section .overflow-y-auto');
    if (chatContainer) {
      chatContainer.innerHTML = \`
        <div class="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
          <!-- User Query -->
          <div class="flex items-start gap-3.5 self-end max-w-2xl">
            <div class="flex flex-col items-end gap-1">
              <div class="px-4 py-3 rounded-2xl rounded-tr-none bg-primary-container text-on-primary-container font-body-md shadow-sm">
                \${session.query}
              </div>
              <span class="font-label-sm text-label-sm text-outline px-1">Just now</span>
            </div>
            <div class="w-8 h-8 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center font-bold text-xs flex-shrink-0">T</div>
          </div>

          <!-- AI Response -->
          <div class="flex items-start gap-3.5 self-start max-w-3xl w-full">
            <div class="w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant/40 flex items-center justify-center flex-shrink-0 text-primary">
              <span class="material-symbols-outlined text-[18px]">auto_awesome</span>
            </div>
            <div class="flex flex-col gap-3 flex-1">
              <div class="p-5 rounded-2xl rounded-tl-none bg-surface-container-low border border-outline-variant/30 text-on-surface font-body-md leading-relaxed shadow-sm">
                \${session.response.replace(/\\n\\n/g, '<br><br>').replace(/\\[DOC-([0-9]+) §([0-9.]+)\\]/g, '<span onclick=\"highlightSource(\\'DOC-$1\\')\" class=\"inline-flex items-center gap-1 font-code-citation text-code-citation px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer mx-0.5 border border-primary/30 transition-colors\"><span class=\"material-symbols-outlined text-[12px]\">link</span>DOC-$1 §$2</span>')}
              </div>

              <!-- Action Bar -->
              <div class="flex items-center gap-2 px-1">
                <button onclick="copyResponse(this)" class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-label-sm font-label-sm border border-outline-variant/20 transition-colors">
                  <span class="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>Copy</span>
                </button>
                <button onclick="showToast('Response flagged as accurate', 'success')" class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-tertiary text-label-sm font-label-sm border border-outline-variant/20 transition-colors">
                  <span class="material-symbols-outlined text-[14px]">thumb_up</span>
                  <span>Accurate</span>
                </button>
                <button onclick="showToast('Feedback submitted to evaluation pool', 'info')" class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-error text-label-sm font-label-sm border border-outline-variant/20 transition-colors">
                  <span class="material-symbols-outlined text-[14px]">thumb_down</span>
                </button>
                <div class="ml-auto flex items-center gap-1.5 text-label-sm text-tertiary">
                  <span class="material-symbols-outlined text-[14px]">verified</span>
                  <span>98.2% Grounded</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      \`;
    }

    // Populate Right Inspector with first source
    if (session.sources && session.sources.length > 0) {
      const src = session.sources[0];
      selectSource(src.name, src.loc, src.score, src.text, src.chunk, src.index);
    }
  }

  function highlightSource(docId) {
    showToast('Inspecting grounding reference: ' + docId, 'info');
  }

  function copyResponse(btn) {
    showToast('AI synthesis copied to clipboard', 'success');
  }

  function selectSource(docName, loc, score, text, chunk, index) {
    const docNameEl = document.querySelector('aside.w-80 h3, aside.w-80 .font-headline-sm');
    if (docNameEl) docNameEl.innerText = docName;
    const locEl = document.querySelector('aside.w-80 .font-label-sm');
    if (locEl) locEl.innerText = loc;
    const scoreEl = document.querySelector('aside.w-80 .text-tertiary');
    if (scoreEl) scoreEl.innerText = score;
    const textEl = document.querySelector('aside.w-80 p.font-body-sm');
    if (textEl) textEl.innerText = text;
    showToast('Loaded source chunk: ' + chunk, 'info');
  }

  // Handle incoming query from URL (?q=...)
  window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (query) {
      showToast('Executing private neural retrieval...', 'info');
      setTimeout(() => {
        loadSession("Notice & Indemnity");
      }, 300);
    }

    // Bind session item click events
    document.querySelectorAll('aside .space-y-1 > div').forEach(item => {
      item.addEventListener('click', () => {
        const title = item.querySelector('.font-headline-sm')?.innerText.trim();
        if (title && sampleCorpus[title]) {
          document.querySelectorAll('aside .space-y-1 > div').forEach(el => {
            el.className = 'p-2.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface cursor-pointer flex flex-col gap-1 transition-all';
          });
          item.className = 'p-2.5 rounded bg-surface-container-high text-on-surface cursor-pointer flex flex-col gap-1 transition-all shadow-sm';
          loadSession(title);
        }
      });
    });

    // Chat prompt input enter handler
    const chatInput = document.querySelector('footer input[type=\"text\"], section input[type=\"text\"]:last-of-type');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim()) {
          const userText = chatInput.value.trim();
          chatInput.value = '';
          showToast('Querying vector vault...', 'info');
          setTimeout(() => {
            loadSession("Notice & Indemnity");
            showToast('Response synthesized with 3 verified citations', 'success');
          }, 600);
        }
      });
    }
  });
</script>
`;
  return content.replace('</body>', customScript + '\n</body>');
}

// 3. Enhance documents.html
function enhanceDocuments(content) {
  const customScript = `
<script>
  // Document Search & Real-time Filter
  function filterDocuments(query) {
    const rows = document.querySelectorAll('tbody tr, .document-grid-item');
    const q = query.toLowerCase();
    let matchCount = 0;
    rows.forEach(r => {
      const text = r.innerText.toLowerCase();
      if (text.includes(q)) {
        r.style.display = '';
        matchCount++;
      } else {
        r.style.display = 'none';
      }
    });
  }

  const docSearch = document.querySelector('main input[placeholder*=\"Filter\"], main input[placeholder*=\"Search\"]');
  if (docSearch) {
    docSearch.addEventListener('input', (e) => filterDocuments(e.target.value));
  }

  // File Upload Ingestion Modal & Simulation
  function triggerUploadModal() {
    showUploadModal();
  }

  function showUploadModal() {
    let modal = document.getElementById('upload-modal');
    if (!modal) {
      const modalEl = document.createElement('div');
      modalEl.id = 'upload-modal';
      modalEl.className = 'fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4';
      modalEl.innerHTML = \`
        <div class="bg-surface-container-low border border-outline-variant/40 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95">
          <div class="flex items-center justify-between border-b border-outline-variant/30 pb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[22px]">upload_file</span>
              <span class="font-headline-sm text-headline-sm font-semibold text-on-surface">Ingest Documents into PAIDI</span>
            </div>
            <button onclick="closeUploadModal()" class="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container-high"><span class="material-symbols-outlined text-[18px]">close</span></button>
          </div>
          <div id="drop-area" class="border-2 border-dashed border-outline-variant/50 hover:border-primary rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors bg-surface-container-lowest/50">
            <span class="material-symbols-outlined text-primary text-[40px]">cloud_upload</span>
            <div class="flex flex-col">
              <span class="font-body-md text-on-surface font-medium">Drag & drop files here, or browse</span>
              <span class="font-label-sm text-on-surface-variant mt-1">Supports PDF, DOCX, TXT, JSON, MD (Max 100MB)</span>
            </div>
            <input type="file" id="file-selector" class="hidden" multiple />
          </div>
          <div id="upload-progress" class="hidden flex flex-col gap-2 bg-surface-container-high/60 p-3.5 rounded-lg border border-outline-variant/30">
            <div class="flex items-center justify-between font-label-sm text-label-sm">
              <span id="upload-stage" class="text-primary font-medium">Processing OCR & Layout Analysis...</span>
              <span id="upload-percent" class="text-tertiary">42%</span>
            </div>
            <div class="w-full h-2 bg-surface-container-lowest rounded-full overflow-hidden">
              <div id="upload-bar" class="h-full bg-primary transition-all duration-300 w-[42%]"></div>
            </div>
          </div>
          <div class="flex items-center justify-end gap-3 pt-2">
            <button onclick="closeUploadModal()" class="px-4 py-2 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-md text-body-md">Cancel</button>
            <button onclick="simulateUploadProcess()" class="px-4 py-2 rounded bg-primary-container hover:bg-primary-container/90 text-on-primary-container font-body-md text-body-md font-medium">Start Ingestion</button>
          </div>
        </div>
      \`;
      document.body.appendChild(modalEl);
      modal = modalEl;

      const dropArea = document.getElementById('drop-area');
      const fileInput = document.getElementById('file-selector');
      dropArea.onclick = () => fileInput.click();
      fileInput.onchange = () => {
        if (fileInput.files.length > 0) {
          showToast('Selected ' + fileInput.files.length + ' file(s) for ingestion', 'info');
          simulateUploadProcess();
        }
      };
    } else {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  function closeUploadModal() {
    const modal = document.getElementById('upload-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  function simulateUploadProcess() {
    const progBox = document.getElementById('upload-progress');
    const stageEl = document.getElementById('upload-stage');
    const pctEl = document.getElementById('upload-percent');
    const barEl = document.getElementById('upload-bar');
    if (!progBox) return;
    progBox.classList.remove('hidden');

    const stages = [
      { pct: 20, text: "Extracting Layout & Semantic Boundaries..." },
      { pct: 55, text: "Generating Dense 1536-dim Embeddings..." },
      { pct: 85, text: "Indexing Vector Vault (HNSW Cosine)..." },
      { pct: 100, text: "Ingestion & Verification Complete!" }
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current >= stages.length) {
        clearInterval(interval);
        setTimeout(() => {
          closeUploadModal();
          showToast('Document successfully indexed and verified!', 'success');
        }, 600);
        return;
      }
      const st = stages[current];
      pctEl.innerText = st.pct + '%';
      stageEl.innerText = st.text;
      barEl.style.width = st.pct + '%';
      current++;
    }, 500);
  }

  // Bind upload buttons
  document.querySelectorAll('button').forEach(b => {
    if (b.innerText.includes('Upload') || b.innerText.includes('Add Document')) {
      b.onclick = triggerUploadModal;
    }
  });

  // Check URL query parameters for ?action=upload
  window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'upload') {
      setTimeout(triggerUploadModal, 200);
    }
  });
</script>
`;
  return content.replace('</body>', customScript + '\n</body>');
}

// 4. Enhance evaluation.html
function enhanceEvaluation(content) {
  const customScript = `
<script>
  // Benchmark Evaluation Suite Simulation
  function runEvaluationSuite() {
    showToast('Triggering RAG Triad benchmark suite across 150 golden samples...', 'info');
    const evalBtn = document.querySelector('button.bg-primary, button.bg-primary-container');
    if (evalBtn) {
      const origText = evalBtn.innerHTML;
      evalBtn.disabled = true;
      evalBtn.innerHTML = '<span class=\"material-symbols-outlined text-[18px] animate-spin\">sync</span><span>Benchmarking...</span>';
      
      setTimeout(() => {
        evalBtn.disabled = false;
        evalBtn.innerHTML = origText;
        showToast('Evaluation complete: Groundedness improved to 98.6% (+0.4%)', 'success');
      }, 2000);
    }
  }

  document.querySelectorAll('button').forEach(btn => {
    if (btn.innerText.includes('Run Evaluation') || btn.innerText.includes('Run Benchmark') || btn.innerText.includes('Test Suite')) {
      btn.onclick = runEvaluationSuite;
    }
  });
</script>
`;
  return content.replace('</body>', customScript + '\n</body>');
}

// 5. Enhance audit.html
function enhanceAudit(content) {
  const customScript = `
<script>
  // Filter audit records
  function filterAudit(q) {
    const rows = document.querySelectorAll('tbody tr');
    const query = q.toLowerCase();
    rows.forEach(r => {
      r.style.display = r.innerText.toLowerCase().includes(query) ? '' : 'none';
    });
  }

  const auditInput = document.querySelector('main input[placeholder*=\"Search\"], main input[placeholder*=\"Filter\"]');
  if (auditInput) {
    auditInput.addEventListener('input', (e) => filterAudit(e.target.value));
  }

  // Export Audit Report
  function exportAuditReport() {
    const auditData = {
      exportTimestamp: new Date().toISOString(),
      system: "PAIDI Enterprise AI Document Intelligence",
      totalVerifiedQueries: 1420,
      merkleRoot: "0x8f71c3a8e99b24f5a01bcde671994a32e",
      complianceStatus: "SAIF / SOC2 Type II Conforming",
      records: [
        { id: "AUD-9941", query: "Employment Notice & Indemnity", timestamp: "2026-09-19T14:14:00Z", user: "Tilak", status: "VERIFIED", latencyMs: 242 },
        { id: "AUD-9940", query: "Q4 Financial Guidance Forecast", timestamp: "2026-09-19T13:50:12Z", user: "Tilak", status: "VERIFIED", latencyMs: 198 },
        { id: "AUD-9939", query: "Vendor Indemnification Cap", timestamp: "2026-09-19T12:30:45Z", user: "Tilak", status: "VERIFIED", latencyMs: 215 }
      ]
    };

    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'paidi_audit_ledger_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Cryptographic audit log exported as JSON', 'success');
  }

  document.querySelectorAll('button').forEach(b => {
    if (b.innerText.includes('Export') || b.innerText.includes('Download Log')) {
      b.onclick = exportAuditReport;
    }
  });
</script>
`;
  return content.replace('</body>', customScript + '\n</body>');
}

// 6. Enhance settings.html
function enhanceSettings(content) {
  const customScript = `
<script>
  // Vector DB Connection Test Simulator
  function testVectorConnection() {
    showToast('Testing vector connection to Qdrant cluster...', 'info');
    setTimeout(() => {
      showToast('Connection verified! Latency: 12ms (gRPC)', 'success');
    }, 800);
  }

  function saveSettingsConfig() {
    showToast('Configuration securely saved and applied across workspace', 'success');
  }

  document.querySelectorAll('button').forEach(btn => {
    if (btn.innerText.includes('Test Connection') || btn.innerText.includes('Ping')) {
      btn.onclick = testVectorConnection;
    }
    if (btn.innerText.includes('Save') || btn.innerText.includes('Apply Changes')) {
      btn.onclick = saveSettingsConfig;
    }
  });
</script>
`;
  return content.replace('</body>', customScript + '\n</body>');
}

// Process and overwrite target files
const fileEnhancers = [
  { file: 'index.html', fn: enhanceDashboard },
  { file: 'dashboard.html', fn: enhanceDashboard },
  { file: 'assistant.html', fn: enhanceAssistant },
  { file: 'documents.html', fn: enhanceDocuments },
  { file: 'evaluation.html', fn: enhanceEvaluation },
  { file: 'audit.html', fn: enhanceAudit },
  { file: 'settings.html', fn: enhanceSettings }
];

fileEnhancers.forEach(item => {
  const filePath = path.join(baseDir, item.file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = item.fn(content);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Enhanced ' + item.file);
  }
});
