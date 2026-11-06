/* Интерактивная взрыв-схема корпуса «Видеоспорт-компакт».
   Геометрия — assets/meshes.js (корпус Pi) и assets/meshes-mister.js (корпус MiSTer, подгружается по требованию);
   формат: base64 от gzip [u32 nv, u32 nt, f32 pos[nv*3], u32 idx[nt*3]].
   Источник — проект «Сборка Видеоспорт-Компакт» (варианты Pi 3 и MiSTer).
   Модель: Z вверх, мм. Детали лежат в собранных позициях, `off` — смещение полностью разобранного состояния.

   Что показывать, задаёт страница: window.vsView = { board: 'pi' | 'mister', withBoard: bool } и событие vs:platform.
   board выбирает корпус (Pi или MiSTer), withBoard — рисовать ли купленные платы внутри. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { toCreasedNormals } from 'three/addons/BufferGeometryUtils.js';

/* mi — геометрия для MiSTer; miNote — иное описание для MiSTer; only — деталь только для одного корпуса;
   needsBoard — покупная деталь, показывается лишь когда выбрана плата. */
const PARTS = [
  {id:'tray', file:'m/tray.bin', mi:'m/mi_tray.bin', n:1, name:'Поддон', note:'Дно 2,4 мм: стойки Pi, вентилятор на четырёх стойках, вставки под винты, язычок защёлки.',
   miNote:'Дно 2,4 мм: четыре стойки под плату MiSTer, вентилятор слева на четырёх стойках, окно microSD в правой стенке, язычок защёлки. Задней бобышки нет: заднюю стенку занимают порты.', color:'#ffffff', colorMi:'#1A1A1A', off:[0,0,0]},
  {id:'serial', file:'m/insert_serial.bin', n:2, name:'Табличка на дне', note:'Серебристая вставка с номером экземпляра, гравировка снизу.', color:'#c7cacf', metal:true, off:[0,0,-32], ph:[0.7,1]},
  {id:'port', file:'m/portplate_pi3.bin', n:3, name:'Пластина портов', note:'Сменная задняя пластина с окнами USB и LAN, два винта M3 снизу.', color:'#3a3f46', off:[0,45,0], ph:[0.7,1], only:'pi'},
  {id:'usb', file:'m/mi_ref_front_usb.bin', n:3, name:'Панельные USB-A ×2', note:'Покупные гнёзда на коротких удлинителях от IO-платы. Встают в окна передней стенки на два винта M3 каждое. Не печатаются.', color:'#aeb3bb', metal:true, off:[0,-40,-16], ph:[0.55,0.95], parent:'lid', only:'mister', needsBoard:true},
  {id:'lid', file:'m/lid.bin', mi:'m/mi_lid.bin', n:4, name:'Крышка', note:'Верх: наклонная панель, решётка над вентилятором, пазы под вставки, паз защёлки.',
   miNote:'Верх 42,5 мм: наклонная панель, решётка над вентилятором, окна DC, HDMI, Saturn AV и аудио, а также RJ45 и USB-A под keystone в задней стенке, окно USB-A слева, окно SNAC справа, два окна USB-A спереди.', color:'#c51d4a', colorMi:'#004F9F', off:[0,0,108], ph:[0.25,0.7]},
  {id:'plate', file:'m/switchplate.bin', mi:'m/mi_switchplate.bin', n:5, name:'Пластина кнопок', note:'Держит четыре Choc и энкодер, четыре винта M3 к бобышкам на панели. Снимается вместе с проводами.', color:'#6b717b', off:[0,0,-52], ph:[0.55,0.95], parent:'lid'},
  {id:'panel', file:'m/insert_panel.bin', mi:'m/mi_insert_panel.bin', n:6, name:'Панель управления', note:'Серебристая вставка на скосе с пятью окнами под колпачки и ручку.', color:'#c7cacf', metal:true, offNormalDeg:42.6, offDist:34, ph:[0.55,0.9], parent:'lid'},
  {id:'emblem', file:'m/insert_emblem.bin', mi:'m/mi_insert_emblem.bin', n:7, name:'Эмблема', note:'Чёрный квадрат на верхней плоскости, поле под наклейку.', color:'#17181c', off:[0,0,34], ph:[0.55,0.9], parent:'lid'},
  {id:'frame', file:'m/insert_emblem_frame.bin', mi:'m/mi_insert_emblem_frame.bin', n:8, name:'Рамка эмблемы', note:'Серебристая рамка 0,4 мм поверх эмблемы.', color:'#c7cacf', metal:true, off:[0,0,16], ph:[0.7,1], parent:'emblem'},
  {id:'name', file:'m/insert_nameplate.bin', mi:'m/mi_insert_nameplate.bin', n:9, name:'Шильдик «ВИДЕОСПОРТ»', note:'Плашка и буквы одним телом: буквы выступают на 0,6 мм.', color:'#c7cacf', metal:true, off:[0,0,34], ph:[0.55,0.9], parent:'lid'},
  {id:'cap_pwr', file:'m/cap_power.bin', mi:'m/mi_cap_power.bin', n:10, name:'Колпачок СЕТЬ', note:'Красный, 17 × 11 мм, две ножки на Choc. Нажатие включает, удержание 1 с выключает.', color:'#c0392b', offNormalDeg:42.6, offDist:42, ph:[0,0.35], parent:'lid'},
  {id:'cap_a', file:'m/cap_keya.bin', mi:'m/mi_cap_keya.bin', n:11, name:'Клавиша A', note:'Кремовая «пианино», 14 × 11 мм. Кнопка A геймпада, назначение настраивается.', color:'#e2d6b6', offNormalDeg:42.6, offDist:42, ph:[0,0.35], parent:'lid'},
  {id:'cap_b', file:'m/cap_keyb.bin', mi:'m/mi_cap_keyb.bin', n:12, name:'Клавиша B', note:'Такая же клавиша, вторая настраиваемая кнопка.', color:'#e2d6b6', offNormalDeg:42.6, offDist:42, ph:[0,0.35], parent:'lid'},
  {id:'knob', file:'m/knob.bin', mi:'m/mi_knob.bin', n:13, name:'Ручка', note:'Рифлёная Ø 19 мм на D-валу энкодера. Вращение листает меню, нажатие запускает игру.', color:'#c7cacf', metal:true, offNormalDeg:42.6, offDist:55, ph:[0,0.35], parent:'lid'},
  {id:'cap_rst', file:'m/cap_reset.bin', mi:'m/mi_cap_reset.bin', n:14, name:'Колпачок СБРОС', note:'Кремовый, 17 × 10 мм. Нажатие сбрасывает игру, удержание 1,5 с выходит в список.', color:'#e2d6b6', offNormalDeg:42.6, offDist:42, ph:[0,0.35], parent:'lid'},
  {id:'fan', file:'m/ref_fan.bin', mi:'m/mi_ref_fan.bin', n:15, name:'Вентилятор 40 × 40 × 10', note:'Покупной, 5 В. Стоит на четырёх стойках поддона и привинчивается сверху винтами M3 с низкой головкой до закрытия крышки. Дует вверх в решётку.',
   miNote:'Покупной, 5 В. Стоит слева на четырёх стойках поддона, сдвинут на 15 мм вперёд, и привинчивается сверху до закрытия крышки. Дует вверх в решётку.', color:'#4d525b', off:[118,0,46], ph:[0.7,0.95]},
  {id:'fan_rotor', file:'m/ref_fan_rotor.bin', mi:'m/mi_ref_fan_rotor.bin', n:15, name:'', note:'', color:'#7a808a', off:[0,0,0], parent:'fan', sub:true},
  // Купленные платы: рисуются, только когда выбрана «Малина» или MiSTer; в собранном корпусе они внутри и не видны
  {id:'pi', file:'m/ref_pi_pcb.bin', n:16, name:'Raspberry Pi 3', note:'Покупная плата на четырёх стойках M2.5 поддона, порты смотрят в окна правой стенки и в пластину портов. Не печатается.', color:'#0f7f5c', off:[0,0,42], ph:[0.78,1], only:'pi', needsBoard:true},
  {id:'pi_parts', file:'m/ref_pi_parts.bin', n:16, name:'', note:'', color:'#d7dae0', metal:true, off:[0,0,0], parent:'pi', sub:true, only:'pi', needsBoard:true},
  {id:'mboard', file:'m/mi_ref_mister_pcb.bin', n:16, name:'MiSTer: core + IO', note:'Две покупные платы на четырёх стойках поддона и спейсерах 16 мм. Задняя кромка смотрит в окна задней стенки. Не печатается.', color:'#1d5d8c', off:[0,0,42], ph:[0.78,1], only:'mister', needsBoard:true},
  {id:'mboard_parts', file:'m/mi_ref_mister_parts.bin', n:16, name:'', note:'', color:'#d7dae0', metal:true, off:[0,0,0], parent:'mboard', sub:true, only:'mister', needsBoard:true},
];

