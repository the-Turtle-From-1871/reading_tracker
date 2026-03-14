/**
 * main.js — App entry point
 *
 * Orchestrates data loading, stat calculation, and rendering.
 * Sheet ID is stored in localStorage so each user's settings
 * stay in their own browser and never affect anyone else.
 *
 * Depends on: data.js, loader.js, tooltip.js, charts.js
 */

// ── localStorage keys ─────────────────────────────────────────────
const LS_SHEET_ID   = 'readingTracker_sheetId';
const LS_SHEET_NAME = 'readingTracker_sheetName';

// ── Date helpers ──────────────────────────────────────────────────

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDateShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Settings panel ─────────────────────────────────────────────────

function loadSettings() {
  return {
    sheetId:   localStorage.getItem(LS_SHEET_ID)   || '',
    sheetName: localStorage.getItem(LS_SHEET_NAME) || 'ReadingLog',
  };
}

function saveSettings(sheetId, sheetName) {
  localStorage.setItem(LS_SHEET_ID,   sheetId);
  localStorage.setItem(LS_SHEET_NAME, sheetName);
}

function populateSettingsFields() {
  const { sheetId, sheetName } = loadSettings();
  document.getElementById('settings-sheet-url').value  = sheetId;
  document.getElementById('settings-sheet-name').value = sheetName;
  updateSheetPreview(sheetId);
}

function updateSheetPreview(sheetId) {
  const preview = document.getElementById('sheet-id-preview');
  if (sheetId) {
    preview.textContent = `ID: ${sheetId}`;
    preview.style.color = 'var(--green)';
  } else {
    preview.textContent = 'No sheet configured — using built-in data';
    preview.style.color = 'var(--muted)';
  }
}

function wireSettingsPanel() {
  const toggle   = document.getElementById('settings-toggle');
  const panel    = document.getElementById('settings-panel');
  const saveBtn  = document.getElementById('settings-save');
  const clearBtn = document.getElementById('settings-clear');
  const urlInput = document.getElementById('settings-sheet-url');

  // Toggle open/close — use a class instead of reading inline style,
  // which can return '' vs 'none' inconsistently across browsers.
  toggle.addEventListener('click', () => {
    const isOpen = panel.classList.contains('is-open');
    panel.classList.toggle('is-open', !isOpen);
    toggle.textContent = isOpen ? '⚙ Settings' : '✕ Close';
  });

  // Live-extract ID as user types
  urlInput.addEventListener('input', () => {
    const extracted = Loader.extractSheetId(urlInput.value);
    updateSheetPreview(extracted || '');
  });

  // Save
  saveBtn.addEventListener('click', async () => {
    const raw       = urlInput.value.trim();
    const sheetId   = Loader.extractSheetId(raw) || raw;
    const sheetName = document.getElementById('settings-sheet-name').value.trim() || 'ReadingLog';

    if (!sheetId) {
      showSettingsError('Please enter a Google Sheet URL or ID.');
      return;
    }

    saveSettings(sheetId, sheetName);
    updateSheetPreview(sheetId);
    panel.classList.remove('is-open');
    toggle.textContent  = '⚙ Settings';

    // Re-sync with new sheet
    await syncData();
  });

  // Clear — removes saved settings and reloads with fallback data
  clearBtn.addEventListener('click', () => {
    localStorage.removeItem(LS_SHEET_ID);
    localStorage.removeItem(LS_SHEET_NAME);
    urlInput.value = '';
    document.getElementById('settings-sheet-name').value = 'ReadingLog';
    updateSheetPreview('');
    showSettingsError('');
    renderAll(parseEntries());
    setImportStatus('fallback', parseEntries().length);
  });
}

function showSettingsError(msg) {
  document.getElementById('settings-error').textContent = msg;
}

// ── Status panel ──────────────────────────────────────────────────

const STATUS_LABELS = {
  gviz:     { icon: '🟢', text: 'Live — synced directly from Google Sheets' },
  proxy:    { icon: '🟡', text: 'Live — synced via CORS proxy' },
  upload:   { icon: '🔵', text: 'Loaded from uploaded CSV file' },
  fallback: { icon: '🟠', text: 'Using built-in demo data — configure your sheet in Settings' },
};

function setImportStatus(source, entryCount) {
  const panel = document.getElementById('import-panel');
  const s = STATUS_LABELS[source] ?? STATUS_LABELS.fallback;
  document.getElementById('import-status-icon').textContent = s.icon;
  document.getElementById('import-status-text').textContent = s.text;
  document.getElementById('import-entry-count').textContent = `${entryCount} sessions loaded`;

  const resyncBtn = document.getElementById('resync-btn');
  resyncBtn.style.display = (source === 'gviz' || source === 'proxy') ? 'inline-block' : 'none';

  panel.classList.remove('panel-loading', 'panel-ok', 'panel-warn');
  panel.classList.add(source === 'fallback' ? 'panel-warn' : 'panel-ok');
}

function setImportLoading(msg) {
  const panel = document.getElementById('import-panel');
  panel.classList.remove('panel-ok', 'panel-warn');
  panel.classList.add('panel-loading');
  document.getElementById('import-status-icon').textContent = '⏳';
  document.getElementById('import-status-text').textContent = msg;
  document.getElementById('import-entry-count').textContent = '';
}

