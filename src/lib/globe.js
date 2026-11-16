// ============================================================================
//  Quả địa cầu 3D dùng chung (globe.gl + three.js cùng một phiên bản từ npm)
//  • Ngày/đêm theo vị trí Mặt Trời thật tại thời điểm hiện tại
//  • Nền sao, khí quyển, mặt nạ lục địa (phân biệt va chạm trên đất liền/đại dương)
//  • Luôn hiển thị nhãn Quần đảo Hoàng Sa & Trường Sa (Việt Nam)
// ============================================================================
import * as THREE from 'three';
import Globe from 'globe.gl';
import { feature as topoFeature, merge as topoMerge } from 'topojson-client';
import { subsolarPoint, pointInMultiPolygon, VIETNAM_ARCHIPELAGOS, VIETNAM_ISLANDS } from './geo.js';
import { CITIES } from './places.js';
import { adaptiveQuality } from './perf.js';
import earthDay from '../images/earth_day_4k.jpg';
import earthNight from '../images/earth_night_4k.jpg';
import earthSpec from '../images/earth_specularmap.jpg';

// --- Mặt nạ lục địa (Natural Earth 1:50m, tải lười để trang mở nhanh) -------
let landMulti = null;
export const landReady = import('world-atlas/land-50m.json').then(m => {
  const topo = m.default;
  const obj = topo.objects.land;
  const geom = obj.type === 'GeometryCollection' ? topoMerge(topo, obj.geometries) : topoFeature(topo, obj).geometry;
  landMulti = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  return landMulti;
}).catch(err => { console.warn('Không tải được mặt nạ lục địa', err); return null; });
/** true = đất liền, false = đại dương, null = chưa có dữ liệu */
export const isLand = (lat, lng) => (landMulti ? pointInMultiPolygon(lng, lat, landMulti) : null);