const $ = id => document.getElementById(id);
const viewer = $('viewer'), canvas = $('vcanvas'), statusEl = $('vstatus');
const toggle = $('vtoggle'), slider = $('vslider'), flipBtn = $('vflip'), zoomIn = $('vzin'), zoomOut = $('vzout'), srList = $('vparts');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const track = (action) => { if (!track.done) { track.done = true; (window.vsTrack || (() => {}))('viewer_use', { action }); } };

// Отладочные параметры адреса: ?still — без вращения, ?exploded — сразу разобран, ?below — вид снизу
const qs = location.search, flag = k => new RegExp('[?&]' + k + '\\b').test(qs);
const still = flag('still'), startExploded = flag('exploded');
const setStatus = (text) => { statusEl.textContent = text; statusEl.hidden = !text; };

// ----- подготовка: смещения деталей и список для скринридеров -----
for (const p of PARTS) {
  p.off = p.off || [0, 0, 0];
  if (p.offNormalDeg != null) { const a = THREE.MathUtils.degToRad(p.offNormalDeg); p.off = [0, -Math.sin(a) * p.offDist, Math.cos(a) * p.offDist]; }
  if (!p.sub) { p.li = document.createElement('li'); srList.appendChild(p.li); }
}
const byId = Object.fromEntries(PARTS.map(p => [p.id, p]));

