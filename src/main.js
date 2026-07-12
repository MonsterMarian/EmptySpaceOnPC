import './style.css';
import Chart from 'chart.js/auto';
import { TreemapController, TreemapElement } from 'chartjs-chart-treemap';

Chart.register(TreemapController, TreemapElement);

document.querySelector('#app').innerHTML = `
  <header>
    <h1>SpaceFinder Premium V3</h1>
    <p class="subtitle">Find and safely remove large unused files, duplicates, and system junk</p>
  </header>

  <div class="tabs">
    <div class="tab active" data-target="tab-scanner">Large File Scanner</div>
    <div class="tab" data-target="tab-duplicates">Duplicate Finder</div>
    <div class="tab" data-target="tab-junk">System Junk Cleaner</div>
    <div class="tab" data-target="tab-ai">AI Assistant</div>
    <div style="flex:1;"></div>
    <button id="btn-settings" class="secondary" style="padding: 0.5rem 1rem;">⚙ Settings</button>
  </div>

  <!-- TAB 1: Disk Scanner -->
  <div id="tab-scanner" class="tab-content active">
    <section class="panel">
      <div class="presets-bar">
        <button class="preset-btn" data-preset="videos">Forgotten Videos (>500MB)</button>
        <button class="preset-btn" data-preset="installers">Old Installers (>100MB)</button>
        <button class="preset-btn" data-preset="huge">Huge Files (>1GB, 90 Days)</button>
      </div>

      <div class="controls-grid">
        <div class="input-group">
          <label for="folder-path">Folder to scan</label>
          <div style="display: flex; gap: 0.5rem;">
            <input type="text" id="folder-path" value="C:\\" readonly style="flex: 1;" />
            <button id="btn-select-folder" class="secondary" title="Select Folder">Choose Folder...</button>
          </div>
        </div>
        
        <div class="input-group">
          <label for="min-size">Min Size (MB)</label>
          <input type="number" id="min-size" value="100" min="1" />
        </div>
        
        <div class="input-group">
          <label for="min-days">Unused older than (days)</label>
          <input type="number" id="min-days" value="30" min="0" />
        </div>
        
      <!-- Action Bar -->
      <div class="action-bar" style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div style="flex:1;"></div> <!-- Spacer -->
        <div class="action-info" style="display: flex; align-items: center; gap: 1rem;">
          <span class="scan-progress" id="scan-progress"></span>
          <div class="loader" id="loader"></div>
          <button id="btn-start">Find Large Files</button>
        </div>
      </div>
    </section>

    <section class="panel" id="results-panel" style="display: none;">
      
      <div class="chart-container" id="chart-container" style="display:none; flex-direction: row; flex-wrap: wrap;">
        <div class="chart-box" style="flex: 1; min-width: 300px;">
          <h3 style="text-align:center; font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-muted);">By Category</h3>
          <canvas id="categoryChart"></canvas>
        </div>
        <div class="chart-box" style="flex: 2; min-width: 400px; position: relative;">
          <h3 style="text-align:center; font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-muted);">By Directory</h3>
          <canvas id="treemapChart"></canvas>
        </div>
      </div>

      <div class="results-header">
        <h2>Found Files</h2>
        <div class="stats" id="scan-stats">0 files found</div>
      </div>
      
      <div style="margin-bottom: 0.5rem; padding-left: 0.5rem; display: flex; align-items: center; gap: 1rem;">
        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary); cursor:pointer;">
          <input type="checkbox" id="select-all" /> Select All
        </label>
      </div>

      <div class="file-cards-container" id="results-body">
      </div>
      
      <div class="bottom-actions">
        <button id="btn-delete-selected" class="danger" disabled>Move to Recycle Bin</button>
      </div>
    </section>
  </div>

  <!-- TAB 2: Duplicate Finder -->
  <div id="tab-duplicates" class="tab-content">
    <section class="panel">
      <!-- Action Bar -->
      <div class="action-bar" style="display:flex; justify-content: space-between; align-items:center; flex-wrap: wrap; gap: 1rem;">
        <p>Select a folder to scan for identical duplicate files.</p>
        <div class="action-info" style="display: flex; align-items: center; gap: 1rem;">
          <span class="scan-progress" id="dupe-progress"></span>
          <div class="loader" id="dupe-loader"></div>
          <button id="btn-scan-dupes">Find Identical Duplicates</button>
        </div>
      </div>

      <div id="dupe-results" style="margin-top: 1rem;"></div>
      <div class="bottom-actions" style="margin-top:1rem;">
        <button id="btn-delete-dupes" class="danger" style="display:none;">Trash Selected Duplicates</button>
      </div>
    </section>
  </div>

  <!-- TAB 3: Junk Cleaner -->
  <div id="tab-junk" class="tab-content">
    <section class="panel">
      <!-- Action Bar -->
      <div class="action-bar" style="display:flex; justify-content: space-between; align-items:center; flex-wrap: wrap; gap: 1rem;">
        <p style="color:var(--text-secondary); font-size:0.9rem;">Scan system paths (Windows Temp, AppData caches) for safely removable junk.</p>
        <div class="action-info" style="display: flex; align-items: center; gap: 1rem;">
          <div class="loader" id="junk-loader"></div>
          <button id="btn-scan-junk">Analyze System Caches</button>
        </div>
      </div>
      
      <div style="margin-top: 1.5rem; margin-bottom: 0.5rem; display:none;" id="junk-select-all-wrap">
        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:var(--text-secondary); cursor:pointer;">
          <input type="checkbox" id="junk-select-all" /> Select All Junk
        </label>
      </div>

      <div class="file-cards-container" id="junk-results-body" style="display:none;">
      </div>
      <div class="bottom-actions">
        <button id="btn-delete-junk" class="danger" style="display:none;">Clean Selected Junk</button>
      </div>
    </section>
  </div>

  <!-- TAB 4: AI Assistant -->
  <div id="tab-ai" class="tab-content">
    <section class="panel" style="display: flex; flex-direction: column; height: 500px;">
      <div id="chat-messages" style="flex: 1; overflow-y: auto; padding-right: 1rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 1rem;">
        <div class="chat-message assistant">
          Hello! I am your SpaceFinder AI Assistant powered by Google Gemini 2.0 Flash via OpenRouter. How can I help you clean up your drive?
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <input type="text" id="ai-prompt-input" placeholder="Ask a question..." style="flex: 1;" />
        <button id="btn-send-ai">Send</button>
      </div>
    </section>
  </div>

  <!-- Settings Modal -->
  <div id="settings-modal" class="modal-overlay" style="display:none;">
    <div class="modal-content panel">
      <h2 style="margin-bottom: 1rem;">Settings</h2>
      <div class="input-group">
        <label for="nvidia-api-key">OpenRouter API Key</label>
        <input type="password" id="nvidia-api-key" placeholder="sk-or-v1-..." />
      </div>
      <div class="bottom-actions" style="margin-top: 1rem;">
        <button id="btn-close-settings" class="secondary">Close</button>
      </div>
    </div>
  </div>
`;

