// main.js
// =====================================================
// Three.js-Viewer für EventCup Becher
// - lädt NeuerBecher1.glb aus asset/
// - nutzt ein EXR-HDRI (Footprint Court) wie bei Don
// - einfache GUI für Display, Lighting und Material
// =====================================================

import * as THREE from "https://unpkg.com/three@0.150.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.150.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://unpkg.com/three@0.150.0/examples/jsm/loaders/GLTFLoader.js";
import { EXRLoader } from "https://unpkg.com/three@0.150.0/examples/jsm/loaders/EXRLoader.js";
import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.18/dist/lil-gui.esm.js";

// === Pfade zu deinen Dateien =========================
const MODEL_URL = "asset/NeuerBecher1.glb";

// Environment aus Dons Setup (funktionierendes EXR-HDRI)
const ENV_URL =
  "https://storage.googleapis.com/donmccurdy-static/footprint_court_2k.exr";

// === Grund-Setup =====================================
const container = document.getElementById("viewer-container");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x191919); // dunkles Grau (wie Don)

const camera = new THREE.PerspectiveCamera(
  35,
  container.clientWidth / container.clientHeight,
  0.01,
  100
);
camera.position.set(0, 1.3, 4);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

// === OrbitControls ===================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.2, 0);

// === Licht wie im Studio =============================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
keyLight.position.set(2, 4, 5);
scene.add(keyLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x080820, 0.6);
scene.add(hemiLight);

// === Loader ==========================================
const gltfLoader = new GLTFLoader();
const exrLoader = new EXRLoader().setDataType(THREE.FloatType);

// === Variablen für Model & Material ==================
let cup; // 3D Objekt
let cupMaterial; // PrincipledMaterial / MeshPhysicalMaterial

// === Environment laden (mit Fehlerbehandlung) ========
function loadEnvironment() {
  return new Promise((resolve) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    exrLoader.load(
      ENV_URL,
      (texture) => {
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;

        scene.environment = envMap;

        // Wenn du das HDRI auch als Hintergrund willst:
        // scene.background = envMap;

        texture.dispose();
        pmremGenerator.dispose();
        resolve();
      },
      undefined,
      (err) => {
        console.error("HDRI konnte nicht geladen werden:", err);
        pmremGenerator.dispose();
        // Wir machen ohne Environment weiter, damit nichts crasht
        resolve();
      }
    );
  });
}

// === GLB laden =======================================
function loadModel() {
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      MODEL_URL,
      (gltf) => {
        cup = gltf.scene;
        scene.add(cup);

        // Auto-Framing: Model in die Mitte setzen & Kamera darauf einstellen
        const box = new THREE.Box3().setFromObject(cup);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        // Modell auf Ursprung verschieben
        cup.position.sub(center);

        // Kamera-Distanz so wählen, dass der Becher gut ins Bild passt
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = (camera.fov * Math.PI) / 180;
        let cameraZ = maxDim / (2 * Math.tan(fov / 2));
        cameraZ *= 1.6; // kleiner Sicherheitsfaktor, damit nichts abgeschnitten wird

        camera.position.set(0, maxDim * 0.25, cameraZ);
        controls.target.set(0, maxDim * 0.25, 0);
        controls.update();

        camera.near = cameraZ / 100;
        camera.far = cameraZ * 10;
        camera.updateProjectionMatrix();

        // Hauptmaterial finden (Becher)
        cup.traverse((child) => {
          if (child.isMesh && !cupMaterial) {
            cupMaterial = child.material;
          }
        });

        resolve();
      },
      undefined,
      (error) => {
        console.error("Fehler beim Laden von NeuerBecher1.glb:", error);
        reject(error);
      }
    );
  });
}

// === GUI (lil-gui) ===================================
const gui = new GUI({ title: "Viewer Controls" });

// Display
const displayFolder = gui.addFolder("Display");
const displayParams = {
  background: "#191919",
  autoRotate: false,
};
displayFolder
  .addColor(displayParams, "background")
  .name("Background")
  .onChange((value) => {
    scene.background = new THREE.Color(value);
  });