// ── Stats ─────────────────────────────────────────────────────────

function calculateStreaks(sortedDates) {
  const dateSet = new Set(sortedDates.map(d => d.dateKey));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let currentStreak = 0;
  const check = new Date(today);
  while (dateSet.has(dateKey(check))) {
    currentStreak++;
    check.setDate(check.getDate() - 1);
  }

  let longestStreak = 0, tempStreak = 0, prev = null;
  for (const d of sortedDates) {
    if (prev) {
      const diff = (d.date - prev.date) / 86_400_000;
      tempStreak = diff === 1 ? tempStreak + 1 : 1;
    } else {
      tempStreak = 1;
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;
    prev = d;
  }

  return { currentStreak, longestStreak };
}

function updateStats(sortedDates, entries) {
  const totalPages = sortedDates.reduce((sum, d) => sum + d.pages, 0);
  const readDays   = sortedDates.length;
  const avgPages   = readDays ? Math.round(totalPages / readDays) : 0;
  const bestDay    = sortedDates.reduce((b, d) => d.pages > (b?.pages ?? 0) ? d : b, null);
  const allTitles  = [...new Set(entries.map(e => e.title).filter(Boolean))];
  const { currentStreak, longestStreak } = calculateStreaks(sortedDates);

  document.getElementById('stat-pages').textContent    = totalPages.toLocaleString();
  document.getElementById('stat-days').textContent     = readDays;
  document.getElementById('stat-books').textContent    = allTitles.length;
  document.getElementById('stat-avg').textContent      = avgPages;
  document.getElementById('stat-best').textContent     = bestDay ? bestDay.pages : '—';
  document.getElementById('stat-best-sub').textContent = bestDay ? formatDateShort(bestDay.date) : 'pages';
  document.getElementById('stat-streak').textContent   = longestStreak || '0';

  updateStreakBanner(currentStreak, longestStreak);
}

function updateStreakBanner(currentStreak, longestStreak) {
  const banner = document.getElementById('streak-banner');
  if (currentStreak >= 2) {
    banner.style.display     = 'flex';
    banner.style.background  = 'linear-gradient(135deg, #1c1804, #251f05)';
    banner.style.borderColor = 'var(--accent2)';
    document.querySelector('.streak-icon').textContent  = '🔥';
    document.getElementById('streak-text').textContent = `${currentStreak}-day reading streak!`;
    document.getElementById('streak-sub').textContent  = `Longest: ${longestStreak} day${longestStreak !== 1 ? 's' : ''} · Keep going!`;
  } else if (longestStreak >= 2) {
    banner.style.display     = 'flex';
    banner.style.background  = 'linear-gradient(135deg, #141414, #1c1c1c)';
    banner.style.borderColor = 'var(--border)';
    document.querySelector('.streak-icon').textContent  = '📖';
    document.getElementById('streak-text').textContent = `Best streak: ${longestStreak} days`;
    document.getElementById('streak-sub').textContent  = `Keep adding to your log to track new streaks!`;
  }
}

// ── Render pipeline ───────────────────────────────────────────────

function renderAll(entries) {
  const byDate      = aggregateByDate(entries);
  const sortedDates = Object.values(byDate).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  updateStats(sortedDates, entries);
  Charts.renderHeatmap(byDate, READING_YEAR);
  Charts.renderBarChart(byDate);
  Charts.renderBooks(entries);
}

// ── Sync ──────────────────────────────────────────────────────────

async function syncData() {
  const { sheetId, sheetName } = loadSettings();
  const label = sheetId ? 'Connecting to Google Sheets…' : 'Loading built-in data…';
  setImportLoading(label);
  const { entries, source } = await Loader.loadAuto(sheetId, sheetName);
  renderAll(entries);
  setImportStatus(source, entries.length);
}

// ── Event wiring ──────────────────────────────────────────────────

function wireUploadButton() {
  const input = document.getElementById('csv-upload');
  const btn   = document.getElementById('upload-btn');

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    setImportLoading(`Reading ${file.name}…`);
    try {
      const { entries, source } = await Loader.loadFromUpload(file);
      renderAll(entries);
      setImportStatus(source, entries.length);
    } catch (e) {
      document.getElementById('import-status-text').textContent = `Upload failed: ${e.message}`;
      document.getElementById('import-panel').classList.add('panel-warn');
    }
    input.value = '';
  });
}

function wireResyncButton() {
  document.getElementById('resync-btn').addEventListener('click', syncData);
}

function wireDragDrop() {
  const zone = document.getElementById('drop-zone');
  zone.addEventListener('dragover',  e  => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', async e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setImportLoading(`Reading ${file.name}…`);
    try {
      const { entries, source } = await Loader.loadFromUpload(file);
      renderAll(entries);
      setImportStatus(source, entries.length);
    } catch (err) {
      document.getElementById('import-status-text').textContent = `Upload failed: ${err.message}`;
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────

async function init() {
  populateSettingsFields();
  wireSettingsPanel();
  wireUploadButton();
  wireResyncButton();
  wireDragDrop();
  await syncData();
}

init();