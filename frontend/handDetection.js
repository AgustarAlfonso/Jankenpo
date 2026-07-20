import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/vision_bundle.mjs";

export let handLandmarker = undefined;
export let runningMode = "IMAGE";

export function setRunningMode(mode) {
  runningMode = mode;
}

export const createHandLandmarker = async () => {
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
export function detectGestureLocal(landmarks) {
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