// Что показываем: корпус под Pi или MiSTer и есть ли внутри купленная плата
let view = window.vsView || { board: 'pi', withBoard: true };
const wants = (p, v = view) => (!p.only || p.only === v.board) && (!p.needsBoard || v.withBoard);
const fileFor = (p, v = view) => (v.board === 'mister' && p.mi) ? p.mi : p.file;
const noteFor = (p, v = view) => (v.board === 'mister' && p.miNote) || p.note;

if (typeof DecompressionStream === 'undefined') { setStatus('Схема недоступна в этом браузере — обновите его, чтобы увидеть модель'); throw new Error('no DecompressionStream'); }

// ----- рендерер -----
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
catch (e) { setStatus('Браузер не смог запустить WebGL — 3D-схема недоступна'); throw e; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
const camera = new THREE.PerspectiveCamera(30, 1, 1, 20000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;   // полный облёт, в том числе снизу
controls.enableZoom = false; controls.enablePan = false;           // колесо мыши и жесты не перехватывают прокрутку страницы
controls.autoRotate = !reduce && !still; controls.autoRotateSpeed = 1.1;
canvas.style.touchAction = 'none';                                 // браузер сам не трогает жесты по схеме — решаем сами (ниже)
controls.addEventListener('start', () => { controls.autoRotate = false; track('rotate'); });

/* На тач-экранах жест не должен одновременно крутить модель и листать страницу:
   направление первого движения выбирает режим — горизонтальный жест вращает модель,
   вертикальный прокручивает страницу (OrbitControls его не видит). */
let gesture = null;   // {id, x, y, mode: null|'rotate'|'scroll'}
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || gesture) return;
  gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, mode: null };
}, true);
canvas.addEventListener('pointermove', e => {
  if (!gesture || e.pointerId !== gesture.id) return;
  const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
  if (!gesture.mode) {
    if (Math.hypot(dx, dy) < 8) return;                            // ждём заметного движения, чтобы понять намерение
    gesture.mode = Math.abs(dy) > Math.abs(dx) * 1.2 ? 'scroll' : 'rotate';
    if (gesture.mode === 'rotate') return;                         // дальше движения идут OrbitControls; вращение посчитается от точки касания
  }
  if (gesture.mode === 'scroll') {
    e.stopImmediatePropagation();                                  // модель не реагирует на жест прокрутки
    if (!gesture.smoothOff) { gesture.smoothOff = true; document.documentElement.style.scrollBehavior = 'auto'; }   // html{scroll-behavior:smooth} иначе делает прокрутку пальцем «резиновой»
    window.scrollBy(0, gesture.y - e.clientY);
    gesture.y = e.clientY;
  }
}, true);
const endGesture = e => {
  if (!gesture || e.pointerId !== gesture.id) return;
  if (gesture.smoothOff) document.documentElement.style.scrollBehavior = '';
  gesture = null;
};
canvas.addEventListener('pointerup', endGesture, true);
canvas.addEventListener('pointercancel', endGesture, true);

