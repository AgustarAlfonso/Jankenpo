import { el, $ } from './domRefs.js';
import { handLandmarker, detectGestureLocal, runningMode, setRunningMode } from './handDetection.js';
import { showToast } from './toast.js';
import { G_EMOJI, RESULTS, PAGES } from './constants.js';
import { ref, set, get, onValue, update, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { db, afkManager, rematchManager, popupManager, roomLifecycleManager } from './app.js';
import { goTo, currentPage } from './navigation.js';
import { showResultPage } from './singlePlayer.js';
import { HandLandmarker, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";

export let ws = null;
export let mpSlot = null; // 'player1' or 'player2'
export let mpRoomCode = null;
export let mpInputMode = null; // 'webcam' | 'upload'
export let mpDetectedGesture = null;
export let mpStream = null;
export let mpCamActive = false;
export let mpIsCapturing = false;
export let fbUnsubscribe = null;

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

export function generateRandomName() {
  const adj = nameAdjectives[Math.floor(Math.random() * nameAdjectives.length)];
  const noun = nameNouns[Math.floor(Math.random() * nameNouns.length)];
  return `${adj} ${noun}`;
}

export function initMultiplayerFirebase(code, slot, name) {
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

export function updateLobbyUI(roomState) {
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

export function cleanUpMpSession() {
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

export async function leaveMpRoom() {
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

export function setupMultiplayerGameUI(roomState) {
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

export function updateMpGameUI(roomState) {
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

export async function startMpCamera() {
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

export function stopMpCamera() {
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

export async function handleMpUpload(file) {
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

export function runMpCountdown() {
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

export async function captureMpFrame() {
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

  // Freeze the video frame to let user see their captured gesture
  el.mpWebcamVideo.pause();

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
    showToast('🤔 Gesture tidak jelas. Coba lagi.');
    el.mpCaptureBtn.disabled = false;
    if (mpCamActive && el.mpWebcamVideo) {
      el.mpWebcamVideo.play().catch(e => console.error(e));
    }
  }
}

export async function sendMpGesture(gesture) {
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

export function displayMpRoundResult(roundData) {
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

export function resetMpArenaForNextRound() {
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

export function resetMpLocalArena() {
  clearMpAnnotation();
  mpDetectedGesture = null;
  el.mpPlayerTagEmoji.textContent = '❓';
  el.mpPlayerTagLabel.textContent = 'Siapkan tangan...';
  el.mpCaptureBtn.disabled = !mpCamActive;

  if (mpCamActive && el.mpWebcamVideo) {
    el.mpWebcamVideo.play().catch(e => console.error(e));
  }

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

export function clearMpAnnotation() {
  const ctx = el.mpOverlayCanvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, el.mpOverlayCanvas.width, el.mpOverlayCanvas.height);
}