// Helper: Format Bytes
function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// ----------------------------------------------------
// TAB NAVIGATION
// ----------------------------------------------------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).classList.add('active');
  });
});

// ----------------------------------------------------
// TAB 1: Disk Scanner (with Categories & Chart)
// ----------------------------------------------------
let isScanning = false;
let foundFiles = [];
let totalSize = 0;
let selectedPaths = new Set();
let categoryChartInstance = null;
let treemapChartInstance = null;

const folderPathInput = document.getElementById('folder-path');
const btnSelectFolder = document.getElementById('btn-select-folder');
const minSizeInput = document.getElementById('min-size');
const minDaysInput = document.getElementById('min-days');
const btnStart = document.getElementById('btn-start');
const loader = document.getElementById('loader');
const scanProgress = document.getElementById('scan-progress');
const resultsPanel = document.getElementById('results-panel');
const resultsBody = document.getElementById('results-body');
const scanStats = document.getElementById('scan-stats');
const selectAllCheckbox = document.getElementById('select-all');
const btnDeleteSelected = document.getElementById('btn-delete-selected');
const chartContainer = document.getElementById('chart-container');

const getFileCategoryName = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  const video = ['mp4','mkv','avi','mov'];
  const image = ['jpg','jpeg','png','gif'];
  const doc = ['pdf','doc','docx','txt'];
  const arch = ['zip','rar','7z','tar'];
  const exe = ['exe','msi','apk'];
  
  if (video.includes(ext)) return 'Videos';
  if (image.includes(ext)) return 'Images';
  if (doc.includes(ext)) return 'Documents';
  if (arch.includes(ext)) return 'Archives';
  if (exe.includes(ext)) return 'Installers/Apps';
  return 'Other';
};

