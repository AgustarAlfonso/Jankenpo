import { HandLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { AFKManager } from "./afkTimer.js";
import { RematchManager } from "./rematchManager.js";
import { PopupManager } from "./popupManager.js";
import { RoomLifecycleManager } from "./roomLifecycleManager.js";

import { firebaseConfig, API, G_EMOJI, RESULTS, PAGES } from "./constants.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let handLandmarker = undefined;
let runningMode = "IMAGE";

// Initialize the HandLandmarker
const createHandLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU"
    },
    runningMode: runningMode,
    numHands: 1
  });
  console.log("MediaPipe Hand Landmarker initialized locally!");

  // WARM-UP THE MODEL: Lakukan deteksi kosong agar proses cold-start (loading lama) terjadi di background saat web baru dibuka.
  try {
    const dummyCanvas = document.createElement('canvas');
    dummyCanvas.width = 1;
    dummyCanvas.height = 1;
    handLandmarker.detect(dummyCanvas);
    console.log("Model warmed up! Deteksi pertama nanti akan instan.");
  } catch(e) {
    console.warn("Pemanasan gagal, cold-start mungkin tetap terjadi", e);
  }
};
createHandLandmarker();

// Local gesture detection logic based on landmarks
function detectGestureLocal(landmarks) {
  if (!landmarks || landmarks.length === 0) return "TIDAK_TERDETEKSI";

  const hand = landmarks[0];
  const tips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky
  const mcp = [5, 9, 13, 17];

  let fingersUp = 0;

  // Thumb (special case, checking X coordinate for simplicity depending on handedness)
  if (hand[4].x < hand[3].x && hand[4].x < hand[2].x) {
    fingersUp += 1;
  }

  // 4 Fingers
  for (let i = 0; i < 4; i++) {
    if (hand[tips[i]].y < hand[mcp[i]].y) {
      fingersUp += 1;
    }
  }

  if (fingersUp === 0 || fingersUp === 1) return "BATU";
  if (fingersUp === 2 || fingersUp === 3) return "GUNTING";
  if (fingersUp === 4 || fingersUp === 5) return "KERTAS";

  return "TIDAK_TERDETEKSI";
}


let currentPage = 0;
let gameMode = 'webcam'; // 'webcam' | 'upload' | 'multiplayer'

