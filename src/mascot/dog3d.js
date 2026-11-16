// ============================================================================
//  IMPACTOR — Linh vật 3D: Chó phi hành gia của CLB Thiên văn USAC
//  Dựng bằng three.js từ các khối cơ bản (cùng cách làm với Sên phi hành gia của
//  Aurora-LAB). Chú lơ lửng như trong không trọng lực, nhìn theo con trỏ, chớp mắt,
//  vẫy đuôi, cụp/vểnh tai theo cảm xúc; nhảy mừng khi người học hoàn thành nhiệm vụ.
// ============================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FUR = 0xd9792a;     // lông vàng cam kiểu Shiba
const CREAM = 0xfff0dc;   // mõm, ngực, "lông mày"

function buildDog() {
  const root = new THREE.Group();   // lơ lửng
  const body = new THREE.Group();   // bộ đồ + đuôi
  const head = new THREE.Group();   // mũ + đầu chó (quay theo con trỏ)
  root.add(body, head);

  const white = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f8, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.18 });
  const grey = new THREE.MeshPhysicalMaterial({ color: 0xc9cdda, roughness: 0.3, metalness: 0.35, clearcoat: 0.6 });
  const fur = new THREE.MeshPhysicalMaterial({ color: FUR, roughness: 0.7, sheen: 0.25, sheenColor: new THREE.Color(0xffc080), sheenRoughness: 0.6 });
  const cream = new THREE.MeshPhysicalMaterial({ color: CREAM, roughness: 0.7, sheen: 0.4, sheenColor: new THREE.Color(0xffffff) });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x15121a, roughness: 0.15, clearcoat: 1 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xff7aa8, emissive: 0xff4f8a, emissiveIntensity: 0.25, roughness: 0.55 });

  // ---- bộ đồ phi hành gia ----
  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), white);
  torso.scale.set(1.24, 0.8, 0.95); torso.position.set(0, -1.38, -0.05);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.13, 20, 72), grey);
  collar.rotation.x = Math.PI / 2; collar.position.y = -0.84;
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.14, 40), new THREE.MeshStandardMaterial({ color: 0xff8a2b, emissive: 0xff6a10, emissiveIntensity: 0.6, roughness: 0.4 }));
  badge.position.set(0.42, -1.12, 0.84); badge.rotation.set(-0.35, 0.42, 0);
  const tag = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), new THREE.MeshStandardMaterial({ color: 0xff5436, emissive: 0xff3b1e, emissiveIntensity: 0.5 }));
  tag.position.set(-0.38, -1.1, 0.86); tag.rotation.set(-0.35, -0.42, 0);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.95, 0.42, 4, 4, 4), grey);
  pack.position.set(0, -1.25, -0.88);
  body.add(torso, collar, badge, tag, pack);
  // hai chân trước lông vàng thò ra khỏi tay áo
  const paws = [];
  for (const s of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.4, 24), white);
    sleeve.position.set(s * 0.82, -1.55, 0.55); sleeve.rotation.set(0.9, 0, s * 0.35);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), fur);
    paw.scale.set(1, 0.85, 1.1); paw.position.set(s * 0.9, -1.72, 0.78);
    body.add(sleeve, paw); paws.push(paw);
  }
  // đuôi cuộn kiểu Shiba sau lưng
  const tail = new THREE.Group(); tail.position.set(0.25, -1.62, -0.75);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.12, 0.22, -0.18), new THREE.Vector3(0.08, 0.48, -0.25),
    new THREE.Vector3(-0.12, 0.58, -0.12), new THREE.Vector3(-0.2, 0.44, 0.02),
  ]);
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 40, 0.11, 14), fur));
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 12), cream); tailTip.position.copy(tailCurve.getPoint(1));
  tail.add(tailTip);
  body.add(tail);

  // ---- mũ bảo hiểm (có lỗ phía trước) ----
  const OPEN = 0.72;
  const shellGeo = new THREE.SphereGeometry(1, 72, 48, 0, Math.PI * 2, OPEN, Math.PI - OPEN);
  shellGeo.rotateX(Math.PI / 2);
  const shell = new THREE.Mesh(shellGeo, white);
  const inner = new THREE.Mesh(new THREE.SphereGeometry(0.955, 48, 32), new THREE.MeshStandardMaterial({ color: 0x1b1e3d, roughness: 0.85, side: THREE.BackSide }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(Math.sin(OPEN), 0.06, 20, 96), grey);
  rim.position.z = Math.cos(OPEN);
  const glassGeo = new THREE.SphereGeometry(1.012, 64, 24, 0, Math.PI * 2, 0, OPEN);
  glassGeo.rotateX(Math.PI / 2);
  const glass = new THREE.Mesh(glassGeo, new THREE.MeshPhysicalMaterial({ color: 0xb8c4ff, transparent: true, opacity: 0.13, roughness: 0.04, clearcoat: 1, envMapIntensity: 2.2, depthWrite: false }));
  const shine = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.022, 10, 48, 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
  shine.position.z = 0.88; shine.rotation.z = 1.75;
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.14, 40), grey);
    ear.rotation.z = Math.PI / 2; ear.position.set(s * 1.0, 0.04, 0);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 32), white);
    cap.rotation.z = Math.PI / 2; cap.position.set(s * 1.04, 0.04, 0);
    head.add(ear, cap);
  }
  // ăng-ten trên mũ với đèn cam
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 12), grey); ant.position.set(0.32, 1.05, -0.1); ant.rotation.z = -0.3;
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff8a2b, emissive: 0xff8a2b, emissiveIntensity: 1.2 }));
  antTip.position.set(0.37, 1.2, -0.1);
  head.add(ant, antTip);

  // ---- chú chó ----
  const dog = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32), fur);
  skull.scale.set(1.05, 0.92, 0.9);
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.36, 40, 28), cream);
  mask.scale.set(1.08, 0.78, 0.72); mask.position.set(0, -0.14, 0.24);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), cream);
  muzzle.scale.set(1.15, 0.78, 0.95); muzzle.position.set(0, -0.15, 0.42);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.068, 24, 16), black);
  nose.scale.set(1.35, 0.9, 0.9); nose.position.set(0, -0.07, 0.6);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 14), pink);
  tongue.scale.set(0.9, 0.55, 0.5); tongue.position.set(0, -0.29, 0.5);
  dog.add(skull, mask, muzzle, nose, tongue);

  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * 0.17, 0.04, 0.42);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.072, 24, 16), black);
    ball.scale.set(1, 1.12, 0.6);
    const hi = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hi.position.set(s * -0.018 + 0.02, 0.03, 0.04);
    eye.add(ball, hi); dog.add(eye); eyes.push(eye);
    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), cream); // "lông mày" kiểu Shiba
    brow.scale.set(1.2, 0.8, 0.5); brow.position.set(s * 0.15, 0.17, 0.41);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: 0xff8cc6, emissive: 0xff5fae, emissiveIntensity: 0.3, roughness: 0.6 }));
    cheek.scale.set(0.07, 0.045, 0.02); cheek.position.set(s * 0.29, -0.1, 0.4); cheek.rotation.y = s * 0.6;
    dog.add(brow, cheek);
  }
  const ears = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * 0.26, 0.33, 0.02);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 24), fur); outer.position.y = 0.14; outer.scale.z = 0.55;
    const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 20), pink); innerEar.position.set(0, 0.12, 0.05); innerEar.scale.z = 0.4;
    pivot.add(outer, innerEar);
    pivot.rotation.z = -s * 0.32;
    dog.add(pivot); ears.push({ pivot, s });
  }
  dog.position.set(0, -0.2, 0.04);
  const glowLight = new THREE.PointLight(0xffd2a0, 1.1, 2.4); glowLight.position.set(0, 0.15, 0.6);

  head.add(shell, inner, rim, dog, glass, shine, glowLight);
  return { root, body, head, dog, eyes, ears, tail, tongue, paws, antTip };
}

