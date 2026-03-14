/**
 * loader.js — Data loading with multiple fallback strategies
 *
 * Strategy order:
 *   1. Google Sheets gviz/tq JSON endpoint (works if opened from a server)
 *   2. allorigins.win CORS proxy wrapping the CSV export
 *   3. CSV file upload by the user
 *   4. Hardcoded fallback data from data.js
 *
 * The Sheet ID is never hardcoded here — it is always passed in by the
 * caller (read from localStorage by main.js), so each user's settings
 * are stored only in their own browser and never affect anyone else.
 *
 * Depends on: data.js (for parseEntries fallback)
 * Used by:    main.js
 */

const Loader = (() => {

  const TIMEOUT_MS = 8000;

  // Column indices (0-based) matching the TL;DR Reading Log sheet structure.
  // If your sheet has a different layout, adjust these here.
  const COL = { MONTH: 1, DAY: 2, TITLE: 3, AUTHOR: 4, GENRE: 8, TIME: 9, PAGES: 10, THOUGHTS: 15 };

  const MONTH_MAP = {
    january:1, jan:1, february:2, feb:2, march:3, mar:3,
    april:4, apr:4, may:5, june:6, jun:6, july:7, jul:7,
    august:8, aug:8, september:9, sep:9, sept:9,
    october:10, oct:10, november:11, nov:11, december:12, dec:12,
  };

  // ── Sheet ID helpers ────────────────────────────────────────────

  /**
   * Extract a bare Sheet ID from whatever the user pasted —
   * a full URL, a /d/ID/edit URL, or a raw ID string.
   */
  function extractSheetId(input) {
    const s = (input || '').trim();
    const match = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    // If it looks like a bare ID (no slashes), use as-is
    if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
    return null;
  }

  // ── Fetch helpers ────────────────────────────────────────────────

  function fetchWithTimeout(url, ms = TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  // ── Strategy 1: Google gviz JSON ─────────────────────────────────

  async function tryGviz(sheetId, sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const res  = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`gviz HTTP ${res.status}`);
    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)/);
    if (!match) throw new Error('gviz: unexpected response format');
    const json = JSON.parse(match[1]);
    return parseGvizTable(json.table);
  }

  function parseGvizTable(table) {
    const entries = [];
    for (const row of (table.rows || [])) {
      const cells    = row.c || [];
      const monthRaw = String(cells[COL.MONTH]?.v ?? cells[COL.MONTH]?.f ?? '').trim().toLowerCase();
      const dayRaw   = String(cells[COL.DAY]?.v ?? '').trim();
      const monthNum = MONTH_MAP[monthRaw];
      const dayNum   = parseInt(dayRaw, 10);
      if (!monthNum || !dayNum) continue;
      entries.push(buildEntry(monthNum, dayNum, cells, false));
    }
    return entries;
  }

  // ── Strategy 2: allorigins CORS proxy ────────────────────────────

  async function tryProxy(sheetId) {
    const csvUrl   = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(csvUrl)}`;
    const res = await fetchWithTimeout(proxyUrl);
    if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
    const json = await res.json();
    return parseCSVText(json.contents);
  }

  // ── CSV parsing ───────────────────────────────────────────────────

  function parseCSVText(text) {
    const rows    = parseCSV(text);
    const entries = [];
    for (let i = 1; i < rows.length; i++) {
      const r        = rows[i];
      const monthRaw = (r[COL.MONTH] ?? '').trim().toLowerCase();
      const dayRaw   = (r[COL.DAY]   ?? '').trim();
      const monthNum = MONTH_MAP[monthRaw];
      const dayNum   = parseInt(dayRaw, 10);
      if (!monthNum || !dayNum) continue;
      entries.push(buildEntry(monthNum, dayNum, r, true));
    }
    return entries;
  }

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') { inQ = false; }
        else { cell += c; }
      } else {
        if      (c === '"')  { inQ = true; }
        else if (c === ',')  { row.push(cell); cell = ''; }
        else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (c !== '\r') { cell += c; }
      }
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // ── Entry builder ─────────────────────────────────────────────────

  function buildEntry(monthNum, dayNum, source, isArray = false) {
    const get = isArray
      ? (col) => String(source[col] ?? '').trim()
      : (col) => String(source[col]?.v ?? source[col]?.f ?? '').trim();

    return {
      month:    monthNum,
      day:      dayNum,
      dateKey:  `${READING_YEAR}-${String(monthNum).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`,
      date:     new Date(READING_YEAR, monthNum - 1, dayNum),
      title:    get(COL.TITLE),
      author:   get(COL.AUTHOR),
      genre:    get(COL.GENRE),
      time:     get(COL.TIME),
      pages:    parseInt(get(COL.PAGES), 10) || 0,
      thoughts: get(COL.THOUGHTS),
    };
  }

  // ── Strategy 3: File upload ───────────────────────────────────────

  function loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => {
        try { resolve(parseCSVText(e.target.result)); }
        catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsText(file);
    });
  }

  // ── Strategy 4: Hardcoded fallback ────────────────────────────────

  function loadFallback() {
    return parseEntries(); // from data.js
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Try live strategies in order using the provided sheet ID.
   * Falls back to hardcoded data if all live methods fail.
   * @param {string} sheetId   - bare Google Sheet ID
   * @param {string} sheetName - tab name (default 'ReadingLog')
   * @returns {{ entries: Array, source: string }}
   */
  async function loadAuto(sheetId, sheetName = 'ReadingLog') {
    if (sheetId) {
      try {
        const entries = await tryGviz(sheetId, sheetName);
        if (entries.length) return { entries, source: 'gviz' };
        throw new Error('gviz: no entries parsed');
      } catch (e) { console.warn('gviz failed:', e.message); }

      try {
        const entries = await tryProxy(sheetId);
        if (entries.length) return { entries, source: 'proxy' };
        throw new Error('proxy: no entries parsed');
      } catch (e) { console.warn('proxy failed:', e.message); }
    }

    return { entries: loadFallback(), source: 'fallback' };
  }

  /**
   * Load from a user-provided File object (CSV export from Google Sheets).
   */
  async function loadFromUpload(file) {
    const entries = await loadFromFile(file);
    return { entries, source: 'upload' };
  }

  return { loadAuto, loadFromUpload, extractSheetId };
})();