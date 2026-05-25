import { HandLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

const video = document.getElementById("webcam");
const canvas = document.getElementById("output_canvas");
const ctx = canvas.getContext("2d");
const drawingUtils = new DrawingUtils(ctx);

let audioCtx, source5;
const buffers = [];
const fileNames = ["assets/1.m4a", "assets/2.m4a", "assets/3.m4a", "assets/4.m4a", "assets/5.m4a"];

async function loadAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (const file of fileNames) {
    const res = await fetch(file);
    buffers.push(await audioCtx.decodeAudioData(await res.arrayBuffer()));
  }
}
function playNote(i) { if (buffers[i]) { const s = audioCtx.createBufferSource(); s.buffer = buffers[i]; s.connect(audioCtx.destination); s.start(); } }
function playLoop5() { if (source5) try { source5.stop(); } catch {} source5 = audioCtx.createBufferSource(); source5.buffer = buffers[4]; source5.loop = true; source5.connect(audioCtx.destination); source5.start(); }
function stop5() { if (source5) { try { source5.stop(); } catch {} source5 = null; } }

let fingerLocked = [[false, false, false, false], [false, false, false, false, false]];

async function setup() {
  await loadAudio();
  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
  const landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" },
    runningMode: "VIDEO", numHands: 2
  });
  video.srcObject = await navigator.mediaDevices.getUserMedia({ video: true });
  video.addEventListener("loadedmetadata", () => {
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    requestAnimationFrame(() => predictLoop(landmarker));
  }, { once: true });
}
function predictLoop(landmarker) {
  const results = landmarker.detectForVideo(video, performance.now());
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (results.landmarks) {
    results.landmarks.forEach((h, hIdx) => {
      drawingUtils.drawConnectors(h, HandLandmarker.HAND_CONNECTIONS, { color: "#000000", lineWidth: 5 });
      drawingUtils.drawLandmarks(h, { color: "#d2b48c", lineWidth: 1, radius: 4 });
      if (hIdx === 0) {
        [[8, 5], [12, 9], [16, 13], [20, 17]].forEach((f, i) => {
          const curled = h[f[0]].y > h[f[1]].y;
          if (curled && !fingerLocked[0][i]) { playNote(i); fingerLocked[0][i] = true; } 
          else if (!curled) fingerLocked[0][i] = false;
        });
      } else {
        const isFist = h[8].y > h[5].y && h[12].y > h[9].y && h[16].y > h[13].y && h[20].y > h[17].y;
        const dist = Math.hypot(h[4].x - h[8].x, h[4].y - h[8].y);
        if (isFist) stop5();
        else if (dist < 0.05 && !fingerLocked[1][4]) { playLoop5(); fingerLocked[1][4] = true; }
        else if (dist > 0.1) fingerLocked[1][4] = false;
      }
    });
  }
  requestAnimationFrame(() => predictLoop(landmarker));
}
window.addEventListener("click", () => { if (!audioCtx) setup(); }, { once: true });