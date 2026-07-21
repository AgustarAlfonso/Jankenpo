import { HandLandmarker, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";
import { handLandmarker, runningMode, setRunningMode, createHandLandmarker, detectGestureLocal } from "./handDetection.js";
import { $, el } from "./domRefs.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { AFKManager } from "./afkTimer.js";
import { RematchManager } from "./rematchManager.js";
import { PopupManager } from "./popupManager.js";
import { RoomLifecycleManager } from "./roomLifecycleManager.js";

import { firebaseConfig, API, G_EMOJI, RESULTS, PAGES } from "./constants.js";
import { runParticles, stopParticles } from "./particles.js";
import { showToast } from "./toast.js";
import { setupGameMode, startCamera, stopCamera, runCountdown, showCountNum, captureAndDetect, playRound, showResultPage, updatePlayerUI, resetPlayerUI, resetAIUI, resetCapture, drawAnnotation, clearAnnotation, updateScoreDisplay, bumpScore, handleFile, resetUpload, stream, camActive, isCapturing, uploadDetectedGesture, lastRoundData, initScoreDisplay, resetLocalScores, spInputMode, setSpInputMode } from './singlePlayer.js';
import {
  mpRoomCode, mpSlot, mpStream, mpCamActive, mpDetectedGesture,
  generateRandomName, initMultiplayerFirebase, updateLobbyUI, cleanUpMpSession,
  leaveMpRoom, setupMultiplayerGameUI, updateMpGameUI, startMpCamera, stopMpCamera,
  handleMpUpload, runMpCountdown, captureMpFrame, sendMpGesture, displayMpRoundResult,
  resetMpArenaForNextRound, resetMpLocalArena, clearMpAnnotation
} from './multiplayer.js';

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);




export let currentPage = 0;
export let gameMode = 'webcam'; // 'webcam' | 'upload' | 'multiplayer'

// ── DOM shortcuts ─────────────────────────────────────────────


// ── State ─────────────────────────────────────────────────────
 // 'webcam' | 'upload'


// Initialize AFK Manager (5 minutes timeout)
export const afkManager = new AFKManager(5 * 60 * 1000, () => {
  if (mpRoomCode) {
    const roomRef = ref(db, `rooms/${mpRoomCode}`);
    update(roomRef, { afk_kicked: true });
  }
});

// Initialize Rematch Manager
export const rematchManager = new RematchManager(update, (msg) => {
  popupManager.showConfirm('REMATCH', msg, 
    () => {
      // TERIMA
      if ($('btnPlayAgain')) {
        $('btnPlayAgain').click();
      }
    },
    () => {
      // TOLAK
      leaveMpRoom();
      goTo(4);
    }
  );
});

// Initialize Popup & Lifecycle Managers
export const popupManager = new PopupManager(
  $('nbPopupOverlay'),
  $('nbPopupTitle'),
  $('nbPopupMsg'),
  $('nbPopupBtn'),
  $('nbPopupBtnCancel')
);

export const roomLifecycleManager = new RoomLifecycleManager(
  update,
  remove,
  (title, msg, onOk) => popupManager.showPopup(title, msg, onOk),
  () => {
    cleanUpMpSession();
    // Redirect to Multiplayer Lobby Setup
    el.lobbySetup.style.display = 'block';
    el.lobbyWaiting.style.display = 'none';
    goTo(4);
  }
);

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

function goBack() {
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

// ── Home Buttons ──────────────────────────────────────────────
$('btnStartHome').addEventListener('click', () => goTo(1));

// ── HowTo Buttons ─────────────────────────────────────────────
$('btnBackHowto').addEventListener('click', () => goTo(0));
$('btnNextHowto').addEventListener('click', () => goTo(2));

// ── Mode Select ───────────────────────────────────────────────
$('btnBackMode').addEventListener('click', () => goTo(1));
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    gameMode = btn.dataset.mode;
    if (gameMode === 'multiplayer') {
      // Open multiplayer lobby setup
      el.lobbySetup.style.display = 'block';
      el.lobbyWaiting.style.display = 'none';
      goTo(4);
    } else if (gameMode === 'singleplayer') {
      setupGameMode(spInputMode); // Use current input mode
      goTo(3);
    }
  });
});