scene.add(new THREE.HemisphereLight(0xe8fff0, 0x40504a, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 2.0); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6; key.shadow.radius = 4;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x9dffc4, 0.9); scene.add(rim);      // зелёный контровой — отрывает тёмные детали от фона
const fill = new THREE.DirectionalLight(0xe8fff0, 1.1); scene.add(fill, fill.target);   // подсветка снизу, чтобы дно не чернело
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.55 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const root = new THREE.Group(); root.rotation.x = -Math.PI / 2; scene.add(root);   // CAD Z-up → three.js Y-up
const pivot = new THREE.Group(); root.add(pivot);

// ----- геометрия -----
const cache = new Map();
let miScript = null;   // данные корпуса MiSTer — отдельным файлом, грузим только когда они нужны
function ensureMister() {
  if (!miScript) miScript = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'assets/meshes-mister.js';
    s.onload = res; s.onerror = () => { miScript = null; rej(new Error('meshes-mister.js')); }; document.head.appendChild(s);
  });
  return miScript;
}
async function loadBin(url) {
  if (cache.has(url)) return cache.get(url);
  if (url.startsWith('m/mi_')) await ensureMister();
  const b64 = (window.MESHES || {})[url];
  if (!b64) throw new Error(url);
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const buf = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  const dv = new DataView(buf), nv = dv.getUint32(0, true), nt = dv.getUint32(4, true);
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, 8, nv * 3), 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(buf, 8 + nv * 12, nt * 3), 1));
  g = toCreasedNormals(g, THREE.MathUtils.degToRad(28));        // плоские грани CAD, гладкие скругления
  g.computeBoundingBox();
  const out = { g, e: new THREE.EdgesGeometry(g, 28) }; cache.set(url, out); return out;
}
const edgeFor = hex => { const c = new THREE.Color(hex); const l = c.getHSL({}).l; return c.clone().offsetHSL(0, 0, l > 0.5 ? -0.45 : 0.4); };
/* Цвет детали зависит от платы: у крышки и поддона заданы оба варианта (color — Малина, colorMi — MiSTer) */
const colorFor = (p, v = view) => (v.board === 'mister' && p.colorMi) ? p.colorMi : p.color;
function buildPart(p, geo) {
  const col = colorFor(p);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(col), roughness: p.metal ? 0.32 : 0.6, metalness: p.metal ? 0.8 : 0.04,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const mesh = new THREE.Mesh(geo.g, mat); mesh.castShadow = mesh.receiveShadow = true;
  mesh.add(new THREE.LineSegments(geo.e, new THREE.LineBasicMaterial({ color: edgeFor(col), transparent: true, opacity: 0.45 })));
  p.mesh = mesh; p.curColor = col; pivot.add(mesh);
}

// Приводит сцену к выбранному виду: подгружает нужную геометрию, меняет корпус и показывает/скрывает платы
let syncToken = 0;
async function syncParts() {
  const token = ++syncToken, v = view;         // всё решается по снимку выбора v: view может смениться, пока грузятся данные
  const want = PARTS.filter(p => wants(p, v));
  const geos = await Promise.all(want.map(p => loadBin(fileFor(p, v))));
  if (token !== syncToken) return false;       // за время загрузки запущен более новый проход
  want.forEach((p, i) => {
    const f = fileFor(p, v);
    if (!p.mesh) buildPart(p, geos[i]);
    else if (p.curFile !== f) { p.mesh.geometry = geos[i].g; p.mesh.children[0].geometry = geos[i].e; }
    p.curFile = f;
    const col = colorFor(p, v);
    if (p.mesh && p.curColor !== col) {           // перекрашиваем кэшированную деталь при смене платы
      p.mesh.material.color.set(col);
      p.mesh.children[0].material.color = edgeFor(col);
      p.curColor = col;
    }
  });
  for (const p of PARTS) {
    p.hidden = !wants(p, v);
    if (p.mesh) p.mesh.visible = !p.hidden;
    if (p.li) { p.li.hidden = p.hidden; p.li.textContent = `${p.name}. ${noteFor(p, v)}`; }
  }
  const asm = new THREE.Box3(); for (const p of PARTS) if (p.mesh && !p.hidden) asm.union(p.mesh.geometry.boundingBox);
  baseZ = asm.min.z;
  frameScene(); place();
  return true;
}