// ── DOM shortcuts ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = {
  navbar: $('navbar'), navBack: $('navBack'), navSteps: document.querySelectorAll('.step'),
  nsPlayer: $('nsPlayer'), nsAi: $('nsAi'),
  // Single Player Game
  webcamVideo: $('webcamVideo'), overlayCanvas: $('overlayCanvas'),
  camBox: $('camBox'), camPlaceholder: $('camPlaceholder'),
  countdownOverlay: $('countdownOverlay'),
  startCamBtn: $('startCamBtn'), stopCamBtn: $('stopCamBtn'),
  captureBtn: $('captureBtn'),
  playerTag: $('playerTag'), playerTagEmoji: $('playerTagEmoji'), playerTagLabel: $('playerTagLabel'),
  aiIdle: $('aiIdle'), aiShow: $('aiShow'), aiGestureEmoji: $('aiGestureEmoji'),
  aiTag: $('aiTag'), aiTagEmoji: $('aiTagEmoji'), aiTagLabel: $('aiTagLabel'),
  vsResult: $('vsResult'),
  scorePlayer: $('scorePlayer'), scoreDraw: $('scoreDraw'), scoreAi: $('scoreAi'),
  resetScoreBtn: $('resetScoreBtn'),
  spInputSelector: $('spInputSelector'), spBtnUseCam: $('spBtnUseCam'), spBtnUseUpload: $('spBtnUseUpload'),
  gameModeWebcam: $('gameModeWebcam'), gameModeUpload: $('gameModeUpload'),
  // Single Player Upload
  uploadDrop: $('uploadDrop'), uploadDropInner: $('uploadDropInner'),
  fileInput: $('fileInput'), chooseFileBtn: $('chooseFileBtn'),
  uploadResultPanel: $('uploadResultPanel'), previewImg: $('previewImg'),
  annotatedImg: $('annotatedImg'), annotatedWrap: $('annotatedWrap'),
  uploadEmoji: $('uploadEmoji'), uploadGestureLabel: $('uploadGestureLabel'),
  playUploadBtn: $('playUploadBtn'), uploadLoading: $('uploadLoading'),
  // Multiplayer Lobby
  mpPlayerNameInput: $('mpPlayerNameInput'),
  btnRandomName: $('btnRandomName'),
  btnCreateRoom: $('btnCreateRoom'),
  mpRoomCodeInput: $('mpRoomCodeInput'),
  btnJoinRoom: $('btnJoinRoom'),
  lobbySetup: $('lobbySetup'),
  lobbyWaiting: $('lobbyWaiting'),
  roomCodeVal: $('roomCodeVal'),
  btnCopyLink: $('btnCopyLink'),
  slotPlayer1: $('slotPlayer1'),
  slotP1Name: $('slotP1Name'),
  slotPlayer2: $('slotPlayer2'),
  slotP2Name: $('slotP2Name'),
  slotP2Icon: $('slotP2Icon'),
  slotP2Desc: $('slotP2Desc'),
  lobbyStatusMsg: $('lobbyStatusMsg'),
  btnStartMpGame: $('btnStartMpGame'),
  btnBackLobby: $('btnBackLobby'),
  // Multiplayer Game Arena
  mpScoreP1Label: $('mpScoreP1Label'),
  mpScorePlayer: $('mpScorePlayer'),
  mpScoreDraw: $('mpScoreDraw'),
  mpScoreP2Label: $('mpScoreP2Label'),
  mpScoreOpponent: $('mpScoreOpponent'),
  mpLocalLabel: $('mpLocalLabel'),
  mpOpponentLabel: $('mpOpponentLabel'),
  mpCamBox: $('mpCamBox'),
  mpWebcamVideo: $('mpWebcamVideo'),
  mpOverlayCanvas: $('mpOverlayCanvas'),
  mpInputSelector: $('mpInputSelector'),
  mpBtnUseCam: $('mpBtnUseCam'),
  mpBtnUseUpload: $('mpBtnUseUpload'),
  mpUploadZone: $('mpUploadZone'),
  mpFileInput: $('mpFileInput'),
  mpUploadStatus: $('mpUploadStatus'),
  mpCountdownOverlay: $('mpCountdownOverlay'),
  mpCamActions: $('mpCamActions'),
  mpStopCamBtn: $('mpStopCamBtn'),
  mpPlayerTag: $('mpPlayerTag'),
  mpPlayerTagEmoji: $('mpPlayerTagEmoji'),
  mpPlayerTagLabel: $('mpPlayerTagLabel'),
  mpCaptureBtn: $('mpCaptureBtn'),
  mpVsResult: $('mpVsResult'),
  mpOpponentBox: $('mpOpponentBox'),
  mpOpponentIdle: $('mpOpponentIdle'),
  mpOpponentStatusText: $('mpOpponentStatusText'),
  mpOpponentShow: $('mpOpponentShow'),
  mpOpponentEmoji: $('mpOpponentEmoji'),
  mpOpponentTag: $('mpOpponentTag'),
  mpOpponentTagEmoji: $('mpOpponentTagEmoji'),
  mpOpponentTagLabel: $('mpOpponentTagLabel'),
  btnLeaveMpGame: $('btnLeaveMpGame'),
  // Result Page
  resultBadge: $('resultBadge'), resultTitle: $('resultTitle'),
  resPlayerEmoji: $('resPlayerEmoji'), resPlayerGesture: $('resPlayerGesture'),
  resAiEmoji: $('resAiEmoji'), resAiGesture: $('resAiGesture'),
  rsPlayer: $('rsPlayer'), rsDraw: $('rsDraw'), rsAi: $('rsAi'),
  rsPlayerLabel: $('rsPlayerLabel'), rsAiLabel: $('rsAiLabel'),
  particleCanvas: $('particleCanvas'),
  toast: $('toast'),
};

// ── State ─────────────────────────────────────────────────────
let stream = null;
let camActive = false;
let isCapturing = false;
let uploadDetectedGesture = null;
let lastRoundData = null;