// Single Player Input Selector
el.spBtnUseCam.addEventListener('click', () => {
  setSpInputMode('webcam');
  setupGameMode('webcam');
});
el.spBtnUseUpload.addEventListener('click', () => {
  setSpInputMode('upload');
  setupGameMode('upload');
});



// ── Back Actions ──────────────────────────────────────────────
$('btnBackGame').addEventListener('click', () => { stopCamera(); goTo(2); });
$('btnBackLobby').addEventListener('click', () => { leaveMpRoom(); goTo(2); });
el.navBack.addEventListener('click', () => {
  if (currentPage === 6) {
    if (gameMode === 'multiplayer') goTo(5, { keepCamera: true });
    else goTo(3, { keepCamera: true });
  }
  else goBack();
});

// ── Result Buttons ────────────────────────────────────────────
$('btnPlayAgain').addEventListener('click', async () => {
  stopParticles();
  if (gameMode === 'multiplayer') {
    $('btnPlayAgain').disabled = true;
    $('btnPlayAgain').textContent = 'Tunggu pemain lain';

    if (mpRoomCode) {
      const roomRef = ref(db, `rooms/${mpRoomCode}`);
      // Send "play again" signal using RematchManager
      await rematchManager.requestRematch(roomRef, mpSlot);
    }
  } else {
    resetPlayerUI(); resetAIUI();
    goTo(3, { keepCamera: true });
  }
});
$('btnChangeMode').addEventListener('click', () => {
  stopParticles(); stopCamera(); stopMpCamera(); leaveMpRoom(); goTo(2);
});
$('btnBackHome').addEventListener('click', () => {
  stopParticles(); stopCamera(); stopMpCamera(); leaveMpRoom(); goTo(0);
});

// ═══════════════════════════════════════════
// SINGLE PLAYER CAMERA
// ═══════════════════════════════════════════
el.startCamBtn.addEventListener('click', startCamera);
el.stopCamBtn.addEventListener('click', stopCamera);





// ═══════════════════════════════════════════
// SINGLE PLAYER CAPTURE
// ═══════════════════════════════════════════
el.captureBtn.addEventListener('click', () => {
  if (!camActive || isCapturing) return;
  runCountdown();
});













// ── UI Helpers ────────────────────────────────────────────────
















// ── Score Reset (AI Mode) ─────────────────────────────────────
el.resetScoreBtn.addEventListener('click', async () => {
  localScores = { player: 0, draw: 0, ai: 0 };
  initScoreDisplay();
  resetPlayerUI(); resetAIUI();
  showToast('↺ Score direset!');
});

// ═══════════════════════════════════════════
// SINGLE PLAYER UPLOAD
// ═══════════════════════════════════════════
el.chooseFileBtn.addEventListener('click', () => el.fileInput.click());
el.uploadDrop.addEventListener('click', e => {
  if (e.target === el.uploadDrop || e.target === el.uploadDropInner) el.fileInput.click();
});
el.uploadDrop.addEventListener('dragover', e => { e.preventDefault(); el.uploadDrop.classList.add('dragover'); });
el.uploadDrop.addEventListener('dragleave', () => el.uploadDrop.classList.remove('dragover'));
el.uploadDrop.addEventListener('drop', e => {
  e.preventDefault(); el.uploadDrop.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file?.type.startsWith('image/')) handleFile(file);
  else showToast('❌ Hanya file gambar.');
});
el.fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });



el.playUploadBtn.addEventListener('click', async () => {
  if (!uploadDetectedGesture || uploadDetectedGesture === 'TIDAK_TERDETEKSI') return;
  updatePlayerUI(uploadDetectedGesture);
  resetAIUI();
  await playRound(uploadDetectedGesture);
});



// ═══════════════════════════════════════════
// MULTIPLAYER ROOM & LOBBY HANDLERS
// ═══════════════════════════════════════════


// Initial random name on load
if (el.mpPlayerNameInput) {
  el.mpPlayerNameInput.value = generateRandomName();
}

if (el.btnRandomName) {
  el.btnRandomName.addEventListener('click', () => {
    el.mpPlayerNameInput.value = generateRandomName();
  });
}

