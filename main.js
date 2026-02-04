// main.js

// ===== Imports über Import Map (siehe index.html) =====
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import GUI from 'https://unpkg.com/lil-gui@0.19/dist/lil-gui.esm.js';

// ===== Grund-Setup =====
const container = document.getElementById('viewer-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x404040);

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  100
);
camera.position.set(0, 1.4, 3);

// ===== Renderer (ähnlich wie Don McCurdy) =====
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true
});
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.physicallyCorrectLights = true;

container.appendChild(renderer.domElement);

// ===== Orbit Controls =====
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 1.5;
controls.maxDistance = 6;
controls.target.set(0, 1.1, 0);

// ===== Licht-Setup =====
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
hemiLight.position.set(0, 1, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(4, 8, 4);
scene.add(dirLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Optionales Grid
const grid = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
grid.visible = false;
scene.add(grid);

// ===== Environment / HDRI =====
const rgbeLoader = new RGBELoader();

rgbeLoader.load(
  'studio_small_03_2k.hdr',
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    // scene.background = texture; // falls du den HDR-Hintergrund sichtbar haben willst
  },
  undefined,
  (err) => {
    console.error('HDRI konnte nicht geladen werden:', err);
  }
);

// ===== GLB laden =====
const gltfLoader = new GLTFLoader();
let model = null;

gltfLoader.load(
  'NeuerBecher1.glb',
  (gltf) => {
    model = gltf.scene;

    // Materialien minimal anfassen, damit Transparenz stabil ist
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
            m.needsUpdate = true;
          }
        });
      }
    });

    scene.add(model);
    frameObject(model);
  },
  undefined,
  (error) => {
    console.error('Fehler beim Laden von NeuerBecher1.glb:', error);
  }
);

// ===== Objekt schön ins Bild setzen =====
function frameObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  const fov = camera.fov * (Math.PI / 180);
  let distance = maxDim / (2 * Math.tan(fov / 2));

  distance *= 1.4;

  camera.position.copy(center);
  camera.position.x += distance * 0.2;
  camera.position.y += distance * 0.2;
  camera.position.z += distance;

  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}

// ===== GUI (ähnlich wie Don) =====
const params = {
  background: '#404040',
  autoRotate: false,
  exposure: 1.1,
  grid: false,
  dirLight: 2.0,
  hemiLight: 0.6,
  ambient: 0.3
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
  .name('Auto Rotate');
displayFolder
  .add(params, 'grid')
  .name('Grid')
  .onChange((v) => {
    grid.visible = v;
  });
displayFolder.open();

const lightFolder = gui.addFolder('Lighting');
lightFolder
  .add(params, 'exposure', 0.1, 3.0, 0.05)
  .name('Exposure')
  .onChange((v) => {
    renderer.toneMappingExposure = v;
  });
lightFolder
  .add(params, 'dirLight', 0.0, 5.0, 0.1)
  .name('Key Light')
  .onChange((v) => {
    dirLight.intensity = v;
  });
lightFolder
  .add(params, 'hemiLight', 0.0, 3.0, 0.1)
  .name('Hemi Light')
  .onChange((v) => {
    hemiLight.intensity = v;
  });
lightFolder
  .add(params, 'ambient', 0.0, 2.0, 0.05)
  .name('Ambient')
  .onChange((v) => {
    ambientLight.intensity = v;
  });
lightFolder.open();

// ===== Resize =====
window.addEventListener('resize', () => {
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