function makeScene() {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xc9d8ff, 0x10121f, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2.2, 3, 4); scene.add(key);
  const rimV = new THREE.DirectionalLight(0xff5436, 1.3); rimV.position.set(-3.5, 1.2, -2); scene.add(rimV);
  const rimO = new THREE.DirectionalLight(0xff8a2b, 0.9); rimO.position.set(3.5, -1, -2); scene.add(rimO);
  const m = buildDog(); scene.add(m.root);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
  cam.position.set(0, -0.2, 6.6); cam.lookAt(0, -0.48, 0);
  return { scene, cam, m };
}

function makeRenderer(size, opts = {}) {
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, ...opts });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  r.setSize(size, size, false);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}
function withEnv(renderer, scene) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
}

/** Ảnh tĩnh PNG (data URL) của chú chó — dùng cho menu, hộp thoại. */
export function snapshot(size = 160) {
  try {
    const r = makeRenderer(size, { preserveDrawingBuffer: true }); r.setPixelRatio(1);
    const { scene, cam } = makeScene(); withEnv(r, scene);
    r.render(scene, cam);
    const url = r.domElement.toDataURL('image/png');
    r.dispose(); r.forceContextLoss();
    return url;
  } catch { return ''; }
}

/**
 * Gắn chú chó 3D vào nút. Trả về API điều khiển; nếu không có WebGL trả về API rỗng.
 * @param {HTMLElement} btn
 */
