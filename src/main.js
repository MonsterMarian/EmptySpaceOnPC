import './style.css';

document.querySelector('#app').innerHTML = `
  <header>
    <h1>SpaceFinder Premium</h1>
    <p class="subtitle">Find and safely remove large unused files to free up space</p>
  </header>

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
          <button id="btn-select-folder" class="secondary" title="Select Folder">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </button>
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
      
      <div class="input-group" style="align-items: center; justify-content: flex-end; flex-direction: row; gap: 1rem;">
        <span class="scan-progress" id="scan-progress"></span>
        <div class="loader" id="loader"></div>
        <button id="btn-start">Start Scan</button>
      </div>
    </div>
  </section>

  <section class="panel" id="results-panel" style="display: none;">
    <div class="results-header">
      <h2>Found Files</h2>
      <div class="stats" id="scan-stats">0 files found</div>
    </div>
    
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th class="checkbox-cell"><input type="checkbox" id="select-all" /></th>
            <th>File</th>
            <th>Size</th>
            <th>Last Used</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="results-body">
          <!-- Results will go here -->
        </tbody>
      </table>
    </div>
    
    <div class="bottom-actions">
      <button id="btn-delete-selected" class="danger" disabled>Delete Selected</button>
    </div>
  </section>
`;

// State
let isScanning = false;
let foundFiles = [];
let totalSize = 0;
let selectedPaths = new Set();

// Elements
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

// Load preferences
window.addEventListener('DOMContentLoaded', () => {
  const savedFolder = localStorage.getItem('sf-folder');
  const savedSize = localStorage.getItem('sf-size');
  const savedDays = localStorage.getItem('sf-days');
  if (savedFolder) folderPathInput.value = savedFolder;
  if (savedSize) minSizeInput.value = savedSize;
  if (savedDays) minDaysInput.value = savedDays;
});

// Save preferences on change
function savePrefs() {
  localStorage.setItem('sf-folder', folderPathInput.value);
  localStorage.setItem('sf-size', minSizeInput.value);
  localStorage.setItem('sf-days', minDaysInput.value);
}
[folderPathInput, minSizeInput, minDaysInput].forEach(el => el.addEventListener('change', savePrefs));

// Format size helper
function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Safety check helper
function getSafetyInfo(filePath) {
  const lowerPath = filePath.toLowerCase();
  const isSystem = lowerPath.includes('\\windows\\') || 
                   lowerPath.includes('\\program files') || 
                   lowerPath.includes('\\appdata\\');
  
  if (isSystem) {
    return { class: 'warning', text: 'SYSTEM (UNSAFE)' };
  }
  return { class: 'safe', text: 'SAFE' };
}

// Presets
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const preset = btn.dataset.preset;
    if (preset === 'videos') {
      minSizeInput.value = '500';
      minDaysInput.value = '60';
    } else if (preset === 'installers') {
      minSizeInput.value = '100';
      minDaysInput.value = '30';
    } else if (preset === 'huge') {
      minSizeInput.value = '1024';
      minDaysInput.value = '90';
    }
    savePrefs();
  });
});

// Select folder handler
btnSelectFolder.addEventListener('click', async () => {
  if (window.api) {
    const selected = await window.api.selectFolder();
    if (selected) {
      folderPathInput.value = selected;
      savePrefs();
    }
  } else {
    alert("API not found, run in Electron!");
  }
});

// Start/Stop scan handler
btnStart.addEventListener('click', async () => {
  if (!window.api) {
    alert("Running outside Electron. API is not available.");
    return;
  }

  if (isScanning) {
    await window.api.stopScan();
    finishScan();
    return;
  }

  isScanning = true;
  foundFiles = [];
  totalSize = 0;
  selectedPaths.clear();
  updateDeleteBtn();
  
  btnStart.textContent = 'Stop Scan';
  btnStart.classList.add('danger');
  loader.style.display = 'block';
  scanProgress.textContent = '';
  
  resultsPanel.style.display = 'block';
  resultsBody.innerHTML = '';
  selectAllCheckbox.checked = false;
  updateStats();
  
  const options = {
    folderPath: folderPathInput.value,
    minSizeMB: parseFloat(minSizeInput.value),
    minDaysUnused: parseFloat(minDaysInput.value)
  };
  
  await window.api.startScan(options);
});

