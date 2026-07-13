import './style.css';
import Chart from 'chart.js/auto';
import { TreemapController, TreemapElement } from 'chartjs-chart-treemap';

Chart.register(TreemapController, TreemapElement);

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
  if (isScanning) {
    await window.api.stopScan();
    finalizeDiskScanProcess();
    return;
  }

  isScanning = true;
  foundFiles = [];
  totalSize = 0;
  selectedPaths.clear();
  updateDeleteBtn();
  
  btnStart.textContent = 'Cancel Scan';
  btnStart.classList.add('danger');
  loader.style.display = 'block';
  scanProgress.textContent = 'Analyzing disk...';
  resultsPanel.style.display = 'block';
  chartContainer.style.display = 'none';
  resultsBody.innerHTML = '';
  selectAllCheckbox.checked = false;
  refreshDiskScanStats();
  
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
        if (idx !== -1) {
          totalSize -= foundFiles[idx].size;
          foundFiles.splice(idx, 1);
        }
        selectedPaths.delete(res.path);
        const row = document.getElementById('row-' + btoa(unescape(encodeURIComponent(res.path))).replace(/=/g, ''));
        if (row) row.remove();
      }
    });
    refreshDiskScanStats();
    updateDeleteBtn();
    refreshVisualCharts();
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

// Event Delegation for Disk Scanner Results
resultsBody.addEventListener('click', (e) => {
  const target = e.target;
  
  // Handling open folder button
  if (target.classList.contains('btn-open-folder')) {
    window.api.openFolder(target.dataset.filePath);
    return;
  }
  
  // Handling file open (on file name)
  if (target.classList.contains('file-name')) {
    window.api.openFile(target.dataset.filePath);
    return;
  }

  // Handling Ask AI button
  if (target.classList.contains('ai-ask-btn')) {
    askAiAboutFile(target.dataset.filePath, target.dataset.fileSize, target.dataset.fileName);
    return;
  }
});

resultsBody.addEventListener('change', (e) => {
  if (e.target.classList.contains('row-checkbox')) {
    const path = e.target.dataset.path;
    if (e.target.checked) {
      selectedPaths.add(path);
    } else {
      selectedPaths.delete(path);
    }
    updateDeleteBtn();
  }
});