function checkSystemFileSafety(filePath) {
  const lowerPath = filePath.toLowerCase();
  const isSystem = lowerPath.includes('\\windows\\') || 
                   lowerPath.includes('\\program files') || 
                   lowerPath.includes('\\appdata\\');
  
  if (isSystem) return { class: 'warning', text: 'SYSTEM (UNSAFE)' };
  return { class: 'safe', text: 'SAFE' };
}

window.addEventListener('DOMContentLoaded', () => {
  const savedFolder = localStorage.getItem('sf-folder');
  if (savedFolder) folderPathInput.value = savedFolder;
  
  const savedApiKey = localStorage.getItem('sf-nvidia-key');
  if (savedApiKey) document.getElementById('nvidia-api-key').value = savedApiKey;
});

function saveUserSettingsToLocal() {
  localStorage.setItem('sf-folder', folderPathInput.value);
}
folderPathInput.addEventListener('change', saveUserSettingsToLocal);

document.getElementById('nvidia-api-key').addEventListener('input', (e) => {
  localStorage.setItem('sf-nvidia-key', e.target.value.trim());
});

const settingsModal = document.getElementById('settings-modal');
document.getElementById('btn-settings').addEventListener('click', () => {
  settingsModal.style.display = 'flex';
});
document.getElementById('btn-close-settings').addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = btn.dataset.preset;
    if (preset === 'videos') { minSizeInput.value = '500'; minDaysInput.value = '60'; }
    else if (preset === 'installers') { minSizeInput.value = '100'; minDaysInput.value = '30'; }
    else if (preset === 'huge') { minSizeInput.value = '1024'; minDaysInput.value = '90'; }
  });
});

btnSelectFolder.addEventListener('click', async () => {
  if (window.api) {
    const selected = await window.api.selectFolder();
    if (selected) { folderPathInput.value = selected; saveUserSettingsToLocal(); }
  }
});

btnStart.addEventListener('click', async () => {
  if (!window.api) return;
  if (isScanning) { await window.api.stopScan(); finalizeDiskScanProcess(); return; }

  isScanning = true; foundFiles = []; totalSize = 0; selectedPaths.clear(); updateDeleteBtn();
  btnStart.textContent = 'Cancel Scan'; btnStart.classList.add('danger');
  loader.style.display = 'block'; scanProgress.textContent = 'Analyzing disk...';
  resultsPanel.style.display = 'block'; chartContainer.style.display = 'none';
  resultsBody.innerHTML = ''; selectAllCheckbox.checked = false; refreshDiskScanStats();
  
  await window.api.startScan({
    folderPath: folderPathInput.value,
    minSizeMB: parseFloat(minSizeInput.value),
    minDaysUnused: parseFloat(minDaysInput.value)
  });
});

async function moveSelectedFilesToTrash(paths, callback) {
  if (paths.length === 0) return;
  if (!confirm(`Move ${paths.length} file(s) to the Recycle Bin?`)) return;
  const results = await window.api.trashFiles(paths);
  if (callback) callback(results);
}

btnDeleteSelected.addEventListener('click', () => {
  moveSelectedFilesToTrash(Array.from(selectedPaths), (results) => {
    results.forEach(res => {
      if (res.success) {
        const idx = foundFiles.findIndex(f => f.path === res.path);
        if (idx !== -1) { totalSize -= foundFiles[idx].size; foundFiles.splice(idx, 1); }
        selectedPaths.delete(res.path);
        const row = document.getElementById('row-' + btoa(unescape(encodeURIComponent(res.path))).replace(/=/g, ''));
        if (row) row.remove();
      }
    });
    refreshDiskScanStats(); updateDeleteBtn(); refreshVisualCharts();
  });
});

selectAllCheckbox.addEventListener('change', (e) => {
  const isChecked = e.target.checked;
  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.checked = isChecked;
    const path = cb.dataset.path;
    if (isChecked) selectedPaths.add(path); else selectedPaths.delete(path);
  });
  updateDeleteBtn();
});

function updateDeleteBtn() {
  btnDeleteSelected.disabled = selectedPaths.size === 0;
  btnDeleteSelected.textContent = `Move to Recycle Bin (${selectedPaths.size})`;
}