function makeMaterial(sunDir) {
  const loader = new THREE.TextureLoader();
  const t = (u, srgb = true) => { const x = loader.load(u); if (srgb) x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 8; return x; };
  return new THREE.ShaderMaterial({
    uniforms: { dayMap: { value: t(earthDay) }, nightMap: { value: t(earthNight) }, specMap: { value: t(earthSpec, false) }, sunDir: { value: sunDir } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D dayMap, nightMap, specMap; uniform vec3 sunDir;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main() {
        vec3 n = normalize(vN);
        float d = dot(n, sunDir);
        float dayMix = smoothstep(-0.1, 0.15, d);
        vec3 day = texture2D(dayMap, vUv).rgb * (0.35 + 0.85 * max(d, 0.0));
        vec3 night = texture2D(nightMap, vUv).rgb * vec3(1.5, 1.3, 1.0) + vec3(0.012, 0.018, 0.035);
        vec3 col = mix(night, day, dayMix);
        vec3 h = normalize(sunDir + vView);
        col += texture2D(specMap, vUv).r * pow(max(dot(n, h), 0.0), 40.0) * 0.45 * dayMix;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function starfield(radius, count = 5000) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([radius * s * Math.cos(th), radius * u, radius * s * Math.sin(th)], i * 3);
    c.setHSL(0.55 + Math.random() * 0.15, 0.4, 0.55 + Math.random() * 0.45).toArray(col, i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
}

/**
 * Tạo quả địa cầu.
 * @param {HTMLElement} el
 * @param {{showCities?: boolean, extraHtml?: Array, renderHtml?: Function}} opts
 */
export function createEarthGlobe(el, opts = {}) {
  const world = new Globe(el, { animateIn: false, rendererConfig: { antialias: true, powerPreference: 'high-performance' } })
    .width(innerWidth).height(innerHeight)
    .backgroundColor('#03050b')
    .showAtmosphere(true).atmosphereColor('#5fb4ff').atmosphereAltitude(0.16)
    .showGraticules(false);
  world.renderer().setPixelRatio(Math.min(devicePixelRatio, 2));

  const R = world.getGlobeRadius();
  const sub = subsolarPoint(new Date());
  const s = world.getCoords(sub.lat, sub.lng, 0);
  const sunDir = new THREE.Vector3(s.x, s.y, s.z).normalize();
  const material = makeMaterial(sunDir);
  world.globeMaterial(material);
  world.scene().add(starfield(R * 40));
  const light = world.lights?.() || [];
  light.forEach(l => { if (l.isDirectionalLight) l.position.copy(sunDir).multiplyScalar(R * 10); });

  // --- Nhãn HTML: quần đảo Việt Nam + thành phố + phần tử riêng của trang ---
  const archs = VIETNAM_ARCHIPELAGOS.map(a => ({ ...a, kind: 'archipelago' }));
  const cities = opts.showCities === false ? [] : CITIES.map(c => ({ ...c, kind: 'city' }));
  let showCities = true;
  const base = () => (showCities ? [...archs, ...cities] : archs);
  const renderBase = d => {
    const node = document.createElement('div');
    if (d.kind === 'archipelago') {
      node.className = `g-arch ${d.id}`;
      node.innerHTML = `<span class="flag"></span><span><b>${d.name}</b><small>${d.sub}</small></span>`;
    } else if (d.kind === 'city') {
      node.className = `g-city${d.vn ? ' vn' : ''}`;
      node.textContent = d.name;
    }
    return node;
  };
  let extra = opts.extraHtml || [];
  const applyHtml = () => world
    .htmlElementsData([...base(), ...extra])
    .htmlLat('lat').htmlLng('lng')
    .htmlAltitude(d => d.alt ?? (d.kind === 'city' ? 0.004 : 0.01))
    .htmlElement(d => {
      // Bọc trong một thẻ ngoài: CSS2DRenderer ghi đè `transform` của thẻ ngoài,
      // còn thẻ bên trong giữ được độ lệch riêng (vd. nhãn nằm trên/dưới điểm).
      const wrap = document.createElement('div');
      wrap.style.pointerEvents = 'none';
      wrap.appendChild((d.kind === 'archipelago' || d.kind === 'city') ? renderBase(d) : opts.renderHtml(d));
      return wrap;
    })
    .htmlElementVisibilityModifier((node, visible) => { node.style.opacity = visible ? 1 : 0; node.style.visibility = visible ? 'visible' : 'hidden'; });
  applyHtml();

  // Chấm các đảo thuộc hai quần đảo
  const islandPoints = VIETNAM_ISLANDS.map(i => ({ ...i, kind: 'island' }));
  world.pointsData(islandPoints).pointLat('lat').pointLng('lng')
    .pointColor(() => '#ffd23f').pointAltitude(0.002).pointRadius(0.09).pointsMerge(false)
    .pointLabel(d => `<div class="g-tip">${d.name}<br><small>Việt Nam</small></div>`);

  addEventListener('resize', () => world.width(innerWidth).height(innerHeight));
  // Khi nhìn từ xa, thu gọn nhãn để không che Trái Đất
  // Nhìn từ xa: bỏ hẳn nhãn thành phố khỏi DOM (mỗi nhãn tốn một lần cập nhật vị trí mỗi khung hình)
  const onZoom = pov => {
    const far = pov.altitude > 3;
    document.body.classList.toggle('globe-far', far);
    if (showCities === far) { showCities = !far; applyHtml(); }
  };
  world.onZoom(pov => { onZoom(pov); opts.onZoom?.(pov); });
  adaptiveQuality(world.renderer());

  return {
    world, R, sunDir, material, islandPoints,
    setExtraHtml(list) { extra = list; applyHtml(); },
    /** toạ độ three.js của (lat, lng, độ cao theo bán kính) */
    vec(lat, lng, alt = 0, out = new THREE.Vector3()) { const c = world.getCoords(lat, lng, alt); return out.set(c.x, c.y, c.z); },
    toLatLng(v) { return world.toGeoCoords({ x: v.x, y: v.y, z: v.z }); },
  };
}
