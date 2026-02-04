// main.js

// ===== Imports über Import Map (siehe index.html) =====
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import GUI from "https://unpkg.com/lil-gui@0.19/dist/lil-gui.esm.js";

// ===== Grund-Setup =====
const container = document.getElementById("viewer-container");

const scene = new THREE.Scene();
// etwas dunkler, näher an Don
scene.background = new THREE.Color(0x191919);

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);
camera.position.set(0, 1.4, 3);

// ===== Renderer (Don-Style) =====
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true
});
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Farbmanagement & Tonemapping
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
// useLegacyLights lassen wir auf dem Default (false)
// renderer.useLegacyLights = false;

container.appendChild(renderer.domElement);

// ===== Orbit Controls =====
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 0.3;   // näher ranzoomen erlaubt
controls.maxDistance = 10;

// ===== Lichter (Key / Hemi / Ambient) =====
const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
keyLight.position.set(3, 5, 2);
scene.add(keyLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x080820, 0.6);
hemiLight.position.set(0, 1, 0);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Optionales Grid (über GUI zuschaltbar)
const grid = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
grid.visible = false;
scene.add(grid);

// ===== Environment / HDRI (aus asset/) via PMREM =====
const rgbeLoader = new RGBELoader();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

rgbeLoader.load(
  "asset/studio_small_03_2k.hdr",
  (texture) => {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;     // nur als Environment, Hintergrund bleibt Color

    texture.dispose();
    pmremGenerator.dispose();
  },
  undefined,
  (err) => {
    console.error("HDRI konnte nicht geladen werden:", err);
  }
);

// ===== GLB laden (aus asset/) =====
const gltfLoader = new GLTFLoader();
let model = null;

gltfLoader.load(
  "asset/NeuerBecher1.glb",
  (gltf) => {
    model = gltf.scene;

    // Materialien anpassen: Transparenz sauber & Environment etwas verstärken
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];

        mats.forEach((m) => {
          if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
            if (m.transparent) {
              m.depthWrite = false; // verhindert Flimmern bei Alpha
            }
            if ("envMapIntensity" in m) {
              m.envMapIntensity = 1.2; // etwas stärkere Reflektionen
            }
            m.needsUpdate = true;
          }
        });
      }
    });

    scene.add(model);
    frameObject(model); // Kamera passend setzen
  },
  undefined,
  (error) => {
    console.error("Fehler beim Laden von NeuerBecher1.glb:", error);
  }
);

// ===== Objekt ins Bild setzen (ähnlich wie Don) =====
function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  const fitOffset = 1.0; // wie nah dran, 1.0 ist ziemlich nah
  const fov = (camera.fov * Math.PI) / 180;
  let distance = (maxDim / 2) / Math.tan(fov / 2);

  distance *= fitOffset;

  // Kamera positionieren
  const direction = new THREE.Vector3(0.4, 0.3, 1).normalize();
  camera.position.copy(center).addScaledVector(direction, distance);

  camera.near = maxDim / 100;
  camera.far = maxDim * 100;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}

// ===== GUI (ähnlich wie bei Don) =====
const params = {
  background: "#191919",
  autoRotate: false,
  grid: false,
  exposure: 1.1,
  keyLight: 2.0,
  hemiLight: 0.6,
  ambient: 0.3
};

const gui = new GUI({ title: "Viewer Controls" });
gui.domElement.style.position = "fixed";
gui.domElement.style.top = "20px";
gui.domElement.style.right = "20px";

// Display-Ordner
const displayFolder = gui.addFolder("Display");
displayFolder
  .addColor(params, "background")
  .name("Background")
  .onChange((val) => {
    scene.background = new THREE.Color(val);
  });
displayFolder.add(params, "autoRotate").name("Auto Rotate");
displayFolder
  .add(params, "grid")
  .name("Grid")
  .onChange((v) => {
    grid.visible = v;
  });
displayFolder.open();

// Lighting-Ordner
const lightFolder = gui.addFolder("Lighting");
lightFolder
  .add(params, "exposure", 0.1, 3.0, 0.05)
  .name("Exposure")
  .onChange((v) => {
    renderer.toneMappingExposure = v;
  });
lightFolder
  .add(params, "keyLight", 0.0, 5.0, 0.1)
  .name("Key Light")
  .onChange((v) => {
    keyLight.intensity = v;
  });
lightFolder
  .add(params, "hemiLight", 0.0, 3.0, 0.1)
  .name("Hemi Light")
  .onChange((v) => {
    hemiLight.intensity = v;
  });
lightFolder
  .add(params, "ambient", 0.0, 2.0, 0.05)
  .name("Ambient")
  .onChange((v) => {
    ambientLight.intensity = v;
  });
lightFolder.open();

// ===== Resize =====
window.addEventListener("resize", () => {
  const width = container.clientWidth;
  const height = container.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
});

// ===== Render Loop =====
function animate() {
  requestAnimationFrame(animate);

  if (params.autoRotate && model) {
    model.rotation.y += 0.005;
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