// ----- таймлайн разборки -----
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const phase = (t, ph) => ease(Math.min(1, Math.max(0, (t - (ph ? ph[0] : 0)) / ((ph ? ph[1] : 1) - (ph ? ph[0] : 0)))));
function offsetAt(p, t) {
  const k = phase(t, p.ph); const o = [p.off[0] * k, p.off[1] * k, p.off[2] * k];
  if (p.parent) { const q = offsetAt(byId[p.parent], t); o[0] += q[0]; o[1] += q[1]; o[2] += q[2]; }
  return o;
}
let t = startExploded ? 1 : 0, target = t, animating = false;   // по умолчанию корпус собран

// ----- кадрирование: камера держит модель крупно и в центре на любой стадии разборки -----
const viewDir = below => new THREE.Vector3(0.62, below ? -0.52 : 0.52, 0.78).normalize();
let baseZ = 0, fitDist = 1, curDist = null, zoomTarget = null;
function boxAt(tt) {
  const box = new THREE.Box3();
  for (const p of PARTS) if (p.mesh && !p.hidden) box.union(p.mesh.geometry.boundingBox.clone().translate(new THREE.Vector3(...offsetAt(p, tt))));
  return box;
}
function distFor(radius) {
  const r = viewer.getBoundingClientRect(); const aspect = r.width / Math.max(1, r.height);
  return radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.8 / Math.min(1, aspect * 1.05);
}
function applyFrame(reset) {
  const b = boxAt(t), c = b.getCenter(new THREE.Vector3()), size = b.getSize(new THREE.Vector3());
  pivot.position.set(-c.x, -c.y, -baseZ);
  const dist = distFor(0.5 * size.length());
  const tgt = new THREE.Vector3(0, c.z - baseZ, 0);
  if (reset || curDist == null) {
    controls.target.copy(tgt);
    camera.position.copy(tgt).add(viewDir(still && flag('below')).multiplyScalar(dist));
    zoomTarget = null;
  } else {
    const k = dist / curDist;                                  // сохраняем поворот и выбранный зум, меняется только масштаб кадра
    const off = camera.position.clone().sub(controls.target).multiplyScalar(k);
    controls.target.copy(tgt); camera.position.copy(tgt).add(off);
    if (zoomTarget != null) zoomTarget *= k;
  }
  curDist = fitDist = dist;
  controls.minDistance = dist * 0.3; controls.maxDistance = dist * 1.3;
}
function place() {
  for (const p of PARTS) if (p.mesh) p.mesh.position.set(...offsetAt(p, t));
  applyFrame(false);
}
function frameScene() {            // свет и земля считаются по полностью разобранному виду
  const box = boxAt(1), size = box.getSize(new THREE.Vector3()), R = 0.5 * size.length(), mid = (box.min.z + box.max.z) / 2 - baseZ;
  ground.scale.set(R * 12, R * 12, 1); ground.position.y = -0.05;
  key.position.set(R * 0.9, R * 1.6, R * 1.1); key.target.position.set(0, mid, 0);
  Object.assign(key.shadow.camera, { left: -R * 1.3, right: R * 1.3, top: R * 1.3, bottom: -R * 1.3, near: R * 0.1, far: R * 6 }); key.shadow.camera.updateProjectionMatrix();
  rim.position.set(-R, R * 0.7, -R); fill.position.set(R * 0.3, -R * 1.4, R * 0.5); fill.target.position.set(0, mid, 0);
}