let localScores = { player: 0, draw: 0, ai: 0 };
let spInputMode = 'webcam'; // 'webcam' | 'upload'

// Multiplayer state
let ws = null;
let mpSlot = null; // 'player1' or 'player2'
let mpRoomCode = null;
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
function goTo(pageIndex, opts = {}) {
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
  spInputMode = 'webcam';
  setupGameMode('webcam');
});
el.spBtnUseUpload.addEventListener('click', () => {
  spInputMode = 'upload';
  setupGameMode('upload');
});

function setupGameMode(mode) {
  if (mode === 'webcam') {
    el.gameModeWebcam.style.display = 'block';
    el.gameModeUpload.style.display = 'none';
    el.spBtnUseCam.classList.replace('btn--ghost', 'btn--primary');
    el.spBtnUseUpload.classList.replace('btn--primary', 'btn--ghost');
    if (currentPage === 3) startCamera();
  } else {
    el.gameModeWebcam.style.display = 'none';
    el.gameModeUpload.style.display = 'block';
    el.spBtnUseCam.classList.replace('btn--primary', 'btn--ghost');
    el.spBtnUseUpload.classList.replace('btn--ghost', 'btn--primary');
    stopCamera();
    resetUpload();
  }
  resetPlayerUI();
  resetAIUI();
}

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

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    el.webcamVideo.srcObject = stream;
    el.webcamVideo.style.display = 'block';
    el.overlayCanvas.style.display = 'block';
    el.camPlaceholder.classList.add('hidden');
    el.startCamBtn.style.display = 'none';
    el.stopCamBtn.style.display = 'inline-flex';
    el.captureBtn.disabled = false;
    camActive = true;
    el.webcamVideo.addEventListener('loadedmetadata', () => {
      el.overlayCanvas.width = el.webcamVideo.videoWidth;
      el.overlayCanvas.height = el.webcamVideo.videoHeight;
    }, { once: true });
    showToast('📷 Kamera aktif!');
  } catch (err) {
    showToast('❌ Kamera tidak bisa diakses. Coba mode Upload.');
    console.error(err);
  }
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  el.webcamVideo.style.display = 'none';
  el.overlayCanvas.style.display = 'none';
  el.camPlaceholder.classList.remove('hidden');
  el.startCamBtn.style.display = 'inline-flex';
  el.stopCamBtn.style.display = 'none';
  el.captureBtn.disabled = true;
  camActive = false;
}

// ═══════════════════════════════════════════
// SINGLE PLAYER CAPTURE
// ═══════════════════════════════════════════
el.captureBtn.addEventListener('click', () => {
  if (!camActive || isCapturing) return;
  runCountdown();
});

function runCountdown() {
  isCapturing = true;
  el.captureBtn.disabled = true;
  let count = 3;
  el.countdownOverlay.style.display = 'flex';

  const tick = () => {
    if (count > 0) {
      showCountNum(count--);
      setTimeout(tick, 900);
    } else {
      showCountNum('📸');
      setTimeout(captureAndDetect, 400);
    }
  };
  tick();
}

function showCountNum(n) {
  el.countdownOverlay.textContent = n;
  el.countdownOverlay.style.animation = 'none';
  void el.countdownOverlay.offsetWidth;
  el.countdownOverlay.style.animation = 'countdownPulse 0.85s ease';
}

async function captureAndDetect() {
  el.camBox.classList.add('flash');
  setTimeout(() => el.camBox.classList.remove('flash'), 300);
  el.countdownOverlay.style.display = 'none';

  if (!handLandmarker) {
    showToast('⏳ AI sedang loading, coba sebentar lagi...');
    resetCapture();
    return;
  }

  // Ensure running mode is VIDEO for webcam
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await handLandmarker.setOptions({ runningMode: "VIDEO" });
  }

  let startTimeMs = performance.now();
  const results = handLandmarker.detectForVideo(el.webcamVideo, startTimeMs);

  let gesture = "TIDAK_TERDETEKSI";
  if (results.landmarks && results.landmarks.length > 0) {
    gesture = detectGestureLocal(results.landmarks);

    // Draw landmarks
    const canvas = el.overlayCanvas;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // ctx.translate(canvas.width, 0); 
    // ctx.scale(-1, 1);

    const drawingUtils = new DrawingUtils(ctx);
    for (const landmarks of results.landmarks) {
      drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 5
      });
      drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 2 });
    }
    ctx.restore();
    setTimeout(clearAnnotation, 3000);
  }

  updatePlayerUI(gesture);

  if (gesture === 'TIDAK_TERDETEKSI' || gesture === 'ERROR') {
    showToast('🤔 Gesture tidak terdeteksi. Coba lagi.');
    resetCapture(); return;
  }

  await sleep(700);
  await playRound(gesture);
}


