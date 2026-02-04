// main.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/loaders/RGBELoader.js';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.19/+esm';

const container = document.getElementById('viewer-container');

// -----------------------------------------------------
// Renderer
// -----------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.physicallyCorrectLights = true;
container.appendChild(renderer.domElement);

// -----------------------------------------------------
// Szene & Kamera
// -----------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x404040);

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);
camera.position.set(0, 1.2, 2.5);

// -----------------------------------------------------
// Orbit Controls
// -----------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.autoRotate = false;
controls.autoRotateSpeed = 1.2;

// -----------------------------------------------------
// Lights
// -----------------------------------------------------
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
hemiLight.position.set(0, 1, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(4, 8, 4);
scene.add(dirLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Grid (optional, per GUI)
const grid = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
grid.visible = false;
scene.add(grid);

// -----------------------------------------------------
// Environment HDR (wie Studio-Licht)
// -----------------------------------------------------
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new RGBELoader()
  .setPath('env/')
  .load('studio.hdr', (hdrTex) => {
    const envMap = pmremGenerator.fromEquirectangular(hdrTex).texture;
    scene.environment = envMap;
    hdrTex.dispose();
    pmremGenerator.dispose();
  });

// -----------------------------------------------------
// GLB laden
// -----------------------------------------------------
const loader = new GLTFLoader().setPath('models/');
let model = null;

loader.load(
  'becher.glb', // <-- HIER dein GLB-Name
  (gltf) => {
    model = gltf.scene;
    scene.add(model);

    // Optional: Schatten (nur wenn du später Boden hinzufügst)
    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) {
          obj.material.depthWrite = true;
        }
      }
    });

    // Model automatisch einpassen
    frameObject(model);
  },
  undefined,
  (error) => {
    console.error('Fehler beim Laden der GLB-Datei:', error);
  }
);

// Framing-Funktion ähnlich wie bei Don
function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const fitHeightDistance =
    maxDim / (2 * Math.atan((Math.PI * camera.fov) / 360));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = Math.max(fitHeightDistance, fitWidthDistance);

  camera.position.copy(center);
  camera.position.z += distance * 1.2;
  camera.position.y += distance * 0.2;
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}

// -----------------------------------------------------
// GUI (Display / Lighting) – angelehnt an Don
// -----------------------------------------------------
const params = {
  background: '#404040',
  autoRotate: false,
  exposure: 1.0,
  grid: false,
  wireframe: false,
  dirLightIntensity: 2.0,
  hemiLightIntensity: 0.5,
  ambientIntensity: 0.3
};

const gui = new GUI({ title: 'Viewer Controls' });
gui.domElement.style.position = 'fixed';
gui.domElement.style.top = '20px';
gui.domElement.style.right = '20px';

const displayFolder = gui.addFolder('Display');
displayFolder
  .addColor(params, 'background')
  .name('Background')
  .onChange((val) => {
    scene.background = new THREE.Color(val);
  });

displayFolder
  .add(params, 'autoRotate')
  .name('Auto Rotate')
  .onChange((v) => {
    controls.autoRotate = v;
  });

displayFolder
  .add(params, 'grid')
  .name('Grid')
  .onChange((v) => {
    grid.visible = v;
  });

displayFolder
  .add(params, 'wireframe')
  .name('Wireframe')
  .onChange((v) => {
    if (!model) return;
    model.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        const apply = (m) => {
          if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
            m.wireframe = v;
          }
        };
        if (Array.isArray(obj.material)) obj.material.forEach(apply);
        else apply(obj.material);
      }
    });
  });

displayFolder.open();

const lightingFolder = gui.addFolder('Lighting');
lightingFolder
  .add(params, 'exposure', 0.1, 3.0, 0.05)
  .name('Exposure')
  .onChange((val) => {
    renderer.toneMappingExposure = val;
  });

lightingFolder
  .add(params, 'dirLightIntensity', 0.0, 5.0, 0.1)
  .name('Key Light')
  .onChange((v) => {
    dirLight.intensity = v;
  });

lightingFolder
  .add(params, 'hemiLightIntensity', 0.0, 3.0, 0.1)
  .name('Hemi Light')
  .onChange((v) => {
    hemiLight.intensity = v;
  });

lightingFolder
  .add(params, 'ambientIntensity', 0.0, 2.0, 0.05)
  .name('Ambient')
  .onChange((v) => {
    ambientLight.intensity = v;
  });

lightingFolder.open();

// -----------------------------------------------------
// Resize & Renderloop
// -----------------------------------------------------
window.addEventListener('resize', onWindowResize);

function onWindowResize() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
