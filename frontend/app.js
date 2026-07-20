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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);




export let currentPage = 0;
export let gameMode = 'webcam'; // 'webcam' | 'upload' | 'multiplayer'

// ── DOM shortcuts ─────────────────────────────────────────────


// ── State ─────────────────────────────────────────────────────
 // 'webcam' | 'upload'

// Multiplayer state
let ws = null;
export let mpSlot = null; // 'player1' or 'player2'
export let mpRoomCode = null;
let mpInputMode = null; // 'webcam' | 'upload'
let mpDetectedGesture = null;
let mpStream = null;
let mpCamActive = false;
let mpIsCapturing = false;

// Initialize AFK Manager (5 minutes timeout)
const afkManager = new AFKManager(5 * 60 * 1000, () => {
  if (mpRoomCode) {
    const roomRef = ref(db, `rooms/${mpRoomCode}`);
    update(roomRef, { afk_kicked: true });
  }
});

// Initialize Rematch Manager
const rematchManager = new RematchManager(update, (msg) => {
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
const popupManager = new PopupManager(
  $('nbPopupOverlay'),
  $('nbPopupTitle'),
  $('nbPopupMsg'),
  $('nbPopupBtn'),
  $('nbPopupBtnCancel')
);

const roomLifecycleManager = new RoomLifecycleManager(
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

const nameAdjectives = [
  'Bebek', 'Kucing', 'Panda', 'Elang', 'Harimau', 'Burung', 'Rubah', 'Naga',
  'Singa', 'Hiu', 'Semut', 'Lebah', 'Monyet', 'Serigala', 'Tupai', 'Siput',
  'Katak', 'Kelinci', 'Domba', 'Ayam', 'Paus', 'Ular', 'Buaya', 'Gurita', 'Beruang'
];
const nameNouns = [
  'Sakti', 'Terbang', 'Ganas', 'Ngesot', 'Ceria', 'Santuy', 'Berani', 'Misterius',
  'Galak', 'Malas', 'Ninja', 'Cyborg', 'Imut', 'Rebahan', 'Gesit', 'Ngantuk',
  'Ngebut', 'Nyasar', 'Keren', 'Barbar', 'Cerdik', 'Lucu', 'Polos', 'Sultan', 'Estetik'
];

function generateRandomName() {
  const adj = nameAdjectives[Math.floor(Math.random() * nameAdjectives.length)];
  const noun = nameNouns[Math.floor(Math.random() * nameNouns.length)];
  return `${adj} ${noun}`;
}

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

// Global var for the Firebase listener unsubscribe function
let fbUnsubscribe = null;

function initMultiplayerFirebase(code, slot, name) {
  mpRoomCode = code;
  mpSlot = slot;

  el.roomCodeVal.textContent = mpRoomCode;
  el.lobbySetup.style.display = 'none';
  el.lobbyWaiting.style.display = 'block';
  showToast(`👋 Selamat datang di room ${mpRoomCode}!`);

  const roomRef = ref(db, `rooms/${code}`);

  fbUnsubscribe = onValue(roomRef, async (snapshot) => {
    if (!snapshot.exists()) {
      // Handled by roomLifecycleManager
    }

    const isDead = await roomLifecycleManager.checkRoomStatus(snapshot, roomRef, mpSlot);
    if (isDead) return;

    const roomState = snapshot.val();

    if (roomState.afk_kicked) {
      popupManager.show(
        'AFK TIMEOUT', 
        'Room dihapus karena tidak ada aktivitas selama 5 menit.', 
        () => {
          leaveMpRoom();
          goTo(4); // Go to Lobby Setup
        }
      );
      return;
    }

    afkManager.reset();

    // Update UI based on room state
    updateLobbyUI(roomState);
    updateMpGameUI(roomState);

    // Host calculates result if both submitted and result not yet calculated
    if (mpSlot === 'player1' && roomState.state === 'READY' && !roomState.round_result) {
      const p1 = roomState.players.player1;
      const p2 = roomState.players.player2;

      if (p1.submitted && p2.submitted && p1.gesture && p2.gesture) {
        let result = "";
        let newScore = { ...roomState.score };

        if (p1.gesture === p2.gesture) {
          result = "SERI";
          newScore.draw++;
        } else if (p1.gesture === "TIDAK_TERDETEKSI") {
          result = "player2";
          newScore.player2++;
        } else if (p2.gesture === "TIDAK_TERDETEKSI") {
          result = "player1";
          newScore.player1++;
        } else if (
          (p1.gesture === "BATU" && p2.gesture === "GUNTING") ||
          (p1.gesture === "GUNTING" && p2.gesture === "KERTAS") ||
          (p1.gesture === "KERTAS" && p2.gesture === "BATU")
        ) {
          result = "player1";
          newScore.player1++;
        } else {
          result = "player2";
          newScore.player2++;
        }

        await update(roomRef, {
          "round_result": result,
          "score": newScore,
          "player1_gesture": p1.gesture,
          "player2_gesture": p2.gesture
        });
      }
    }

    if (roomState.round_result) {
      if (PAGES[currentPage] === 'page-mp-game') {
        displayMpRoundResult(roomState);
      }

      // Handle play again logic via RematchManager
      if (PAGES[currentPage] === 'page-result') {
        await rematchManager.checkRematchState(roomState, roomRef, mpSlot);
      }

    } else if (PAGES[currentPage] === 'page-result' && roomState.state === 'READY' && !roomState.players.player1.gesture && !roomState.players.player2.gesture) {
      // Both cleared gestures, round reset
      rematchManager.resetToast();
      resetMpArenaForNextRound();
      goTo(5, { keepCamera: true });
    }
  });
}


function updateLobbyUI(roomState) {
  const p1 = roomState.players.player1;
  const p2 = roomState.players.player2;

  // Render player names
  el.slotP1Name.textContent = p1.joined ? p1.name : "Menunggu P1...";
  el.slotP2Name.textContent = p2.joined ? p2.name : "Menunggu Lawan...";
  el.slotP2Icon.textContent = p2.joined ? "🟢" : "⚪";

  // Update state logic
  if (roomState.state === 'READY') {
    el.lobbyStatusMsg.textContent = "Semua pemain siap! Memulai pertandingan...";

    // Automatically transition to game screen after 1.5s
    setTimeout(() => {
      if (mpRoomCode && PAGES[currentPage] === 'page-mp-lobby') {
        goTo(5); // Go to Page 5: Multiplayer Game Arena
        setupMultiplayerGameUI(roomState);
      }
    }, 1500);
  } else {
    el.lobbyStatusMsg.textContent = "Menunggu pemain kedua bergabung...";
  }
}

function cleanUpMpSession() {
  if (fbUnsubscribe) {
    fbUnsubscribe();
    fbUnsubscribe = null;
  }
  afkManager.clear();
  mpSlot = null;
  mpRoomCode = null;
  stopMpCamera();
  resetMpLocalArena();
}

async function leaveMpRoom() {
  if (mpRoomCode && mpSlot) {
    const roomRef = ref(db, `rooms/${mpRoomCode}`);
    const slot = mpSlot; // Save slot before cleanup
    
    // Clean up session FIRST so we don't trigger our own local onValue listener
    cleanUpMpSession();
    
    // Then update Firebase
    await roomLifecycleManager.leaveRoom(roomRef, slot);
  } else {
    cleanUpMpSession();
  }
}

// ═══════════════════════════════════════════
// MULTIPLAYER GAME PLAY LOGIC
// ═══════════════════════════════════════════
function setupMultiplayerGameUI(roomState) {
  const localPlayer = roomState.players[mpSlot];
  const opponentSlot = mpSlot === 'player1' ? 'player2' : 'player1';
  const opponentPlayer = roomState.players[opponentSlot];

  // Header score labels (Left = You, Right = Opponent)
  el.mpScoreP1Label.textContent = `🟢 ${localPlayer.name}`;
  el.mpScoreP2Label.textContent = `🔴 ${opponentPlayer.name}`;

  // Sidebar slot indicators
  el.mpLocalLabel.textContent = `👤 ${localPlayer.name} (Kamu)`;
  el.mpOpponentLabel.textContent = `👤 ${opponentPlayer.name}`;

  // Reset score cards (Left = You, Right = Opponent)
  const isP1 = (mpSlot === 'player1');
  el.mpScorePlayer.textContent = isP1 ? roomState.score.player1 : roomState.score.player2;
  el.mpScoreDraw.textContent = roomState.score.draw;
  el.mpScoreOpponent.textContent = isP1 ? roomState.score.player2 : roomState.score.player1;

  resetMpLocalArena();
}

function updateMpGameUI(roomState) {
  if (PAGES[currentPage] !== 'page-mp-game') return;

  // Score cards (Left = You, Right = Opponent)
  const isP1 = (mpSlot === 'player1');
  const myScore = isP1 ? roomState.score.player1 : roomState.score.player2;
  const oppScore = isP1 ? roomState.score.player2 : roomState.score.player1;

  el.mpScorePlayer.textContent = myScore;
  el.mpScoreDraw.textContent = roomState.score.draw;
  el.mpScoreOpponent.textContent = oppScore;

  // Also update mini nav score
  el.nsPlayer.textContent = myScore;
  el.nsAi.textContent = oppScore;

  // Sync slot status (waiting for submissions)
  const opponentSlot = mpSlot === 'player1' ? 'player2' : 'player1';
  const localSub = roomState.players[mpSlot].submitted;
  const oppSub = roomState.players[opponentSlot].submitted;

  if (localSub) {
    el.mpPlayerTagEmoji.textContent = '⏳';
    el.mpPlayerTagLabel.textContent = 'Terkirim';
  }

  if (oppSub) {
    el.mpOpponentStatusText.textContent = "Sudah mengirim gesture!";
    el.mpOpponentTagEmoji.textContent = '✔️';
    el.mpOpponentTagLabel.textContent = 'Siap';
  } else {
    el.mpOpponentStatusText.textContent = "Berpikir...";
    el.mpOpponentTagEmoji.textContent = '👤';
    el.mpOpponentTagLabel.textContent = 'Menunggu...';
  }
}

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

async function startMpCamera() {
  try {
    mpStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });

    el.mpWebcamVideo.srcObject = mpStream;
    el.mpWebcamVideo.style.display = 'block';
    el.mpOverlayCanvas.style.display = 'block';
    el.mpInputSelector.style.display = 'none';
    el.mpUploadZone.style.display = 'none';
    el.mpCamActions.style.display = 'block';
    el.mpCaptureBtn.disabled = false;
    mpCamActive = true;

    el.mpWebcamVideo.addEventListener('loadedmetadata', () => {
      el.mpOverlayCanvas.width = el.mpWebcamVideo.videoWidth;
      el.mpOverlayCanvas.height = el.mpWebcamVideo.videoHeight;
    }, { once: true });

  } catch (err) {
    showToast('❌ Gagal menyalakan kamera.');
    console.error(err);
  }
}

function stopMpCamera() {
  if (mpStream) { mpStream.getTracks().forEach(t => t.stop()); mpStream = null; }
  el.mpWebcamVideo.style.display = 'none';
  el.mpOverlayCanvas.style.display = 'none';
  el.mpInputSelector.style.display = 'flex';
  el.mpUploadZone.style.display = 'none';
  el.mpCamActions.style.display = 'none';
  el.mpCaptureBtn.disabled = true;
  mpCamActive = false;
  clearMpAnnotation();
}

async function handleMpUpload(file) {
  el.mpInputSelector.style.display = 'none';
  el.mpUploadZone.style.display = 'flex';
  el.mpUploadStatus.textContent = 'Mendeteksi...';

  const url = URL.createObjectURL(file);
  const preview = document.createElement('img');
  preview.src = url;
  el.mpUploadZone.innerHTML = '';
  el.mpUploadZone.appendChild(preview);

  if (!handLandmarker) {
    showToast('⏳ AI sedang loading...');
    resetMpLocalArena();
    return;
  }

  if (runningMode === "VIDEO") {
    setRunningMode("IMAGE");
    await handLandmarker.setOptions({ runningMode: "IMAGE" });
  }

  preview.onload = async () => {
    try {
      const results = handLandmarker.detect(preview);
      let gesture = "TIDAK_TERDETEKSI";

      if (results.landmarks && results.landmarks.length > 0) {
        gesture = detectGestureLocal(results.landmarks);
      }

      if (gesture !== 'TIDAK_TERDETEKSI') {
        mpDetectedGesture = gesture;
        el.mpPlayerTagEmoji.textContent = G_EMOJI[mpDetectedGesture];
        el.mpPlayerTagLabel.textContent = mpDetectedGesture;
        el.mpCaptureBtn.disabled = false;
        el.mpUploadStatus.textContent = 'Gesture siap dikirim!';
      } else {
        showToast('🤔 Gambar tidak terbaca dengan baik.');
        resetMpLocalArena();
      }
    } catch (err) {
      showToast('❌ Gagal memproses.');
      resetMpLocalArena();
    }
  };
}

// Local Capture Action
el.mpCaptureBtn.addEventListener('click', () => {
  if (mpCamActive) {
    runMpCountdown();
  } else if (mpDetectedGesture) {
    // Send directly from image upload
    sendMpGesture(mpDetectedGesture);
  }
});

function runMpCountdown() {
  el.mpCaptureBtn.disabled = true;
  let count = 3;
  el.mpCountdownOverlay.style.display = 'flex';

  const tick = () => {
    if (count > 0) {
      el.mpCountdownOverlay.textContent = count;
      count--;
      setTimeout(tick, 900);
    } else {
      el.mpCountdownOverlay.textContent = '📸';
      setTimeout(captureMpFrame, 400);
    }
  };
  tick();
}

async function captureMpFrame() {
  el.mpCamBox.classList.add('flash');
  setTimeout(() => el.mpCamBox.classList.remove('flash'), 300);
  el.mpCountdownOverlay.style.display = 'none';

  if (!handLandmarker) {
    showToast('⏳ AI sedang loading...');
    el.mpCaptureBtn.disabled = false;
    return;
  }

  if (runningMode === "IMAGE") {
    setRunningMode("VIDEO");
    await handLandmarker.setOptions({ runningMode: "VIDEO" });
  }

  let startTimeMs = performance.now();
  const results = handLandmarker.detectForVideo(el.mpWebcamVideo, startTimeMs);

  let gesture = "TIDAK_TERDETEKSI";
  if (results.landmarks && results.landmarks.length > 0) {
    gesture = detectGestureLocal(results.landmarks);

    // Draw landmarks
    const canvas = el.mpOverlayCanvas;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawingUtils = new DrawingUtils(ctx);
    for (const landmarks of results.landmarks) {
      drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 5 });
      drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 2 });
    }
    ctx.restore();
    setTimeout(clearMpAnnotation, 3000);
  }

  if (gesture !== 'TIDAK_TERDETEKSI') {
    sendMpGesture(gesture);
  } else {
    showToast('🤔 Gesture tidak terbaca. Silahkan coba lagi.');
    el.mpCaptureBtn.disabled = false;
  }
}