async function playRound(gesture) {
  el.aiIdle.style.display = 'flex';
  el.aiShow.style.display = 'none';

  try {
    // Local AI logic
    const gestures = ["BATU", "GUNTING", "KERTAS"];
    const aiGesture = gestures[Math.floor(Math.random() * gestures.length)];

    let result = "";
    if (gesture === aiGesture) {
      result = "SERI";
      localScores.draw++;
    } else if (
      (gesture === "BATU" && aiGesture === "GUNTING") ||
      (gesture === "GUNTING" && aiGesture === "KERTAS") ||
      (gesture === "KERTAS" && aiGesture === "BATU")
    ) {
      result = "MENANG";
      localScores.player++;
    } else {
      result = "KALAH";
      localScores.ai++;
    }

    const data = {
      player: gesture,
      ai: aiGesture,
      result: result,
      score: localScores
    };
    lastRoundData = data;

    await sleep(700);

    // Show AI
    el.aiIdle.style.display = 'none';
    el.aiGestureEmoji.textContent = G_EMOJI[data.ai] || '❓';
    el.aiShow.style.display = 'flex';
    el.aiTagEmoji.textContent = G_EMOJI[data.ai] || '❓';
    el.aiTagLabel.textContent = data.ai;

    // Game banner result
    const cfg = RESULTS[data.result];
    el.vsResult.textContent = cfg.banner;
    el.vsResult.className = `vs-result ${cfg.cls}`;

    // Update score
    updateScoreDisplay(data.score);

    await sleep(1200);
    showResultPage(data);

  } catch (err) {
    showToast('❌ Error game.');
    console.error(err);
    resetCapture();
  }
}


