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

// wie bei Don: sRGB + ACES
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.physicallyCorrectLights = true;

container.appendChild(renderer.domElement);

// -----------------------------------------------------
// Szene & Kamera
// -----------------------------------------------------
const scene = new THREE.Scene();
// neutrales Grau – per GUI änderbar
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
// Lights (Key + Hemi + Ambient, wie im gltf-viewer-Stil)
// -----------------------------------------------------
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
hemiLight.position.set(0, 1, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(4, 8, 4);
scene.add(dirLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Grid (optional, über GUI)
const grid = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
grid.visible = false;
scene.add(grid);

// -----------------------------------------------------
// Environment HDR (studio_small_03_2k.hdr im Root)
// -----------------------------------------------------
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new RGBELoader()
  .load('studio_small_03_2k.hdr', (hdrTex) => {
    const envMap = pmremGenerator.fromEquirectangular(hdrTex).texture;
    scene.environment = envMap;
    // wenn du die HDRI auch als Hintergrund sehen willst:
    // scene.background = envMap;
    hdrTex.dispose();
    pmremGenerator.dispose();
  });

// -----------------------------------------------------
// GLB laden (NeuerBecher1.glb im Root)
// -----------------------------------------------------
const loader = new GLTFLoader();
let model = null;

loader.load(
  'NeuerBecher1.glb',
  (gltf) => {
    model = gltf.scene;
    scene.add(model);

    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        // WICHTIG: nichts an transparenten Materialien rumfummeln,
        // glTF-Materialien so lassen wie sie sind
      }
    });

    frameObject(model);
  },
  undefined,
  (error) => {
    console.error('Fehler beim Laden der GLB-Datei:', error);
  }
);

// Objekt automatisch schön ins Bild setzen (ähnlich wie bei Don)
function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const fitHeightDistance =
    maxDim / (2 * Math.atan((Math.PI * camera.fov * Math.PI) / 360 / Math.PI)); // etwas overkill, aber robust
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
// GUI (Display & Lighting – Don-Style)
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
