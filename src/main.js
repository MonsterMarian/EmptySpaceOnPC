import './style.css';

document.querySelector('#app').innerHTML = `
  <header>
    <h1>SpaceFinder Premium</h1>
    <p class="subtitle">Find and remove large unused files to free up space</p>
  </header>

  <section class="panel">
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
  </section>
`;

// State
let isScanning = false;
let foundFiles = [];
let totalSize = 0;

// Elements
const folderPathInput = document.getElementById('folder-path');
const btnSelectFolder = document.getElementById('btn-select-folder');
const minSizeInput = document.getElementById('min-size');
const minDaysInput = document.getElementById('min-days');
const btnStart = document.getElementById('btn-start');
const loader = document.getElementById('loader');
const resultsPanel = document.getElementById('results-panel');
const resultsBody = document.getElementById('results-body');
const scanStats = document.getElementById('scan-stats');

// Format size helper
function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return \`\${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} \${sizes[i]}\`;
}

// Select folder handler
btnSelectFolder.addEventListener('click', async () => {
  if (window.api) {
    const selected = await window.api.selectFolder();
    if (selected) {
      folderPathInput.value = selected;
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
    // Stop
    await window.api.stopScan();
    finishScan();
    return;
  }

  // Start
  isScanning = true;
  foundFiles = [];
  totalSize = 0;
  
  btnStart.textContent = 'Stop Scan';
  btnStart.classList.add('danger');
  loader.style.display = 'block';
  
  resultsPanel.style.display = 'block';
  resultsBody.innerHTML = '';
  updateStats();
  
  const options = {
    folderPath: folderPathInput.value,
    minSizeMB: parseFloat(minSizeInput.value),
    minDaysUnused: parseFloat(minDaysInput.value)
  };
  
  await window.api.startScan(options);
});

// Handle incoming scan results
if (window.api) {
  window.api.onScanResult((file) => {
    foundFiles.push(file);
    totalSize += file.size;
    
    // Create row
    const tr = document.createElement('tr');
    
    const tdFile = document.createElement('td');
    tdFile.innerHTML = \`<div class="file-name">\${file.name}</div><div class="file-path">\${file.path}</div>\`;
    
    const tdSize = document.createElement('td');
    tdSize.textContent = formatBytes(file.size);
    
    const tdDate = document.createElement('td');
    const date = new Date(file.lastUsedMs);
    tdDate.textContent = \`\${date.toLocaleDateString()} (\${Math.floor(file.daysUnused)} days ago)\`;
    
    const tdAction = document.createElement('td');
    const btnOpen = document.createElement('button');
    btnOpen.className = 'secondary action-btn';
    btnOpen.textContent = 'Open Folder';
    btnOpen.onclick = () => {
      window.api.openFolder(file.path);
    };
    tdAction.appendChild(btnOpen);
    
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
  scanStats.textContent = \`\${foundFiles.length} files found (Total: \${formatBytes(totalSize)})\`;
}

function finishScan() {
  isScanning = false;
  btnStart.textContent = 'Start Scan';
  btnStart.classList.remove('danger');
  loader.style.display = 'none';
}
