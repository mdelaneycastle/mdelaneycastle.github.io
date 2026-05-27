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
const statusEl = document.getElementById("status");
const setStatus = (m) => (statusEl.textContent = m);

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
  const models = await Promise.all(
    MODELS.map(async (cfg) => {
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

      console.log(`[${cfg.key}] size:`, size, "baseScale:", baseScale);
      return { ...cfg, mount, baseScale };
    })
  );

  let activeIdx = 0;
  models[activeIdx].mount.visible = true;
  const setActive = (idx) => {
    models[activeIdx].mount.visible = false;
    activeIdx = idx;
    models[activeIdx].mount.visible = true;
  };
  const getActive = () => models[activeIdx];

  return { renderer, scene, camera, helmetGroup, models, setActive, getActive };
}

function wireControls(three) {
  const modelEl = document.getElementById("model");
  const scaleEl = document.getElementById("scale");
  const rotXEl = document.getElementById("rotX");
  const rotYEl = document.getElementById("rotY");
  const rotZEl = document.getElementById("rotZ");
  const offXEl = document.getElementById("offX");
  const offYEl = document.getElementById("offY");
  const offZEl = document.getElementById("offZ");
  const scaleV = document.getElementById("scale-v");
  const rotXV = document.getElementById("rotX-v");
  const rotYV = document.getElementById("rotY-v");
  const rotZV = document.getElementById("rotZ-v");
  const offXV = document.getElementById("offX-v");
  const offYV = document.getElementById("offY-v");
  const offZV = document.getElementById("offZ-v");
  const copyBtn = document.getElementById("copy");

  for (const m of three.models) {
    const opt = document.createElement("option");
    opt.value = m.key;
    opt.textContent = m.label;
    modelEl.appendChild(opt);
  }
  modelEl.value = three.getActive().key;

  function loadFromActive() {
    const a = three.getActive();
    scaleEl.value = (a.mount.scale.x / a.baseScale).toFixed(2);
    rotXEl.value = a.mount.rotation.x.toFixed(2);
    rotYEl.value = a.mount.rotation.y.toFixed(2);
    rotZEl.value = a.mount.rotation.z.toFixed(2);
    offXEl.value = a.mount.position.x.toFixed(1);
    offYEl.value = a.mount.position.y.toFixed(1);
    offZEl.value = a.mount.position.z.toFixed(1);
    updateReadouts();
  }

  function updateReadouts() {
    scaleV.textContent = parseFloat(scaleEl.value).toFixed(2);
    rotXV.textContent = parseFloat(rotXEl.value).toFixed(2);
    rotYV.textContent = parseFloat(rotYEl.value).toFixed(2);
    rotZV.textContent = parseFloat(rotZEl.value).toFixed(2);
    offXV.textContent = parseFloat(offXEl.value).toFixed(1);
    offYV.textContent = parseFloat(offYEl.value).toFixed(1);
    offZV.textContent = parseFloat(offZEl.value).toFixed(1);
  }

  function apply() {
    const a = three.getActive();
    a.mount.scale.setScalar(a.baseScale * parseFloat(scaleEl.value));
    a.mount.rotation.set(
      parseFloat(rotXEl.value),
      parseFloat(rotYEl.value),
      parseFloat(rotZEl.value)
    );
    a.mount.position.set(
      parseFloat(offXEl.value),
      parseFloat(offYEl.value),
      parseFloat(offZEl.value)
    );
    updateReadouts();
  }

  modelEl.addEventListener("change", () => {
    const idx = three.models.findIndex((m) => m.key === modelEl.value);
    three.setActive(idx);
    loadFromActive();
  });

  [scaleEl, rotXEl, rotYEl, rotZEl, offXEl, offYEl, offZEl].forEach((el) =>
    el.addEventListener("input", apply)
  );

  copyBtn.addEventListener("click", async () => {
    const a = three.getActive();
    const text =
      `${a.key}: { scale: ${parseFloat(scaleEl.value).toFixed(2)}, ` +
      `rot: [${parseFloat(rotXEl.value).toFixed(2)}, ` +
      `${parseFloat(rotYEl.value).toFixed(2)}, ` +
      `${parseFloat(rotZEl.value).toFixed(2)}], ` +
      `offset: [${parseFloat(offXEl.value).toFixed(1)}, ` +
      `${parseFloat(offYEl.value).toFixed(1)}, ` +
      `${parseFloat(offZEl.value).toFixed(1)}] }`;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "copied!";
      setTimeout(() => (copyBtn.textContent = "copy values"), 1200);
    } catch {
      copyBtn.textContent = text;
    }
  });

  loadFromActive();
}

function run(landmarker, three) {
  const { renderer, scene, camera, helmetGroup } = three;
  let lastTs = -1;
  let loggedMatrix = false;
  let lastFaceCount = -1;

  function frame() {
    if (video.readyState >= 2) {
      const ts = performance.now();
      if (ts !== lastTs) {
        lastTs = ts;
        const result = landmarker.detectForVideo(video, ts);
        const mats = result.facialTransformationMatrixes;
        const faces = result.faceLandmarks?.length ?? 0;
        if (faces !== lastFaceCount) {
          lastFaceCount = faces;
          setStatus(`faces: ${faces} | matrices: ${mats?.length ?? 0}`);
        }
        if (mats && mats.length > 0) {
          if (!loggedMatrix) {
            loggedMatrix = true;
            console.log("[ironman] first face matrix:", Array.from(mats[0].data));
          }
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
    setStatus("requesting camera…");
    await startWebcam();
    setStatus("loading face model…");
    const landmarker = await createLandmarker();
    setStatus("loading helmet…");
    const three = await setupThree(video.videoWidth, video.videoHeight);
    wireControls(three);
    setStatus("");
    run(landmarker, three);
  } catch (err) {
    console.error(err);
    setStatus("error: " + err.message);
  }
})();
