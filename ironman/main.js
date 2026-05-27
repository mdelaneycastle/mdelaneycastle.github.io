import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  FaceLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/vision_bundle.mjs";

const HELMET_TARGET_WIDTH_CM = 17;
const CAMERA_FOV_Y = 63;

const MODELS = [
  {
    key: "ironman",
    label: "Iron Man",
    file: "./iron-man_helmet_mk3.glb",
    defaults: { scale: 1.22, rot: [0.67, 0, 0], offset: [0, 6, -4.3] },
  },
  {
    key: "spiderman",
    label: "Spider-Man",
    file: "./spiderman.glb",
    defaults: { scale: 1.32, rot: [0.28, 0, 0], offset: [0, 0, -7.6] },
  },
];

const video = document.getElementById("video");
const threeCanvas = document.getElementById("three");
const loadingEl = document.getElementById("loading");
const loadingFill = document.getElementById("loading-fill");
const loadingText = document.getElementById("loading-text");

const TOTAL_STEPS = 4;
let completedSteps = 0;
function stepDone(label) {
  completedSteps++;
  const pct = Math.min(100, (completedSteps / TOTAL_STEPS) * 100);
  loadingFill.style.width = pct + "%";
  if (label) loadingText.textContent = label;
}
function hideLoading() {
  loadingEl.classList.add("is-hidden");
}
function showLoadingError(msg) {
  loadingText.textContent = "error: " + msg;
}

async function startWebcam() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise((r) => (video.onloadedmetadata = r));
  await video.play();
}

async function createLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
  );
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFacialTransformationMatrixes: true,
  });
}

async function setupThree(width, height) {
  const renderer = new THREE.WebGLRenderer({
    canvas: threeCanvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_Y, width / height, 1, 5000);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 3, 4);
  scene.add(key);

  const helmetGroup = new THREE.Group();
  helmetGroup.matrixAutoUpdate = false;
  helmetGroup.visible = false;
  scene.add(helmetGroup);

  const loader = new GLTFLoader();
  const models = [];
  for (const cfg of MODELS) {
    const gltf = await loader.loadAsync(cfg.file);
    const root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    root.position.sub(center);
    const baseScale = HELMET_TARGET_WIDTH_CM / size.x;

    const mount = new THREE.Group();
    mount.add(root);
    mount.scale.setScalar(baseScale * cfg.defaults.scale);
    mount.position.set(...cfg.defaults.offset);
    mount.rotation.set(...cfg.defaults.rot);
    mount.visible = false;
    helmetGroup.add(mount);

    models.push({ ...cfg, mount, baseScale });
    stepDone(`loaded ${cfg.label.toLowerCase()}`);
  }

  let activeIdx = 0;
  models[activeIdx].mount.visible = true;
  const setActive = (idx) => {
    models[activeIdx].mount.visible = false;
    activeIdx = idx;
    models[activeIdx].mount.visible = true;
  };

  return { renderer, scene, camera, helmetGroup, models, setActive };
}

function wireToggle(three) {
  const buttons = document.querySelectorAll("#model-toggle button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.model;
      const idx = three.models.findIndex((m) => m.key === key);
      if (idx === -1) return;
      three.setActive(idx);
      buttons.forEach((b) => b.classList.toggle("is-active", b === btn));
    });
  });
}

function run(landmarker, three) {
  const { renderer, scene, camera, helmetGroup } = three;
  let lastTs = -1;

  function frame() {
    if (video.readyState >= 2) {
      const ts = performance.now();
      if (ts !== lastTs) {
        lastTs = ts;
        const result = landmarker.detectForVideo(video, ts);
        const mats = result.facialTransformationMatrixes;
        if (mats && mats.length > 0) {
          helmetGroup.matrix.fromArray(mats[0].data);
          helmetGroup.matrixWorldNeedsUpdate = true;
          helmetGroup.visible = true;
        } else {
          helmetGroup.visible = false;
        }
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
}

(async () => {
  try {
    loadingText.textContent = "requesting camera";
    await startWebcam();
    stepDone("camera ready");

    loadingText.textContent = "loading face tracker";
    const landmarker = await createLandmarker();
    stepDone("face tracker ready");

    loadingText.textContent = "loading suits";
    const three = await setupThree(video.videoWidth, video.videoHeight);
    wireToggle(three);

    loadingText.textContent = "ready";
    setTimeout(hideLoading, 350);
    run(landmarker, three);
  } catch (err) {
    console.error(err);
    showLoadingError(err.message);
  }
})();