async function sendMpGesture(gesture) {
  if (mpRoomCode) {
    const roomRef = ref(db, `rooms/${mpRoomCode}`);
    await update(roomRef, {
      [`players/${mpSlot}/gesture`]: gesture,
      [`players/${mpSlot}/submitted`]: true
    });

    el.mpCaptureBtn.disabled = true;
    showToast("📤 Gesture dikirim! Menunggu lawan...");
  }
}

function displayMpRoundResult(roundData) {
  const opponentSlot = mpSlot === 'player1' ? 'player2' : 'player1';

  // Show opponent gesture
  const oppGesture = roundData[`${opponentSlot}_gesture`];
  el.mpOpponentIdle.style.display = 'none';
  el.mpOpponentEmoji.textContent = G_EMOJI[oppGesture] || '❓';
  el.mpOpponentShow.style.display = 'flex';
  el.mpOpponentTagEmoji.textContent = G_EMOJI[oppGesture] || '❓';
  el.mpOpponentTagLabel.textContent = oppGesture;

  // Local side gesture tag update
  const myGesture = roundData[`${mpSlot}_gesture`];
  el.mpPlayerTagEmoji.textContent = G_EMOJI[myGesture] || '❓';
  el.mpPlayerTagLabel.textContent = myGesture;

  // Determine relative result
  let outcome = 'SERI';
  if (roundData.round_result !== 'SERI') {
    outcome = (roundData.round_result === mpSlot) ? 'MENANG' : 'KALAH';
  }

  // Arena outcome banner
  const cfg = RESULTS[outcome];
  el.mpVsResult.textContent = cfg.banner;
  el.mpVsResult.className = `vs-result ${cfg.cls}`;

  setTimeout(() => {
    // Show game result page
    const finalPayload = {
      result: roundData.round_result,
      player1_gesture: roundData.player1_gesture,
      player2_gesture: roundData.player2_gesture,
      score: roundData.score
    };
    showResultPage(finalPayload);
  }, 1600);
}