function showResultPage(data) {
  let outcome = data.result;
  if (gameMode === 'multiplayer' && data.result !== 'SERI') {
    outcome = (data.result === mpSlot) ? 'MENANG' : 'KALAH';
  }

  $('btnPlayAgain').disabled = false;
  $('btnPlayAgain').textContent = 'Ulangi Game';

  const cfg = RESULTS[outcome];
  el.resultBadge.textContent = cfg.badge;
  el.resultTitle.textContent = cfg.title;
  el.resultTitle.className = `result-title ${cfg.cls}`;

  if (gameMode === 'multiplayer') {
    // Left side (You), Right side (Opponent)
    const isP1 = (mpSlot === 'player1');
    const myGesture = isP1 ? data.player1_gesture : data.player2_gesture;
    const oppGesture = isP1 ? data.player2_gesture : data.player1_gesture;
    
    const myScore = isP1 ? data.score.player1 : data.score.player2;
    const oppScore = isP1 ? data.score.player2 : data.score.player1;

    // Names are already mapped to P1 = Local, P2 = Opponent in updateMpGameUI
    const myName = el.mpScoreP1Label.textContent.replace('🟢 ', '');
    const oppName = el.mpScoreP2Label.textContent.replace('🔴 ', '');

    el.resPlayerEmoji.textContent = G_EMOJI[myGesture] || '❓';
    el.resPlayerGesture.textContent = myGesture;
    el.resAiEmoji.textContent = G_EMOJI[oppGesture] || '❓';
    el.resAiGesture.textContent = oppGesture;

    el.rsPlayer.textContent = myScore;
    el.rsDraw.textContent = data.score.draw;
    el.rsAi.textContent = oppScore;

    el.rsPlayerLabel.textContent = myName;
    el.rsAiLabel.textContent = oppName;

    // Set text labels inside showdown card
    document.querySelector('.showdown-player .showdown-name').textContent = myName;
    document.querySelector('.showdown-ai .showdown-name').textContent = oppName;

    // Determine winner client-side color
    if (data.result === 'SERI') {
      el.resultTitle.textContent = 'SERI!';
      el.resultTitle.className = 'result-title draw';
    } else {
      const winnerName = (data.result === mpSlot) ? myName : oppName;
      el.resultTitle.textContent = `${winnerName} MENANG!`;
      // Use green (.win) if local player wins, red (.lose) if opponent wins
      el.resultTitle.className = (data.result === mpSlot) ? 'result-title win' : 'result-title lose';

      // Fire confetti particles
      if (data.result === mpSlot) {
        runParticles('win');
      } else {
        runParticles('lose');
      }
    }
  } else {
    // AI VS Mode
    el.resPlayerEmoji.textContent = G_EMOJI[data.player] || '❓';
    el.resPlayerGesture.textContent = data.player;
    el.resAiEmoji.textContent = G_EMOJI[data.ai] || '❓';
    el.resAiGesture.textContent = data.ai;
    
    el.rsPlayer.textContent = data.score.player;
    el.rsDraw.textContent = data.score.draw;
    el.rsAi.textContent = data.score.ai;

    el.rsPlayerLabel.textContent = 'Kamu';
    el.rsAiLabel.textContent = 'AI';

    document.querySelector('.showdown-player .showdown-name').textContent = 'Kamu';
    document.querySelector('.showdown-ai .showdown-name').textContent = 'AI';

    if (data.result === 'MENANG') runParticles('win');
    else if (data.result === 'KALAH') runParticles('lose');
  }

  goTo(6, { keepCamera: true });
  resetCapture();
}

// ── UI Helpers ────────────────────────────────────────────────
function updatePlayerUI(gesture) {
  el.playerTagEmoji.textContent = G_EMOJI[gesture] || '❓';
  el.playerTagLabel.textContent = gesture.replace('_', ' ');
  el.playerTag.classList.toggle('detected', gesture !== 'TIDAK_TERDETEKSI');
}

function resetPlayerUI() {
  el.playerTagEmoji.textContent = '❓';
  el.playerTagLabel.textContent = 'Menunggu...';
  el.playerTag.classList.remove('detected');
  el.vsResult.textContent = ''; el.vsResult.className = 'vs-result';
  clearAnnotation();
}

function resetAIUI() {
  el.aiIdle.style.display = 'flex';
  el.aiShow.style.display = 'none';
  el.aiTagEmoji.textContent = '🤖';
  el.aiTagLabel.textContent = 'Menunggu...';
}

function resetCapture() {
  isCapturing = false;
  el.captureBtn.disabled = !camActive;
}

function drawAnnotation(base64) {
  const img = new Image();
  img.onload = () => {
    const ctx = el.overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, el.overlayCanvas.width, el.overlayCanvas.height);
    ctx.drawImage(img, 0, 0, el.overlayCanvas.width, el.overlayCanvas.height);
  };
  img.src = base64;
  setTimeout(clearAnnotation, 3000);
}

function clearAnnotation() {
  const ctx = el.overlayCanvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, el.overlayCanvas.width, el.overlayCanvas.height);
}

function updateScoreDisplay(score) {
  bumpScore(el.scorePlayer, score.player);
  bumpScore(el.scoreDraw, score.draw);
  bumpScore(el.scoreAi, score.ai);
  el.nsPlayer.textContent = score.player;
  el.nsAi.textContent = score.ai;
}