if (window.api) {
  window.api.onScanProgress(({ scanned }) => {
    const text = typeof scanned === 'number' ? `Scanned ${scanned.toLocaleString()} files...` : scanned;
    scanProgress.textContent = text;
    document.getElementById('dupe-progress').textContent = text;
  });

  window.api.onScanResultsBatch((batch) => {
    const fragment = document.createDocumentFragment();
    
    batch.forEach(file => {
      file.category = getFileCategoryName(file.name);
      foundFiles.push(file);
      totalSize += file.size;
      
      const rowId = 'row-' + btoa(unescape(encodeURIComponent(file.path))).replace(/=/g, '');
      const card = document.createElement('div');
      card.className = 'file-card';
      card.id = rowId;
      
      const safeInfo = checkSystemFileSafety(file.path);
      const escapedPath = file.path.replace(/"/g, '&quot;');
      const displayName = file.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      card.innerHTML = `
        <div class="checkbox-wrapper">
          <input type="checkbox" class="row-checkbox" data-path="${escapedPath}" />
        </div>
        <div class="file-info">
          <div class="file-name" title="Click to open file" data-file-path="${escapedPath}">${displayName}</div>
          <div class="file-meta">
            <span class="badge ${safeInfo.class}">${safeInfo.text}</span>
            <span class="badge category">${file.category}</span>
            <span><strong>${formatBytes(file.size)}</strong></span>
            <span>Unused ${Math.floor(file.daysUnused)} days</span>
          </div>
          <div class="file-path">${file.path}</div>
        </div>
        <div class="file-actions">
          <button class="secondary action-btn btn-open-folder" data-file-path="${escapedPath}">Open Folder</button>
          <button class="ai-ask-btn action-btn" data-file-path="${escapedPath}" data-file-size="${file.size}" data-file-name="${displayName}">🤖 Ask AI</button>
        </div>
      `;
      fragment.appendChild(card);
    });
    
    resultsBody.appendChild(fragment);
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

// Event Delegation for Duplicates
dupeResults.addEventListener('change', (e) => {
  if (e.target.classList.contains('dupe-cb')) {
    const path = e.target.dataset.path;
    if (e.target.checked) duplicatePaths.add(path);
    else duplicatePaths.delete(path);
    updateDupeDeleteBtn();
  }
});

dupeResults.addEventListener('click', (e) => {
  if (e.target.classList.contains('ai-ask-btn')) {
    askAiAboutFile(e.target.dataset.filePath, e.target.dataset.fileSize, e.target.dataset.fileName);
  }
});

if (window.api) {
  window.api.onDuplicateBatch((batch) => {
    const fragment = document.createDocumentFragment();
    
    batch.forEach(({ hash, files }) => {
      const div = document.createElement('div');
      div.className = 'duplicate-group';
      div.innerHTML = `<h4>Duplicate Group (${formatBytes(files[0].size)})</h4>`;
      
      // Auto-select all but the first one
      files.forEach((file, index) => {
        const isChecked = index > 0;
        if (isChecked) duplicatePaths.add(file.path);
        
        const row = document.createElement('div');
        row.className = 'dupe-row';
        const fileName = file.path.split('\\').pop().split('/').pop();
        const escapedPath = file.path.replace(/"/g, '&quot;');
        
        row.innerHTML = `
          <input type="checkbox" class="dupe-cb" data-path="${escapedPath}" ${isChecked ? 'checked' : ''} />
          <span class="dupe-path" style="flex:1;">${file.path}</span>
          <button class="ai-ask-btn action-btn" data-file-path="${escapedPath}" data-file-size="${file.size}" data-file-name="${fileName.replace(/"/g, '&quot;')}">🤖 Ask AI</button>
        `;
        div.appendChild(row);
      });
      
      fragment.appendChild(div);
    });
    
    dupeResults.appendChild(fragment);
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

// Event Delegation for Junk
junkResultsBody.addEventListener('change', (e) => {
  if (e.target.classList.contains('junk-cb')) {
    const path = e.target.dataset.path;
    if (e.target.checked) junkPaths.add(path);
    else junkPaths.delete(path);
    refreshJunkDeleteButton();
  }
});

junkResultsBody.addEventListener('click', (e) => {
  if (e.target.classList.contains('ai-ask-btn')) {
    askAiAboutFile(e.target.dataset.filePath, e.target.dataset.fileSize, e.target.dataset.fileName, true);
  }
});

if (window.api) {
  window.api.onJunkBatch((batch) => {
    const fragment = document.createDocumentFragment();
    
    batch.forEach(({ type, path, size }) => {
      const tr = document.createElement('div');
      tr.className = 'file-card';
      const escapedPath = path.replace(/"/g, '&quot;');
      tr.innerHTML = `
        <div class="checkbox-wrapper">
          <input type="checkbox" class="junk-cb" data-path="${escapedPath}" />
        </div>
        <div class="file-info">
          <div class="file-name">${type}</div>
          <div class="file-meta">
            <span><strong>${formatBytes(size)}</strong></span>
          </div>
          <div class="file-path">${path}</div>
        </div>
        <div class="file-actions">
          <button class="ai-ask-btn action-btn" data-file-path="${escapedPath}" data-file-size="${size}" data-file-name="${type.replace(/"/g, '&quot;')}">🤖 Ask AI</button>
        </div>
      `;
      fragment.appendChild(tr);
    });
    
    junkResultsBody.appendChild(fragment);
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

window.askAiAboutFile = async function(filePath, sizeBytes, fileName, isDirectory = false) {
  // Switch to AI tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const aiTab = document.querySelector('[data-target="tab-ai"]');
  aiTab.classList.add('active');
  document.getElementById('tab-ai').classList.add('active');

  // Show loading state in chat
  const loadingNote = document.createElement('div');
  loadingNote.className = 'chat-message assistant';
  loadingNote.textContent = `Loading metadata for: ${fileName || filePath.split('\\').pop()}...`;
  chatMessages.appendChild(loadingNote);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Fetch real metadata from disk
  let metaContext = '';
  if (window.api && window.api.getFileMetadata) {
    try {
      const meta = await window.api.getFileMetadata(filePath);
      if (!meta.error) {
        metaContext += `\n- Extension: ${meta.extension || '(none)'}\n- Size: ${formatBytes(meta.size)}\n- Created: ${new Date(meta.created).toLocaleString()}\n- Modified: ${new Date(meta.modified).toLocaleString()}\n- Last Accessed: ${new Date(meta.accessed).toLocaleString()}`;
        if (meta.preview) {
          metaContext += `\n- Content Preview (first 500 chars):\n\`\`\`\n${meta.preview}\n\`\`\``;
        }
      }
    } catch (e) {
      console.error('Error fetching metadata for AI:', e);
    }
  }

  loadingNote.remove();

  // Build rich prompt
  const sizeFormatted = formatBytes(sizeBytes);
  const fileType = isDirectory ? 'directory/cache on disk' : 'file';
  const prompt = `Please analyze this ${fileType} and tell me:\n1. What is this ${fileType} and what is its purpose?\n2. Is it safe to delete it?\n3. What are the risks of deleting it?\n4. Do you recommend deleting it to free up space?\n\nPath: ${filePath}\nName: ${fileName || filePath.split('\\').pop()}${metaContext}`;

  // Insert and send
  aiPromptInput.value = prompt;
  sendAiMessage();
};