function refreshVisualCharts() {
  if (foundFiles.length === 0) {
    chartContainer.style.display = 'none';
    return;
  }
  chartContainer.style.display = 'flex';
  
  // 1. Doughnut Chart (Categories)
  const categorySizes = {};
  foundFiles.forEach(f => {
    categorySizes[f.category] = (categorySizes[f.category] || 0) + f.size;
  });
  
  const pieLabels = Object.keys(categorySizes);
  const pieData = Object.values(categorySizes);
  
  const ctxPie = document.getElementById('categoryChart').getContext('2d');
  if (categoryChartInstance) categoryChartInstance.destroy();
  
  categoryChartInstance = new Chart(ctxPie, {
    type: 'doughnut',
    data: {
      labels: pieLabels,
      datasets: [{
        data: pieData,
        backgroundColor: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b', '#ec4899', '#06b6d4'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#e2e8f0', font: {size: 11} } } }
    }
  });

  // 2. Treemap Chart (Directories)
  // Aggregate file sizes by their parent directory
  const dirSizes = {};
  foundFiles.forEach(f => {
    // Basic extraction of parent dir
    const lastSlash = Math.max(f.path.lastIndexOf('\\'), f.path.lastIndexOf('/'));
    const dir = lastSlash > -1 ? f.path.substring(0, lastSlash) : f.path;
    dirSizes[dir] = (dirSizes[dir] || 0) + f.size;
  });

  // Convert to array of objects for treemap
  const treemapData = Object.keys(dirSizes).map(dir => ({
    name: dir,
    value: dirSizes[dir]
  }));

  const ctxTree = document.getElementById('treemapChart').getContext('2d');
  if (treemapChartInstance) treemapChartInstance.destroy();

  treemapChartInstance = new Chart(ctxTree, {
    type: 'treemap',
    data: {
      datasets: [{
        tree: treemapData,
        key: 'value',
        groups: ['name'],
        backgroundColor: (ctx) => {
          if (ctx.type !== 'data') return 'transparent';
          // Generate a color based on the value to make it look nice
          const value = ctx.raw.v;
          const alpha = Math.max(0.3, Math.min(1, value / totalSize));
          return `rgba(59, 130, 246, ${alpha})`; // Blue-ish scale
        },
        borderColor: '#0f172a',
        borderWidth: 1,
        labels: {
          display: true,
          formatter: (ctx) => {
            const name = ctx.raw.g;
            // Shorten name if too long
            const shortName = name.length > 30 ? '...' + name.substring(name.length - 27) : name;
            return [shortName, formatBytes(ctx.raw.v)];
          },
          color: '#ffffff',
          font: { size: 10 }
        }
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              return `${ctx.raw.g}: ${formatBytes(ctx.raw.v)}`;
            }
          }
        }
      }
    }
  });
}

function refreshDiskScanStats() {
  scanStats.textContent = `${foundFiles.length} files found (Total: ${formatBytes(totalSize)})`;
}

function finalizeDiskScanProcess() {
  isScanning = false;
  btnStart.textContent = 'Find Large Files'; btnStart.classList.remove('danger');
  loader.style.display = 'none'; scanProgress.textContent = '';
  refreshVisualCharts();
}

if (window.api) {
  window.api.onScanProgress(({ scanned }) => {
    const text = typeof scanned === 'number' ? `Scanned ${scanned.toLocaleString()} files...` : scanned;
    scanProgress.textContent = text;
    document.getElementById('dupe-progress').textContent = text;
  });

  window.api.onScanResult((file) => {
    file.category = getFileCategoryName(file.name);
    foundFiles.push(file);
    totalSize += file.size;
    
    const rowId = 'row-' + btoa(unescape(encodeURIComponent(file.path))).replace(/=/g, '');
    const tr = document.createElement('tr');
    tr.id = rowId;
    
    const safeInfo = checkSystemFileSafety(file.path);
    tr.innerHTML = `
      <div class="checkbox-wrapper">
        <input type="checkbox" class="row-checkbox" data-path="${file.path.replace(/"/g, '&quot;')}" />
      </div>
      <div class="file-info">
        <div class="file-name" title="Click to open file" onclick="window.api.openFile('${file.path.replace(/\\/g, '\\\\')}')">${file.name}</div>
        <div class="file-meta">
          <span class="badge ${safeInfo.class}">${safeInfo.text}</span>
          <span class="badge category">${file.category}</span>
          <span><strong>${formatBytes(file.size)}</strong></span>
          <span>Used ${Math.floor(file.daysUnused)} days ago</span>
        </div>
        <div class="file-path">${file.path}</div>
      </div>
      <div class="file-actions">
        <button class="secondary action-btn" onclick="window.api.openFolder('${file.path.replace(/\\/g, '\\\\')}')">Open Folder</button>
        <button class="primary action-btn" onclick="askAiAboutFile('${file.path.replace(/\\/g, '\\\\')}', '${file.size}')">Ask AI</button>
      </div>
    `;
    
    tr.querySelector('.row-checkbox').addEventListener('change', (e) => {
      if (e.target.checked) selectedPaths.add(file.path); else selectedPaths.delete(file.path);
      updateDeleteBtn();
    });
    
    resultsBody.appendChild(tr);
    refreshDiskScanStats();
  });

  window.api.onScanComplete(() => {
    finalizeDiskScanProcess();
    document.getElementById('dupe-loader').style.display = 'none';
    document.getElementById('junk-loader').style.display = 'none';
    document.getElementById('dupe-progress').textContent = '';
  });
}