function resetMpArenaForNextRound() {
  resetMpLocalArena();
  // Clear opponent UI
  el.mpOpponentIdle.style.display = 'flex';
  el.mpOpponentShow.style.display = 'none';
  el.mpOpponentStatusText.textContent = "Berpikir...";
  el.mpOpponentTagEmoji.textContent = '👤';
  el.mpOpponentTagLabel.textContent = 'Menunggu...';
  el.mpVsResult.textContent = '';
  el.mpVsResult.className = 'vs-result';
}

function resetMpLocalArena() {
  clearMpAnnotation();
  mpDetectedGesture = null;
  el.mpPlayerTagEmoji.textContent = '❓';
  el.mpPlayerTagLabel.textContent = 'Siapkan tangan...';
  el.mpCaptureBtn.disabled = !mpCamActive;

  // Reset upload area layout
  el.mpUploadZone.style.display = 'none';
  el.mpUploadZone.innerHTML = `
    <input type="file" id="mpFileInput" accept="image/*" hidden />
    <span style="font-size: 2.5rem;">📁</span>
    <p style="font-weight: 700; font-size: 0.8rem; color: var(--ink-soft);">Klik untuk Upload Foto</p>
    <p style="font-size: 0.7rem; color: var(--ink-soft);" id="mpUploadStatus">JPG / PNG / WebP</p>
  `;

  // Re-bind click for dynamic html replacement
  $('mpFileInput').addEventListener('change', e => {
    if (e.target.files[0]) handleMpUpload(e.target.files[0]);
  });

  if (!mpCamActive) {
    el.mpInputSelector.style.display = 'flex';
  }
}

function clearMpAnnotation() {
  const ctx = el.mpOverlayCanvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, el.mpOverlayCanvas.width, el.mpOverlayCanvas.height);
}

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