function bumpScore(el, val) {
  el.textContent = val;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

// ── Score Reset (AI Mode) ─────────────────────────────────────
el.resetScoreBtn.addEventListener('click', async () => {
  localScores = { player: 0, draw: 0, ai: 0 };
  updateScoreDisplay(localScores);
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

async function handleFile(file) {
  const url = URL.createObjectURL(file);
  el.previewImg.src = url;
  el.annotatedWrap.style.display = 'none';
  el.uploadResultPanel.style.display = 'none';
  el.uploadLoading.style.display = 'flex';
  el.uploadDropInner.style.display = 'none';
  uploadDetectedGesture = null;
  el.playUploadBtn.disabled = true;

  if (!handLandmarker) {
    showToast('⏳ AI sedang loading...');
    el.uploadLoading.style.display = 'none';
    el.uploadDropInner.style.display = 'flex';
    return;
  }

  // Ensure running mode is IMAGE for static upload
  if (runningMode === "VIDEO") {
    runningMode = "IMAGE";
    await handLandmarker.setOptions({ runningMode: "IMAGE" });
  }

  el.previewImg.onload = async () => {
    try {
      const results = handLandmarker.detect(el.previewImg);

      let gesture = "TIDAK_TERDETEKSI";
      if (results.landmarks && results.landmarks.length > 0) {
        gesture = detectGestureLocal(results.landmarks);

        // Render landmarks to canvas manually if needed, or skip for now since it's local UI
        // We'll skip drawing to annotated image for simplicity in upload mode, or we can use a canvas over the image
      }

      el.uploadLoading.style.display = 'none';
      el.uploadResultPanel.style.display = 'block';

      uploadDetectedGesture = gesture;
      el.uploadEmoji.textContent = G_EMOJI[gesture] || '❓';
      el.uploadGestureLabel.textContent = gesture.replace('_', ' ');

      if (gesture !== 'TIDAK_TERDETEKSI') {
        el.playUploadBtn.disabled = false;
        showToast(`✅ Terdeteksi: ${gesture}`);
      } else {
        showToast('🤔 Gesture tidak terdeteksi.');
      }
    } catch (err) {
      el.uploadLoading.style.display = 'none';
      el.uploadDropInner.style.display = 'flex';
      showToast('❌ Error memproses gambar.');
    }
  };
}

el.playUploadBtn.addEventListener('click', async () => {
  if (!uploadDetectedGesture || uploadDetectedGesture === 'TIDAK_TERDETEKSI') return;
  updatePlayerUI(uploadDetectedGesture);
  resetAIUI();
  await playRound(uploadDetectedGesture);
});

function resetUpload() {
  el.uploadDropInner.style.display = 'flex';
  el.uploadResultPanel.style.display = 'none';
  el.uploadLoading.style.display = 'none';
    el.fileInput.value = '';
  uploadDetectedGesture = null;
  el.playUploadBtn.disabled = true;
}

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
    runningMode = "IMAGE";
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
    runningMode = "VIDEO";
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
// PARTICLES (Win/Lose)
// ═══════════════════════════════════════════
let particleAnimId = null;
let particles = [];

function runParticles(type) {
  const canvas = el.particleCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const color = type === 'win' ? ['#5DE8A0', '#4BBEFF', '#FFD94A'] : ['#FF5C5C', '#A78BFA', '#1A1A2E'];
  particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    vx: (Math.random() - 0.5) * 3,
    vy: Math.random() * 3 + 1,
    r: Math.random() * 6 + 2,
    color: color[Math.floor(Math.random() * color.length)],
    opacity: 1,
    rot: Math.random() * 360,
    rSpeed: (Math.random() - 0.5) * 4,
  }));

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rSpeed;
      if (p.y > canvas.height + 10) { p.y = -10; p.x = Math.random() * canvas.width; }
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
      ctx.restore();
    });
    particleAnimId = requestAnimationFrame(loop);
  }
  if (particleAnimId) cancelAnimationFrame(particleAnimId);
  loop();
  setTimeout(stopParticles, 4000);
}

function stopParticles() {
  if (particleAnimId) { cancelAnimationFrame(particleAnimId); particleAnimId = null; }
  const ctx = el.particleCanvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, el.particleCanvas.width, el.particleCanvas.height);
  particles = [];
}

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════
let toastTimer;
function showToast(msg, ms = 3000) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
}

// ═══════════════════════════════════════════
// HELPERS & INITIALIZATION
// ═══════════════════════════════════════════
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function init() {
  // Application is now serverless.
  // No need to check backend health.
  updateScoreDisplay(localScores);

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
  window.localScores = localScores;
}
