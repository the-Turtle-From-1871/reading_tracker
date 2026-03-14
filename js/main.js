/**
 * main.js — App entry point
 *
 * Orchestrates data loading, stat calculation, and rendering.
 * Depends on: data.js, loader.js, tooltip.js, charts.js
 */

// ── Date helpers ──────────────────────────────────────────────────

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDateShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function formatDateLong(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Status panel ──────────────────────────────────────────────────

const STATUS_LABELS = {
  gviz:     { icon: '🟢', text: 'Live — synced directly from Google Sheets' },
  proxy:    { icon: '🟡', text: 'Live — synced via CORS proxy' },
  upload:   { icon: '🔵', text: 'Loaded from uploaded CSV file' },
  fallback: { icon: '🟠', text: 'Using built-in data — live sync unavailable' },
};

function setImportStatus(source, entryCount) {
  const panel = document.getElementById('import-panel');
  const s = STATUS_LABELS[source] ?? STATUS_LABELS.fallback;
  document.getElementById('import-status-icon').textContent = s.icon;
  document.getElementById('import-status-text').textContent = s.text;
  document.getElementById('import-entry-count').textContent = `${entryCount} sessions loaded`;

  // Show the re-sync button only when live sync actually worked
  const resyncBtn = document.getElementById('resync-btn');
  resyncBtn.style.display = (source === 'gviz' || source === 'proxy') ? 'inline-block' : 'none';

  panel.classList.remove('panel-loading');
  panel.classList.add(source === 'fallback' ? 'panel-warn' : 'panel-ok');
}

function setImportLoading(msg) {
  const panel = document.getElementById('import-panel');
  panel.classList.add('panel-loading');
  panel.classList.remove('panel-ok', 'panel-warn');
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
  const byDate      = aggregateByDate(entries);           // data.js
  const sortedDates = Object.values(byDate).sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  updateStats(sortedDates, entries);
  Charts.renderHeatmap(byDate, READING_YEAR);             // charts.js
  Charts.renderBarChart(byDate);                          // charts.js
  Charts.renderBooks(entries);                            // charts.js
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
    input.value = ''; // reset so same file can be re-uploaded
  });
}

function wireResyncButton() {
  document.getElementById('resync-btn').addEventListener('click', async () => {
    setImportLoading('Re-syncing from Google Sheets…');
    try {
      const { entries, source } = await Loader.loadAuto();
      renderAll(entries);
      setImportStatus(source, entries.length);
    } catch (e) {
      document.getElementById('import-status-text').textContent = `Sync failed: ${e.message}`;
    }
  });
}

function wireDragDrop() {
  const zone = document.getElementById('drop-zone');

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
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
  wireUploadButton();
  wireResyncButton();
  wireDragDrop();

  setImportLoading('Connecting to Google Sheets…');
  const { entries, source } = await Loader.loadAuto();
  renderAll(entries);
  setImportStatus(source, entries.length);
}

init();