export function mountDog(btn) {
  const noop = { mood() {}, run() {}, sleep() {} };
  const size = () => btn.clientWidth || 96;
  let renderer;
  try { renderer = makeRenderer(size()); } catch { return noop; }
  // vẽ ở độ phân giải gấp ~2,2 lần để khi phóng to (scale 2,1) vẫn sắc nét
  renderer.setPixelRatio(Math.min(5, (window.devicePixelRatio || 1) * 2.2));
  const { scene, cam, m } = makeScene(); withEnv(renderer, scene);
  renderer.domElement.className = 'mascot-3d';
  btn.prepend(renderer.domElement);
  btn.classList.add('m3d');
  new ResizeObserver(() => renderer.setSize(size(), size(), false)).observe(btn);

  let tx = 0, ty = 0, yaw = 0, pitch = 0, blinkAt = 2.5, mood = null, moodT = 0;
  let run = 0, runK = 0, sleep = false, sleepK = 0, happyK = 0;
  addEventListener('pointermove', e => {
    const r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    tx = Math.max(-1, Math.min(1, (e.clientX - cx) / 500)); ty = Math.max(-1, Math.min(1, (e.clientY - cy) / 400));
  }, { passive: true });

  const clock = new THREE.Clock();
  const loop = () => {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    runK += ((run ? 1 : 0) - runK) * Math.min(1, dt * 6);
    sleepK += ((sleep ? 1 : 0) - sleepK) * Math.min(1, dt * 2);
    const wantHappy = mood === 'win' || mood === 'hop' || mood === 'talk' || run ? 1 : 0;
    happyK += (wantHappy - happyK) * Math.min(1, dt * 4);
    const wantYaw = run ? run * 0.95 : tx * 0.55 * (1 - sleepK);
    yaw += (wantYaw - yaw) * Math.min(1, dt * 5);
    pitch += ((sleep ? 0.38 : ty * 0.35) - pitch) * Math.min(1, dt * 4);
    m.root.position.y = Math.sin(t * 1.3) * 0.06;
    m.root.rotation.set(0, 0, Math.sin(t * 0.9) * 0.05);
    m.head.rotation.set(pitch, yaw, 0); m.body.rotation.y = yaw * 0.3;
    m.dog.position.y = -0.2 + Math.sin(t * 2.1) * 0.012;
    // đuôi vẫy: chậm khi bình thường, nhanh khi vui
    const wag = (0.25 + 0.55 * happyK) * (1 - sleepK);
    m.tail.rotation.set(0, 0, Math.sin(t * (4 + 10 * happyK)) * wag);
    // tai: vểnh khi tỉnh, cụp khi ngủ/buồn
    m.ears.forEach(({ pivot, s }, i) => { pivot.rotation.z = -s * (0.32 + 0.5 * sleepK) + Math.sin(t * 2.6 + i * 2) * 0.04; pivot.rotation.x = 0; });
    m.tongue.scale.set(0.9, 0.55 + 0.35 * happyK, 0.5 + 0.25 * happyK);
    m.tongue.position.y = -0.29 - 0.05 * happyK;
    m.antTip.material.emissiveIntensity = 0.8 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3));
    // chớp mắt
    blinkAt -= dt;
    const b = blinkAt < 0.12 ? 0.12 : 1;
    if (blinkAt < 0) blinkAt = 2.5 + Math.random() * 3;
    m.eyes.forEach(e => (e.scale.y = b * (1 - 0.88 * sleepK)));
    // chạy: nảy theo nhịp bước, nghiêng người, chân trước đạp
    if (runK > 0.01) {
      m.root.position.y += Math.abs(Math.sin(t * 13)) * 0.2 * runK;
      m.root.rotation.z += -(run || 0) * 0.2 * runK;
      m.paws.forEach((p, i) => (p.position.y = -1.72 + Math.sin(t * 13 + i * Math.PI) * 0.08 * runK));
    }
    if (sleepK > 0.01) m.root.position.y = Math.sin(t * 0.8) * 0.05 * sleepK - 0.06 * sleepK;
    // cảm xúc
    if (mood) {
      moodT += dt;
      if (mood === 'hop') { const k = Math.min(1, moodT / 0.55); m.root.position.y += Math.sin(k * Math.PI) * 0.55; if (k >= 1) mood = null; }
      else if (mood === 'win') { const k = Math.min(1, moodT / 1.1); m.root.position.y += Math.sin(k * Math.PI) * 0.45; m.root.rotation.y = k * Math.PI * 2; if (k >= 1) { mood = null; m.root.rotation.y = 0; } }
      else if (mood === 'think') {
        const k = Math.min(1, moodT / 0.4) * Math.max(0, Math.min(1, (2.4 - moodT) / 0.4));
        m.head.rotation.z = 0.28 * k; m.ears[0].pivot.rotation.z += 0.5 * k; // nghiêng đầu, cụp một tai
        if (moodT > 2.4) { mood = null; m.head.rotation.z = 0; }
      } else if (mood === 'sad') {
        const k = Math.min(1, moodT / 0.5) * Math.max(0, Math.min(1, (2.6 - moodT) / 0.5));
        m.head.rotation.x += 0.32 * k; m.root.position.y -= 0.12 * k;
        m.ears.forEach(({ pivot, s }) => (pivot.rotation.z += -s * 0.7 * k));
        if (moodT > 2.6) mood = null;
      } else { m.head.rotation.x += Math.sin(moodT * 12) * 0.08 * Math.max(0, 1 - moodT / 1.2); if (moodT > 1.2) mood = null; }
    }
    renderer.render(scene, cam);
  };
  requestAnimationFrame(loop);

  return { mood(x) { mood = x; moodT = 0; }, run(d) { run = d || 0; }, sleep(v) { sleep = !!v; } };
}