// ----------------------------------------------------
// TAB 2: Duplicate Finder
// ----------------------------------------------------
let duplicatePaths = new Set();
const btnScanDupes = document.getElementById('btn-scan-dupes');
const dupeResults = document.getElementById('dupe-results');
const btnDeleteDupes = document.getElementById('btn-delete-dupes');

btnScanDupes.addEventListener('click', async () => {
  if (!window.api) return;
  document.getElementById('dupe-loader').style.display = 'block';
  dupeResults.innerHTML = '';
  duplicatePaths.clear();
  btnDeleteDupes.style.display = 'none';
  await window.api.startDuplicateScan(folderPathInput.value);
});

if (window.api) {
  window.api.onDuplicateResult(({ hash, files }) => {
    const div = document.createElement('div');
    div.className = 'duplicate-group';
    div.innerHTML = `<h4>Duplicate Group (${formatBytes(files[0].size)})</h4>`;
    
    // Auto-select all but the first one
    files.forEach((file, index) => {
      const isChecked = index > 0;
      if (isChecked) duplicatePaths.add(file.path);
      
      const row = document.createElement('div');
      row.className = 'dupe-row';
      row.innerHTML = `
        <input type="checkbox" class="dupe-cb" data-path="${file.path.replace(/"/g, '&quot;')}" ${isChecked ? 'checked' : ''} />
        <span class="dupe-path">${file.path}</span>
      `;
      row.querySelector('.dupe-cb').addEventListener('change', (e) => {
        if (e.target.checked) duplicatePaths.add(file.path);
        else duplicatePaths.delete(file.path);
        updateDupeDeleteBtn();
      });
      div.appendChild(row);
    });
    
    dupeResults.appendChild(div);
    refreshDuplicateDeleteButton();
  });
}

function refreshDuplicateDeleteButton() {
  btnDeleteDupes.style.display = duplicatePaths.size > 0 ? 'inline-block' : 'none';
  btnDeleteDupes.textContent = `Trash Selected Duplicates (${duplicatePaths.size})`;
}

btnDeleteDupes.addEventListener('click', () => {
  moveSelectedFilesToTrash(Array.from(duplicatePaths), (results) => {
    results.forEach(res => {
      if (res.success) {
        duplicatePaths.delete(res.path);
        const checkbox = document.querySelector(`.dupe-cb[data-path="${res.path.replace(/\\/g, '\\\\')}"]`);
        if (checkbox) checkbox.parentElement.parentElement.remove();
      }
    });
    refreshDuplicateDeleteButton();
  });
});


// ----------------------------------------------------
// TAB 3: Junk Cleaner
// ----------------------------------------------------
let junkPaths = new Set();
const btnScanJunk = document.getElementById('btn-scan-junk');
const junkResultsBody = document.getElementById('junk-results-body');
const btnDeleteJunk = document.getElementById('btn-delete-junk');
const junkSelectAll = document.getElementById('junk-select-all');
const junkSelectAllWrap = document.getElementById('junk-select-all-wrap');

btnScanJunk.addEventListener('click', async () => {
  if (!window.api) return;
  document.getElementById('junk-loader').style.display = 'block';
  junkResultsBody.innerHTML = '';
  junkPaths.clear();
  junkResultsBody.style.display = 'grid';
  junkSelectAllWrap.style.display = 'flex';
  junkSelectAll.checked = false;
  btnDeleteJunk.style.display = 'none';
  await window.api.startJunkScan();
});

