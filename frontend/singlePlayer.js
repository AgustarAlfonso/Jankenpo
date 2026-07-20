import { HandLandmarker, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";
import { $, el } from "./domRefs.js";
import { handLandmarker, runningMode, setRunningMode, detectGestureLocal } from "./handDetection.js";
import { showToast } from "./toast.js";
import { runParticles, stopParticles } from "./particles.js";
import { G_EMOJI, RESULTS } from "./constants.js";
import { gameMode, mpSlot, goTo, sleep, mpRoomCode, currentPage } from "./app.js";

// State
export let stream = null;
export let camActive = false;
export let isCapturing = false;
export let uploadDetectedGesture = null;
export let lastRoundData = null;
export let localScores = { player: 0, draw: 0, ai: 0 };
export let spInputMode = 'webcam';

export function setSpInputMode(mode) { spInputMode = mode; }

// Functions
export function setupGameMode(mode) {
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

export async function startCamera() {
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

export function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  el.webcamVideo.style.display = 'none';
  el.overlayCanvas.style.display = 'none';
  el.camPlaceholder.classList.remove('hidden');
  el.startCamBtn.style.display = 'inline-flex';
  el.stopCamBtn.style.display = 'none';
  el.captureBtn.disabled = true;
  camActive = false;
}

export function runCountdown() {
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

export function showCountNum(n) {
  el.countdownOverlay.textContent = n;
  el.countdownOverlay.style.animation = 'none';
  void el.countdownOverlay.offsetWidth;
  el.countdownOverlay.style.animation = 'countdownPulse 0.85s ease';
}

export async function captureAndDetect() {
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
    setRunningMode("VIDEO");
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

export async function playRound(gesture) {
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

export function showResultPage(data) {
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

export function updatePlayerUI(gesture) {
  el.playerTagEmoji.textContent = G_EMOJI[gesture] || '❓';
  el.playerTagLabel.textContent = gesture.replace('_', ' ');
  el.playerTag.classList.toggle('detected', gesture !== 'TIDAK_TERDETEKSI');
}

export function resetPlayerUI() {
  el.playerTagEmoji.textContent = '❓';
  el.playerTagLabel.textContent = 'Menunggu...';
  el.playerTag.classList.remove('detected');
  el.vsResult.textContent = ''; el.vsResult.className = 'vs-result';
  clearAnnotation();
}

export function resetAIUI() {
  el.aiIdle.style.display = 'flex';
  el.aiShow.style.display = 'none';
  el.aiTagEmoji.textContent = '🤖';
  el.aiTagLabel.textContent = 'Menunggu...';
}

export function resetCapture() {
  isCapturing = false;
  el.captureBtn.disabled = !camActive;
}

export function drawAnnotation(base64) {
  const img = new Image();
  img.onload = () => {
    const ctx = el.overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, el.overlayCanvas.width, el.overlayCanvas.height);
    ctx.drawImage(img, 0, 0, el.overlayCanvas.width, el.overlayCanvas.height);
  };
  img.src = base64;
  setTimeout(clearAnnotation, 3000);
}

export function clearAnnotation() {
  const ctx = el.overlayCanvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, el.overlayCanvas.width, el.overlayCanvas.height);
}

export function updateScoreDisplay(score) {
  bumpScore(el.scorePlayer, score.player);
  bumpScore(el.scoreDraw, score.draw);
  bumpScore(el.scoreAi, score.ai);
  el.nsPlayer.textContent = score.player;
  el.nsAi.textContent = score.ai;
}

export function bumpScore(el, val) {
  el.textContent = val;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

export async function handleFile(file) {
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
    setRunningMode("IMAGE");
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

export function resetUpload() {
  el.uploadDropInner.style.display = 'flex';
  el.uploadResultPanel.style.display = 'none';
  el.uploadLoading.style.display = 'none';
    el.fileInput.value = '';
  uploadDetectedGesture = null;
  el.playUploadBtn.disabled = true;
}


export function initScoreDisplay() { updateScoreDisplay(localScores); }

export function resetLocalScores() { localScores = { player: 0, draw: 0, ai: 0 }; updateScoreDisplay(localScores); }

if (typeof window !== 'undefined') { window.localScores = localScores; }