// Delete files wrapper
async function deleteFiles(paths) {
  if (paths.length === 0) return;
  const msg = `Move ${paths.length} file(s) to the Recycle Bin?`;
  if (!confirm(msg)) return;
  
  const results = await window.api.trashFiles(paths);
  
  // Remove successful deletes from UI
  results.forEach(res => {
    if (res.success) {
      const idx = foundFiles.findIndex(f => f.path === res.path);
      if (idx !== -1) {
        totalSize -= foundFiles[idx].size;
        foundFiles.splice(idx, 1);
      }
      selectedPaths.delete(res.path);
      // Remove row
      const row = document.getElementById('row-' + btoa(unescape(encodeURIComponent(res.path))).replace(/=/g, ''));
      if (row) row.remove();
    } else {
      console.error("Failed to trash:", res.path, res.error);
    }
  });
  
  updateStats();
  updateDeleteBtn();
}

btnDeleteSelected.addEventListener('click', () => {
  deleteFiles(Array.from(selectedPaths));
});

selectAllCheckbox.addEventListener('change', (e) => {
  const isChecked = e.target.checked;
  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.checked = isChecked;
    const path = cb.dataset.path;
    if (isChecked) selectedPaths.add(path);
    else selectedPaths.delete(path);
  });
  updateDeleteBtn();
});

function updateDeleteBtn() {
  btnDeleteSelected.disabled = selectedPaths.size === 0;
  btnDeleteSelected.textContent = `Delete Selected (${selectedPaths.size})`;
}

if (window.api) {
  window.api.onScanProgress(({ scanned }) => {
    scanProgress.textContent = `Scanned ${scanned.toLocaleString()} files...`;
  });

  window.api.onScanResult((file) => {
    foundFiles.push(file);
    totalSize += file.size;
    
    const rowId = 'row-' + btoa(unescape(encodeURIComponent(file.path))).replace(/=/g, '');
    const tr = document.createElement('tr');
    tr.id = rowId;
    
    // Checkbox
    const tdCheck = document.createElement('td');
    tdCheck.className = 'checkbox-cell';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'row-checkbox';
    cb.dataset.path = file.path;
    cb.addEventListener('change', (e) => {
      if (e.target.checked) selectedPaths.add(file.path);
      else selectedPaths.delete(file.path);
      updateDeleteBtn();
    });
    tdCheck.appendChild(cb);
    
    // File Info
    const tdFile = document.createElement('td');
    const safeInfo = getSafetyInfo(file.path);
    tdFile.innerHTML = `
      <div class="file-name" title="Click to open file" onclick="window.api.openFile('${file.path.replace(/\\/g, '\\\\')}')">
        ${file.name} <span class="badge ${safeInfo.class}">${safeInfo.text}</span>
      </div>
      <div class="file-path">${file.path}</div>
    `;
    
    // Size
    const tdSize = document.createElement('td');
    tdSize.textContent = formatBytes(file.size);
    
    // Date
    const tdDate = document.createElement('td');
    const date = new Date(file.lastUsedMs);
    tdDate.textContent = `${date.toLocaleDateString()} (${Math.floor(file.daysUnused)} days ago)`;
    
    // Action
    const tdAction = document.createElement('td');
    
    const btnOpen = document.createElement('button');
    btnOpen.className = 'secondary action-btn';
    btnOpen.textContent = 'Folder';
    btnOpen.onclick = () => window.api.openFolder(file.path);
    
    const btnDel = document.createElement('button');
    btnDel.className = 'danger action-btn';
    btnDel.textContent = 'Delete';
    btnDel.onclick = () => deleteFiles([file.path]);
    
    tdAction.appendChild(btnOpen);
    tdAction.appendChild(btnDel);
    
    tr.appendChild(tdCheck);
    tr.appendChild(tdFile);
    tr.appendChild(tdSize);
    tr.appendChild(tdDate);
    tr.appendChild(tdAction);
    
    resultsBody.appendChild(tr);
    updateStats();
  });

  window.api.onScanComplete(() => {
    finishScan();
  });
}

function updateStats() {
  scanStats.textContent = `${foundFiles.length} files found (Total: ${formatBytes(totalSize)})`;
}

function finishScan() {
  isScanning = false;
  btnStart.textContent = 'Start Scan';
  btnStart.classList.remove('danger');
  loader.style.display = 'none';
  scanProgress.textContent = '';
}
