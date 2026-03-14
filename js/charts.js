/**
 * charts.js — Rendering functions for the heatmap and bar chart
 *
 * Depends on: Tooltip (tooltip.js)
 * Used by: main.js
 */

const Charts = (() => {
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ── Helpers ──────────────────────────────────────────────────────

  function _dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Map a page count to a heat level 0–4 relative to the max */
  function _heatLevel(pages, maxPages) {
    if (pages <= 0) return 0;
    const ratio = pages / maxPages;
    if (ratio < 0.25) return 1;
    if (ratio < 0.50) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  }

  /**
   * Build the full year's week grid, grouped by month.
   * Returns { monthGroups: { [monthIndex]: week[][] }, todayKey: string }
   */
  function _buildYearGrid(year) {
    const start = new Date(year, 0, 1);

    // Pad back to the nearest Sunday
    const firstCell = new Date(start);
    firstCell.setDate(firstCell.getDate() - start.getDay());

    const weeks = [];
    const cur = new Date(firstCell);
    while (true) {
      const week = [];
      for (let d = 0; d < 7; d++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
      weeks.push(week);
      if (cur.getFullYear() > year) break;
    }

    // Group weeks by the month of their first in-year day
    const monthGroups = {};
    for (const week of weeks) {
      const yearDays = week.filter(d => d.getFullYear() === year);
      if (!yearDays.length) continue;
      const m = yearDays[0].getMonth();
      if (!monthGroups[m]) monthGroups[m] = [];
      monthGroups[m].push(week);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return { monthGroups, todayKey: _dateKey(today) };
  }

  // ── Public: Heatmap ───────────────────────────────────────────────

  /**
   * Render the full-year heatmap into #cal-outer.
   * @param {Object} byDate  - aggregated day map from data.js
   * @param {number} year
   */
  function renderHeatmap(byDate, year) {
    const outer = document.getElementById('cal-outer');
    outer.innerHTML = '';

    const allPages = Object.values(byDate).map(d => d.pages).filter(p => p > 0);
    const maxPages = Math.max(...allPages, 1);
    const { monthGroups, todayKey } = _buildYearGrid(year);

    // Day-of-week labels
    const leftCol = document.createElement('div');
    leftCol.className = 'cal-left';
    ['', 'M', '', 'W', '', 'F', ''].forEach(label => {
      const el = document.createElement('div');
      el.className = 'dow-label';
      el.textContent = label;
      leftCol.appendChild(el);
    });
    outer.appendChild(leftCol);

    // Month columns
    const monthsDiv = document.createElement('div');
    monthsDiv.className = 'cal-months';

    for (let m = 0; m < 12; m++) {
      const weeks = monthGroups[m];
      if (!weeks?.length) continue;

      const monthDiv = document.createElement('div');
      monthDiv.className = 'cal-month';

      const label = document.createElement('div');
      label.className = 'month-label';
      label.textContent = MONTH_NAMES[m];
      monthDiv.appendChild(label);

      const weeksDiv = document.createElement('div');
      weeksDiv.className = 'month-weeks';

      for (const week of weeks) {
        const weekDiv = document.createElement('div');
        weekDiv.className = 'cal-week';

        for (const day of week) {
          weekDiv.appendChild(_buildDayCell(day, year, byDate, maxPages, todayKey));
        }
        weeksDiv.appendChild(weekDiv);
      }

      monthDiv.appendChild(weeksDiv);
      monthsDiv.appendChild(monthDiv);
    }

    outer.appendChild(monthsDiv);
  }

  /** Create a single heatmap day cell element */
  function _buildDayCell(day, year, byDate, maxPages, todayKey) {
    const cell = document.createElement('div');
    cell.className = 'day-cell';

    const inYear = day.getFullYear() === year;
    if (!inYear) {
      cell.style.opacity = '0';
      cell.style.pointerEvents = 'none';
      cell.dataset.level = '0';
      return cell;
    }

    const key   = _dateKey(day);
    const entry = byDate[key];
    cell.dataset.level = _heatLevel(entry?.pages ?? 0, maxPages);

    if (key === todayKey) cell.classList.add('today-cell');

    if (entry) {
      cell.classList.add('has-data');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('aria-label', `${day.toDateString()}: ${entry.pages} pages`);
      cell.addEventListener('mouseenter', e => Tooltip.show(e.clientX, e.clientY, entry, day));
      cell.addEventListener('mouseleave', () => Tooltip.hide());
      // Keyboard accessibility
      cell.addEventListener('focus',  e => Tooltip.show(e.clientX ?? 0, e.clientY ?? 0, entry, day));
      cell.addEventListener('blur',   () => Tooltip.hide());
    }

    return cell;
  }

  // ── Public: Bar Chart ─────────────────────────────────────────────

  /**
   * Render the monthly pages bar chart into #bar-chart.
   * @param {Object} byDate - aggregated day map from data.js
   */
  function renderBarChart(byDate) {
    const monthly = Array(12).fill(0);
    for (const day of Object.values(byDate)) {
      monthly[day.month - 1] += day.pages;
    }

    const maxVal = Math.max(...monthly, 1);
    const chart  = document.getElementById('bar-chart');
    chart.innerHTML = '';

    monthly.forEach((val, m) => {
      const heightPx = Math.max(Math.round((val / maxVal) * 90), val > 0 ? 4 : 0);

      const wrap = document.createElement('div');
      wrap.className = 'bar-wrap';
      wrap.setAttribute('title', `${MONTH_NAMES[m]}: ${val} pages`);
      wrap.innerHTML = `
        <div class="bar-count">${val || ''}</div>
        <div class="bar" style="height:${heightPx}px"></div>
        <div class="bar-month">${MONTH_NAMES[m]}</div>
      `;
      chart.appendChild(wrap);
    });
  }

  // ── Public: Books Grid ────────────────────────────────────────────

  /**
   * Render the books breakdown grid into #books-grid.
   * @param {Array<Object>} entries - flat entry array from parseEntries()
   */
  function renderBooks(entries) {
    const books = {};
    for (const e of entries) {
      if (!e.title) continue;
      if (!books[e.title]) books[e.title] = { title: e.title, author: e.author, genre: e.genre, pages: 0, sessions: 0 };
      books[e.title].pages    += e.pages;
      books[e.title].sessions += 1;
    }

    const sorted = Object.values(books).sort((a, b) => b.sessions - a.sessions);
    const grid   = document.getElementById('books-grid');
    grid.innerHTML = '';

    for (const book of sorted) {
      const card = document.createElement('div');
      card.className = 'book-card';
      card.innerHTML = `
        <div class="book-title">${_esc(book.title)}</div>
        <div class="book-author">${_esc(book.author)}</div>
        <div class="book-meta">
          <div class="book-meta-item"><span>${book.pages || '?'}</span>pages</div>
          <div class="book-meta-item"><span>${book.sessions}</span>sessions</div>
        </div>
        ${book.genre ? `<div class="book-genre">${_esc(book.genre)}</div>` : ''}
      `;
      grid.appendChild(card);
    }
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { renderHeatmap, renderBarChart, renderBooks };
})();