displayFolder
  .add(displayParams, "autoRotate")
  .name("Auto Rotate")
  .onChange((value) => {
    controls.autoRotate = value;
    controls.autoRotateSpeed = 0.8;
  });

// Lighting
const lightingFolder = gui.addFolder("Lighting");
const lightingParams = {
  exposure: 1.0,
  keyLight: 2.0,
  hemiLight: 0.6,
  ambient: 0.3,
};
lightingFolder
  .add(lightingParams, "exposure", 0.1, 2.0, 0.01)
  .name("Exposure")
  .onChange((value) => {
    renderer.toneMappingExposure = value;
  });
lightingFolder
  .add(lightingParams, "keyLight", 0, 4, 0.1)
  .name("Key Light")
  .onChange((value) => {
    keyLight.intensity = value;
  });
lightingFolder
  .add(lightingParams, "hemiLight", 0, 2, 0.1)
  .name("Hemi Light")
  .onChange((value) => {
    hemiLight.intensity = value;
  });
lightingFolder
  .add(lightingParams, "ambient", 0, 2, 0.05)
  .name("Ambient")
  .onChange((value) => {
    ambientLight.intensity = value;
  });

// Material (Plastic)
const materialFolder = gui.addFolder("Material (Plastic)");
const materialParams = {
  opacity: 0.35,
  transmission: 0.9,
  roughness: 0.15,
  envIntensity: 1.5,
  ior: 1.45,
};
function updateMaterialControls() {
  if (!cupMaterial) return;

  // Falls es kein MeshPhysicalMaterial ist, konvertieren
  if (!(cupMaterial instanceof THREE.MeshPhysicalMaterial)) {
    const newMat = new THREE.MeshPhysicalMaterial();
    newMat.copy(cupMaterial);
    newMat.roughness = cupMaterial.roughness ?? 0.15;
    newMat.metalness = cupMaterial.metalness ?? 0.0;
    cupMaterial = newMat;

    cup.traverse((child) => {
      if (child.isMesh) child.material = cupMaterial;
    });
  }

  cupMaterial.transparent = true;
  cupMaterial.opacity = materialParams.opacity;
  cupMaterial.transmission = materialParams.transmission;
  cupMaterial.roughness = materialParams.roughness;
  cupMaterial.envMapIntensity = materialParams.envIntensity;
  cupMaterial.ior = materialParams.ior;
  cupMaterial.thickness = 0.2;
  cupMaterial.needsUpdate = true;

  materialFolder
    .add(materialParams, "opacity", 0.1, 1.0, 0.01)
    .name("Opacity")
    .onChange((v) => {
      cupMaterial.opacity = v;
      cupMaterial.needsUpdate = true;
    });
  materialFolder
    .add(materialParams, "transmission", 0, 1.0, 0.01)
    .name("Transmission")
    .onChange((v) => {
      cupMaterial.transmission = v;
      cupMaterial.needsUpdate = true;
    });
  materialFolder
    .add(materialParams, "roughness", 0, 1.0, 0.01)
    .name("Roughness")
    .onChange((v) => {
      cupMaterial.roughness = v;
      cupMaterial.needsUpdate = true;
    });
  materialFolder
    .add(materialParams, "envIntensity", 0, 3, 0.05)
    .name("Env Intensity")
    .onChange((v) => {
      cupMaterial.envMapIntensity = v;
      cupMaterial.needsUpdate = true;
    });
  materialFolder
    .add(materialParams, "ior", 1.0, 2.0, 0.01)
    .name("IOR")
    .onChange((v) => {
      cupMaterial.ior = v;
      cupMaterial.needsUpdate = true;
    });
}

// === Resize ==========================================
window.addEventListener("resize", () => {
  const width = container.clientWidth;
  const height = container.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});

// === Render-Loop =====================================
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// === Start: zuerst Environment, dann Modell ==========
(async function start() {
  await loadEnvironment();
  await loadModel();
  updateMaterialControls();
  animate();
})();