if (window.api) {
  window.api.onJunkResult(({ type, path, size }) => {
    const tr = document.createElement('div');
    tr.className = 'file-card';
    tr.innerHTML = `
      <div class="checkbox-wrapper">
        <input type="checkbox" class="junk-cb" data-path="${path.replace(/"/g, '&quot;')}" />
      </div>
      <div class="file-info">
        <div class="file-name">${type}</div>
        <div class="file-meta">
          <span><strong>${formatBytes(size)}</strong></span>
        </div>
        <div class="file-path">${path}</div>
      </div>
    `;
    tr.querySelector('.junk-cb').addEventListener('change', (e) => {
      if (e.target.checked) junkPaths.add(path); else junkPaths.delete(path);
      refreshJunkDeleteButton();
    });
    junkResultsBody.appendChild(tr);
  });
}

junkSelectAll.addEventListener('change', (e) => {
  const isChecked = e.target.checked;
  document.querySelectorAll('.junk-cb').forEach(cb => {
    cb.checked = isChecked;
    const p = cb.dataset.path;
    if (isChecked) junkPaths.add(p); else junkPaths.delete(p);
  });
  refreshJunkDeleteButton();
});

function refreshJunkDeleteButton() {
  btnDeleteJunk.style.display = junkPaths.size > 0 ? 'inline-block' : 'none';
  btnDeleteJunk.textContent = `Clean Selected Junk (${junkPaths.size})`;
}

btnDeleteJunk.addEventListener('click', () => {
  // Caution: We're sending a folder to be trashed. shell.trashItem handles folders too.
  moveSelectedFilesToTrash(Array.from(junkPaths), (results) => {
    results.forEach(res => {
      if (res.success) {
        junkPaths.delete(res.path);
        const cb = document.querySelector(`.junk-cb[data-path="${res.path.replace(/\\/g, '\\\\')}"]`);
        if (cb) cb.parentElement.parentElement.remove();
      }
    });
    refreshJunkDeleteButton();
  });
});

// ----------------------------------------------------
// TAB 4: AI Assistant
// ----------------------------------------------------
const chatMessages = document.getElementById('chat-messages');
const aiPromptInput = document.getElementById('ai-prompt-input');
const btnSendAi = document.getElementById('btn-send-ai');

let conversationHistory = [
  { role: 'system', content: 'You are a helpful IT assistant built into a disk cleaning app called SpaceFinder Premium. The user will ask you questions about files, cleaning up space, and computer maintenance.' }
];

function appendChatMessage(role, text) {
  const div = document.createElement('div');
  div.className = `chat-message ${role}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendAiMessage() {
  const text = aiPromptInput.value.trim();
  if (!text) return;
  
  const apiKey = localStorage.getItem('sf-nvidia-key')?.trim();
  if (!apiKey) {
    alert("Please set your OpenRouter API key in Settings first.");
    return;
  }

  aiPromptInput.value = '';
  appendChatMessage('user', text);
  btnSendAi.disabled = true;
  
  conversationHistory.push({ role: 'user', content: text });
  
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-message assistant';
  loadingDiv.textContent = 'Thinking...';
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (window.api) {
    const response = await window.api.askAI({ apiKey, messages: conversationHistory });
    loadingDiv.remove();
    
    if (response.error) {
      appendChatMessage('assistant', `Error: ${response.error}`);
      conversationHistory.pop(); // remove user message on error to allow retry
    } else {
      const reply = response.choices[0].message.content;
      appendChatMessage('assistant', reply);
      conversationHistory.push({ role: 'assistant', content: reply });
    }
  }
  
  btnSendAi.disabled = false;
  aiPromptInput.focus();
}

btnSendAi.addEventListener('click', sendAiMessage);
aiPromptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendAiMessage();
});

window.askAiAboutFile = function(filePath, sizeBytes) {
  // Switch to AI tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const aiTab = document.querySelector('[data-target="tab-ai"]');
  aiTab.classList.add('active');
  document.getElementById('tab-ai').classList.add('active');
  
  // Format prompt
  const sizeFormatted = formatBytes(sizeBytes);
  const prompt = `I found a file on my computer and I want to free up space. Is it safe to delete this file? Please explain what it is and any risks of deleting it.\n\nFile Path: ${filePath}\nSize: ${sizeFormatted}`;
  
  // Insert and send
  aiPromptInput.value = prompt;
  sendAiMessage();
};