// ----- зум: кнопки +/− и Ctrl/⌘ + колесо (щипок на трекпаде); обычное колесо листает страницу -----
function zoomBy(f) {
  const cur = camera.position.distanceTo(controls.target);
  zoomTarget = Math.min(fitDist * 1.3, Math.max(fitDist * 0.3, (zoomTarget ?? cur) * f)); controls.autoRotate = false; kick();
}
zoomIn.addEventListener('click', () => { track('zoom'); zoomBy(0.72); });
zoomOut.addEventListener('click', () => { track('zoom'); zoomBy(1 / 0.72); });
canvas.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); track('zoom'); zoomBy(Math.exp(e.deltaY * 0.004)); }, { passive: false });

// ----- кнопка, ползунок, вид сверху/снизу -----
const nextTarget = () => ((animating ? target : t) > 0.5 ? 0 : 1);
function syncUI() { slider.value = Math.round(t * 1000); toggle.textContent = nextTarget() === 0 ? 'Собрать' : 'Разобрать'; }
toggle.addEventListener('click', () => { track('toggle'); target = nextTarget(); if (reduce) { t = target; place(); syncUI(); kick(); return; } animating = true; syncUI(); kick(); });
slider.addEventListener('input', () => { track('slider'); animating = false; t = slider.value / 1000; target = t; place(); syncUI(); kick(); });

let fly = null;   // плавный облёт камеры к виду сверху/снизу
const underside = () => camera.position.y < controls.target.y;
const syncFlip = () => { flipBtn.textContent = underside() ? 'Верх' : 'Низ'; };
flipBtn.addEventListener('click', () => {
  track('flip'); controls.autoRotate = false;
  const off = camera.position.clone().sub(controls.target), len = off.length();
  const to = viewDir(!underside()).multiplyScalar(len);
  if (reduce) { camera.position.copy(controls.target).add(to); controls.update(); syncFlip(); kick(); return; }
  fly = { from: off, to, k: 0 }; kick();
});
controls.addEventListener('change', syncFlip);

// ----- размер и цикл: рисуем только пока схема на экране -----
let W = 1, H = 1;
function resize() { const r = viewer.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
new ResizeObserver(() => { resize(); if (ready) { applyFrame(true); controls.update(); } }).observe(viewer); resize();

let ready = false, onScreen = true, looping = false, last = performance.now();
function frame(now) {
  if (!onScreen || document.hidden) { looping = false; return; }
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (animating) { const step = dt / 2.4; t = target > t ? Math.min(target, t + step) : Math.max(target, t - step); if (t === target) animating = false; place(); syncUI(); }
  if (zoomTarget != null) {
    const off = camera.position.clone().sub(controls.target), len = off.length(), nl = len + (zoomTarget - len) * Math.min(1, dt * 9);
    camera.position.copy(controls.target).add(off.setLength(nl));
    if (Math.abs(zoomTarget - nl) < fitDist * 0.004) zoomTarget = null;
  }
  if (fly) {
    fly.k = Math.min(1, fly.k + dt / 0.7); const e = ease(fly.k);
    const len = camera.position.distanceTo(controls.target), dir = fly.from.clone().normalize().lerp(fly.to.clone().normalize(), e).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, len);
    if (fly.k === 1) fly = null;
  }
  controls.update(); renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function kick() { if (!looping && ready) { looping = true; last = performance.now(); requestAnimationFrame(frame); } }
new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) kick(); }, { threshold: 0.01 }).observe(viewer);
document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

if (flag('debug')) window.__vs = { PARTS };   // ?debug — открыть список деталей в консоли

// Страница сообщает, какой вид нужен (кнопки Корпус / Малина / MiSTer)
window.addEventListener('vs:platform', e => {
  view = e.detail;
  if (ready) syncParts().then(() => kick()).catch(err => console.error(err));
});

(async () => {
  setStatus('Загружаю детали…');
  try {
    let seen;
    do { seen = view; await syncParts(); } while (seen !== view);   // выбор мог измениться, пока грузились детали
    setStatus('');
    applyFrame(true); controls.update(); syncUI(); ready = true; kick();
    /* 3D готов — убираем статичный постер */
    const poster = $('vposter');
    if (poster) {
      poster.classList.add('off');
      poster.addEventListener('transitionend', () => poster.remove(), { once: true });
      setTimeout(() => poster.parentNode && poster.remove(), 800);   // страховка, если transitionend не пришёл
    }
  } catch (err) { setStatus('Не удалось загрузить детали модели'); console.error(err); }
})();
