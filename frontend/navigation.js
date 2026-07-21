import { el, $ } from './domRefs.js';
import { PAGES } from './constants.js';
import { stopCamera } from './singlePlayer.js';
import { stopMpCamera, leaveMpRoom } from './multiplayer.js';

export let currentPage = 0;

// ═══════════════════════════════════════════
// PAGE NAVIGATION
// ═══════════════════════════════════════════
export function goTo(pageIndex, opts = {}) {
  const fromId = PAGES[currentPage];
  const toId = PAGES[pageIndex];
  const fromEl = $(fromId);
  const toEl = $(toId);
  if (!fromEl || !toEl || fromId === toId) return;

  // Exit current page
  fromEl.classList.remove('active');
  fromEl.classList.add('exit');
  setTimeout(() => fromEl.classList.remove('exit'), 450);

  // Enter new page
  toEl.classList.add('active');
  currentPage = pageIndex;

  // Navbar visibility & steps
  if (pageIndex === 0) {
    el.navbar.style.display = 'none';
  } else {
    el.navbar.style.display = 'flex';
    el.navSteps.forEach((s, i) => {
      // Adjusted steps display for multiplayer lobby and game
      let activeIndex = pageIndex;
      if (pageIndex === 4) activeIndex = 2; // Lobby is Mode select step
      if (pageIndex === 5) activeIndex = 3; // MP Game is Game step
      if (pageIndex === 6) activeIndex = 4; // Result step
      s.classList.toggle('active', i === activeIndex);
    });
  }

  // Scroll page to top
  toEl.scrollTop = 0;

  // Handle cameras leaving games
  if (fromId === 'page-game' && !opts.keepCamera) stopCamera();
  if (fromId === 'page-mp-game' && !opts.keepCamera) stopMpCamera();
}

export function goBack() {
  if (currentPage > 0) {
    // If going back from mp-lobby or mp-game, clean up websocket
    if (PAGES[currentPage] === 'page-mp-lobby') {
      leaveMpRoom();
      goTo(2);
    } else if (PAGES[currentPage] === 'page-mp-game') {
      leaveMpRoom();
      goTo(2);
    } else {
      goTo(currentPage - 1);
    }
  }
}