el.btnCreateRoom.addEventListener('click', async () => {
  const name = el.mpPlayerNameInput.value.trim() || 'Pemain 1';
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  try {
    const roomRef = ref(db, `rooms/${code}`);
    await set(roomRef, {
      state: "WAITING",
      players: {
        player1: { joined: true, name: name, gesture: null },
        player2: { joined: false, name: "", gesture: null }
      },
      score: { player1: 0, draw: 0, player2: 0 },
      round_result: null,
      round_counter: 0
    });

    // Automatically delete room on disconnect
    onDisconnect(roomRef).remove();

    initMultiplayerFirebase(code, 'player1', name);
  } catch (err) {
    showToast('❌ Gagal membuat room Firebase.');
    console.error(err);
  }
});

el.btnJoinRoom.addEventListener('click', async () => {
  const code = el.mpRoomCodeInput.value.trim().toUpperCase();
  const name = el.mpPlayerNameInput.value.trim() || 'Pemain 2';

  if (code.length !== 6) {
    showToast('⚠️ Kode room harus 6 karakter.');
    return;
  }

  try {
    const roomRef = ref(db, `rooms/${code}`);
    const snapshot = await get(roomRef);
    if (!snapshot.exists()) {
      showToast('❌ Room tidak ditemukan.');
      return;
    }

    const roomData = snapshot.val();
    if (roomData.players.player2.joined) {
      showToast('❌ Room sudah penuh.');
      return;
    }

    // Join as player2
    await update(roomRef, {
      "players/player2/joined": true,
      "players/player2/name": name,
      "state": "READY"
    });

    initMultiplayerFirebase(code, 'player2', name);
  } catch (e) {
    showToast(`❌ Error: ${e.message}`);
  }
});

// Setup room link helper
el.btnCopyLink.addEventListener('click', () => {
  if (!mpRoomCode) return;
  const link = `${window.location.protocol}//${window.location.host}/room/${mpRoomCode}`;
  navigator.clipboard.writeText(link).then(() => {
    showToast('📋 Link room disalin!');
  }).catch(() => {
    showToast('❌ Gagal menyalin.');
  });
});


// ═══════════════════════════════════════════
// MULTIPLAYER GAME PLAY LOGIC
// ═══════════════════════════════════════════
// ── Multiplayer Inputs ────────────────────────────────────────
el.mpBtnUseCam.addEventListener('click', startMpCamera);
el.mpBtnUseUpload.addEventListener('click', () => {
  el.mpFileInput.click();
});
el.mpFileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleMpUpload(e.target.files[0]);
});
el.mpUploadZone.addEventListener('click', () => {
  el.mpFileInput.click();
});

// Local Capture Action
el.mpCaptureBtn.addEventListener('click', () => {
  if (mpCamActive) {
    runMpCountdown();
  } else if (mpDetectedGesture) {
    // Send directly from image upload
    sendMpGesture(mpDetectedGesture);
  }
});

// ── Navigation triggers for Leave ─────────────────────────────
$('btnLeaveMpGame').addEventListener('click', () => {
  leaveMpRoom();
});



// ═══════════════════════════════════════════
// HELPERS & INITIALIZATION
// ═══════════════════════════════════════════
export const sleep = ms => new Promise(r => setTimeout(r, ms));

async function init() {
  // Application is now serverless.
  // No need to check backend health.
  initScoreDisplay();

  // Parse URL parameter to check direct room link
  const pathParts = window.location.pathname.split('/');
  const roomIdx = pathParts.indexOf('room');
  if (roomIdx !== -1 && pathParts[roomIdx + 1]) {
    const code = pathParts[roomIdx + 1].toUpperCase();
    el.mpRoomCodeInput.value = code;
    gameMode = 'multiplayer';
    el.lobbySetup.style.display = 'block';
    el.lobbyWaiting.style.display = 'none';
    goTo(4); // Direct lobby page entry
    showToast(`🔗 Masuk via link room! Silahkan klik Gabung.`);
  }

  // Handle document fonts load smoothly
  document.fonts.ready.then(() => {
    document.body.style.transition = 'opacity 0.3s';
    document.body.style.opacity = '1';
  });
}

document.body.style.opacity = '0';
document.addEventListener('DOMContentLoaded', init);

// Expose to window for Puppeteer testing
if (typeof window !== 'undefined') {
  window.detectGestureLocal = detectGestureLocal;
  
}
