/**
 * tooltip.js — Hover tooltip for heatmap cells
 *
 * Depends on: nothing
 * Used by: charts.js
 */

const Tooltip = (() => {
  const el         = document.getElementById('tooltip');
  const elDate     = document.getElementById('tip-date');
  const elBook     = document.getElementById('tip-book');
  const elPages    = document.getElementById('tip-pages');
  const elTime     = document.getElementById('tip-time');
  const elThoughts = document.getElementById('tip-thoughts');

  const TOOLTIP_WIDTH  = 280;
  const TOOLTIP_HEIGHT = 180;
  const OFFSET         = 16;

  /** Position tooltip near the cursor, flipping if near viewport edge */
  function _position(mouseX, mouseY) {
    const x = mouseX + OFFSET;
    const y = mouseY + OFFSET;
    el.style.left = (x + TOOLTIP_WIDTH  > window.innerWidth  ? mouseX - TOOLTIP_WIDTH  - 8 : x) + 'px';
    el.style.top  = (y + TOOLTIP_HEIGHT > window.innerHeight ? mouseY - TOOLTIP_HEIGHT - 8 : y) + 'px';
  }

  /** Show the tooltip for a given day entry */
  function show(mouseX, mouseY, entry, day) {
    const sessions = entry.sessions || [entry];
    const titles   = [...new Set(sessions.map(s => s.title).filter(Boolean))];
    const times    = sessions.map(s => s.time).filter(Boolean);
    const thoughts = sessions.map(s => s.thoughts).filter(Boolean).join(' ');

    elDate.textContent  = day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    elBook.textContent  = titles.join(' / ') || '—';
    elPages.textContent = entry.pages ? `📄 ${entry.pages} pages` : 'Pages not recorded';
    elTime.textContent  = times.length ? `⏱ ${times.join(', ')}` : '';

    if (thoughts) {
      elThoughts.textContent    = thoughts;
      elThoughts.style.display  = 'block';
    } else {
      elThoughts.style.display  = 'none';
    }

    _position(mouseX, mouseY);
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
  }

  /** Hide the tooltip */
  function hide() {
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
  }

  /** Update position as mouse moves (call from mousemove listener) */
  function move(mouseX, mouseY) {
    if (el.classList.contains('show')) {
      _position(mouseX, mouseY);
    }
  }

  // Track cursor globally so tooltip follows the mouse
  document.addEventListener('mousemove', e => move(e.clientX, e.clientY));

  return { show, hide };
})();