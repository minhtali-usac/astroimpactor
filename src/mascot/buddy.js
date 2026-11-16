// ============================================================================
//  IMPACTOR — Chó phi hành gia: người đồng hành xuyên suốt hệ thống
//  (cùng tính năng với Sên phi hành gia của Aurora-LAB)
//   • Bấm vào Chó: menu — gợi ý bước tiếp, “điều gì đang xảy ra?”, kiểm tra nhanh 3 câu,
//     học khái niệm liên quan, bật/tắt lời nhắc tự động.
//   • Phản ứng theo ngữ cảnh: chào khi vào phần mới, giải thích sự kiện, chạy tới nơi
//     vừa có chuyện, mừng khi thắng (pháo giấy), buồn khi thua.
//   • Đi dạo, nhảy, phóng to cho vui; ngủ gật sau 2 phút không tương tác; nhắc khi đứng yên.
//   • Luôn nổi trên các hộp thoại đang mở để không bao giờ “biến mất”.
// ============================================================================
import '../styles/mascot.css';
import { mountDog, snapshot } from './dog3d.js';
import { LINES } from './lines.js';

const KEY_MUTE = 'impactor.dog.mute';
const KEY_HELLO = 'impactor.dog.hello';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* bộ nhớ bị chặn */ } },
};
const reduce = () => matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// ---------- Pháo giấy (khi chiến thắng) ----------
function confetti(x, y) {
  if (reduce()) return;
  const c = el('canvas', 'dog-fx'); document.body.appendChild(c);
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const cols = ['#ff8a2b', '#ff5436', '#ffd166', '#5ee6a0', '#ffffff'];
  const P = Array.from({ length: 140 }, () => {
    const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 7;
    return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 5, r: 3 + Math.random() * 4, c: cols[(Math.random() * cols.length) | 0], rot: Math.random() * 6, vr: Math.random() * 0.4 - 0.2 };
  });
  let t = 0;
  (function f() {
    t++; g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of P) {
      p.vy += 0.22; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.max(0, 1 - t / 110);
      g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore();
    }
    if (t < 110) requestAnimationFrame(f); else c.remove();
  })();
}

/**
 * @param {'solar'|'impact'|'defense'} page
 * @param {{explain?: () => string}} opts
 */
export function initBuddy(page, opts = {}) {
  const L = LINES[page];
  const muted = () => store.get(KEY_MUTE) === '1';

  // ---------- DOM ----------
  const btn = el('button', 'mascot');
  btn.type = 'button'; btn.id = 'mascot';
  btn.setAttribute('aria-label', 'Chó phi hành gia, người đồng hành: bấm để mở menu');
  btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false');
  const fallback = el('span', 'mascot-img', '🐶');
  const bubble = el('span', 'mascot-bubble'); bubble.setAttribute('role', 'status');
  btn.append(fallback, bubble);
  document.body.appendChild(btn);
  const D3 = mountDog(btn);
  const mood = m => D3.mood(m);

  // ---------- Bóng thoại ----------
  let bubbleT = 0;
  function say(text, md) {
    if (!text) return;
    bubble.textContent = text;
    btn.classList.add('talk'); btn.classList.toggle('win', md === 'win');
    mood(md || 'talk');
    clearTimeout(bubbleT);
    bubbleT = setTimeout(() => btn.classList.remove('talk', 'win'), Math.max(3800, text.length * 58));
  }

  // ---------- Menu ----------
  const menu = el('div', 'bd-menu'); menu.id = 'buddy-menu'; menu.hidden = true;
  menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Chó phi hành gia');
  const avatar = snapshot(96);
  menu.innerHTML = `<div class="bd-head">${avatar ? `<img src="${avatar}" alt="" width="44" height="44">` : ''}<div><b>Chó phi hành gia</b><span>Mình đi cùng bạn suốt chuyến khám phá</span></div></div>`;
  const item = (ic, label, fn) => {
    const b = el('button', 'bd-item', `<span class="bd-ic" aria-hidden="true">${ic}</span><span>${label}</span>`);
    b.type = 'button'; b.setAttribute('role', 'menuitem');
    b.addEventListener('click', () => { close(); fn(); });
    menu.appendChild(b); return b;
  };
  item('💡', 'Gợi ý bước tiếp theo', hint);
  item('🔍', 'Điều gì đang xảy ra?', explain);
  item('🧪', 'Kiểm tra nhanh 3 câu', openQuiz);
  item('📚', 'Học khái niệm liên quan', openConcept);
  const muteBtn = el('button', 'bd-item bd-mute'); muteBtn.type = 'button'; muteBtn.setAttribute('role', 'menuitemcheckbox');
  muteBtn.addEventListener('click', () => { store.set(KEY_MUTE, muted() ? '0' : '1'); paintMute(); say(muted() ? 'Mình im lặng đây. Cần gì cứ bấm mình!' : 'Gâu! Mình sẽ nhắc bạn khi cần.'); });
  menu.appendChild(muteBtn);
  const paintMute = () => {
    const m = muted();
    muteBtn.setAttribute('aria-checked', String(!m));
    muteBtn.innerHTML = `<span class="bd-ic" aria-hidden="true">${m ? '🔕' : '🔔'}</span><span>${m ? 'Bật lời nhắc tự động' : 'Tắt lời nhắc tự động'}</span>`;
  };
  paintMute();
  document.body.appendChild(menu);

  function open() { clearTimeout(Move.busy); clearTimeout(Move.back); go(0, 0); wake(); menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); mood('talk'); menu.querySelector('.bd-item')?.focus({ preventScroll: true }); }
  function close() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }

  let hintIx = 0;
  function hint() { say(L.hints[hintIx++ % L.hints.length], 'think'); }
  function explain() { say(opts.explain?.() || 'Thử một thao tác ở bảng bên trái, mình sẽ giải thích ngay!', 'think'); }

  // ---------- Kiểm tra nhanh ----------
  const quizModal = el('div', 'modal'); quizModal.id = 'dogQuiz';
  quizModal.innerHTML = `<div class="modal-card modal-doc"><div class="modal-head"><h2>Kiểm tra nhanh</h2><button type="button" class="btn icon-btn" data-close aria-label="Đóng">✕</button></div><div class="modal-body"></div></div>`;
  const conceptModal = el('div', 'modal'); conceptModal.id = 'dogConcept';
  conceptModal.innerHTML = `<div class="modal-card modal-doc"><div class="modal-head"><h2>${L.concept.title}</h2><button type="button" class="btn icon-btn" data-close aria-label="Đóng">✕</button></div><div class="modal-body">${L.concept.html}</div></div>`;
  for (const m of [quizModal, conceptModal]) {
    document.body.appendChild(m);
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.classList.remove('show'); });
  }
  function openConcept() { conceptModal.classList.add('show'); say('Đọc xong thì thử ngay trên mô phỏng nhé!', 'think'); }
  function openQuiz() {
    const pool = [...L.quiz].sort(() => Math.random() - 0.5).slice(0, 3);
    const body = quizModal.querySelector('.modal-body');
    body.innerHTML = '';
    let right = 0, answered = 0;
    const score = el('p', 'quiz-score');
    pool.forEach((q, i) => {
      const box = el('div', 'quiz-q', `<p class="quiz-t"><b>Câu ${i + 1}.</b> ${q.q}</p>`);
      const why = el('p', 'quiz-why'); why.hidden = true;
      q.a.forEach((a, k) => {
        const b = el('button', 'quiz-opt'); b.type = 'button'; b.textContent = a;
        b.addEventListener('click', () => {
          if (box.dataset.done) return;
          box.dataset.done = '1'; answered++;
          box.querySelectorAll('.quiz-opt').forEach((x, j) => { x.disabled = true; if (j === q.c) x.classList.add('ok'); });
          if (k === q.c) right++; else b.classList.add('bad');
          why.hidden = false; why.textContent = (k === q.c ? '✓ Chính xác. ' : '✗ Chưa đúng. ') + q.why;
          if (answered === pool.length) {
            score.textContent = `Kết quả: ${right}/${pool.length} câu đúng`;
            if (right === pool.length) { say('Đúng hết! Giỏi quá, gâu gâu!', 'win'); const r = btn.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top); }
            else if (right === 0) say('Không sao! Thử mô phỏng thêm rồi làm lại nhé.', 'sad');
            else say(`Đúng ${right}/${pool.length} câu — xem giải thích rồi thử lại nhé!`, 'think');
          }
        });
        box.appendChild(b);
      });
      box.appendChild(why);
      body.appendChild(box);
    });
    const again = el('button', 'btn', '↻ Bộ câu hỏi khác'); again.type = 'button'; again.addEventListener('click', openQuiz);
    const foot = el('div', 'quiz-foot'); foot.append(score, again);
    body.appendChild(foot);
    quizModal.classList.add('show');
  }

  // ---------- Di chuyển: đi dạo, chạy tới nơi có chuyện, ngủ gật ----------
  const Move = { x: 0, y: 0, busy: 0, back: 0, wt: 0, gt: 0, sleeping: false };
  const anyModal = () => !!document.querySelector('.modal.show');
  const free = () => !reduce() && !muted() && !document.hidden && !anyModal() && menu.hidden;
  function go(x, y, after) {
    const dx = x - Move.x, dist = Math.hypot(dx, y - Move.y);
    const dur = Math.max(0.5, Math.min(2.4, dist / 520));
    btn.style.transitionDuration = `${dur}s, .55s`;
    btn.style.translate = x || y ? `${Math.round(x)}px ${Math.round(y)}px` : '';
    Move.x = x; Move.y = y;
    if (Math.abs(dx) > 8) D3.run(Math.sign(dx));
    btn.classList.toggle('bubble-left', innerWidth - 58 + x < innerWidth * 0.5);
    clearTimeout(Move.busy);
    Move.busy = setTimeout(() => { D3.run(0); after?.(); }, dur * 1000);
  }
  function offsetFor(px, py) {
    const cs = getComputedStyle(btn), w = btn.offsetWidth, h = btn.offsetHeight;
    const hx = innerWidth - (parseFloat(cs.right) || 0) - w / 2, hy = innerHeight - (parseFloat(cs.bottom) || 0) - h / 2;
    const tx = Math.max(60, Math.min(innerWidth - 60, px)), ty = Math.max(110, Math.min(innerHeight - 70, py));
    return [tx - hx, ty - hy];
  }
  function home(delay = 0) { clearTimeout(Move.back); Move.back = setTimeout(() => go(0, 0), delay); }
  function visit(px, py, o = {}) {
    if (!free()) { if (o.say && !muted()) say(o.say, o.mood); return; }
    wake();
    const [x, y] = offsetFor(px, py);
    go(x, y, () => { if (o.mood) mood(o.mood); if (o.say) say(o.say, o.mood); home(o.stay || 3800); });
  }
  function grow(ms = 2200, line) {
    if (reduce() || anyModal()) return;
    btn.classList.toggle('grow-corner', !Move.x && !Move.y); btn.classList.add('big'); mood('win');
    if (line) say(line, 'win');
    clearTimeout(Move.gt); Move.gt = setTimeout(() => btn.classList.remove('big'), ms);
  }
  const GROW = [
    'Ta-da! Đồ phi hành gia đẹp không?',
    'Mỗi ngày Trái Đất hứng ~100 tấn bụi đá từ vũ trụ!',
    'Chó Laika bay quanh Trái Đất từ năm 1957 đấy!',
    'Năm 2029, Apophis bay gần hơn cả vệ tinh địa tĩnh!',
  ];
  function wander() {
    clearTimeout(Move.wt);
    Move.wt = setTimeout(() => {
      if (free() && !Move.sleeping && !Move.x && !Move.y) {
        const r = Math.random();
        if (r < 0.5) visit(innerWidth * (0.3 + Math.random() * 0.4), innerHeight - 90, { mood: Math.random() < 0.5 ? 'hop' : 'think', stay: 2600 + Math.random() * 2000 });
        else if (r < 0.75) visit(innerWidth * (0.35 + Math.random() * 0.3), innerHeight * (0.45 + Math.random() * 0.25), { mood: 'hop', stay: 2400 });
        else if (r < 0.88) { mood('hop'); setTimeout(() => mood('hop'), 650); }
        else grow(2800, GROW[(Math.random() * GROW.length) | 0]);
      }
      wander();
    }, 24000 + Math.random() * 20000);
  }
  let napT = 0;
  function wake() {
    clearTimeout(napT); napT = setTimeout(nap, 120000);
    if (Move.sleeping) { Move.sleeping = false; D3.sleep(false); btn.classList.remove('napping'); grow(1400); }
  }
  function nap() {
    if (reduce() || anyModal()) return wake();
    Move.sleeping = true; home(); D3.sleep(true); btn.classList.add('napping');
  }
  // nhắc khi đứng yên quá lâu
  let idleT = 0;
  const resetIdle = () => { clearTimeout(idleT); idleT = setTimeout(() => { if (!muted() && !document.hidden && menu.hidden && !anyModal()) hint(); resetIdle(); }, 55000); };

  // ---------- Sự kiện ----------
  btn.addEventListener('click', e => { e.stopPropagation(); menu.hidden ? open() : close(); });
  btn.addEventListener('dblclick', e => { e.preventDefault(); close(); grow(2400, 'Gâu! Mình đây!'); });
  document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('#buddy-menu, #mascot')) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); close(); btn.focus(); } }, true);
  ['pointerdown', 'keydown', 'wheel'].forEach(ev => addEventListener(ev, () => { wake(); resetIdle(); }, { passive: true }));
  // khi một hộp thoại mở: về chỗ cũ và nổi lên trên hộp thoại
  new MutationObserver(() => {
    const m = anyModal();
    btn.classList.toggle('in-dialog', m); menu.classList.toggle('in-dialog', m);
    if (m) { clearTimeout(Move.busy); go(0, 0); }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  let rz = 0;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => go(0, 0), 300); });

  // lời chào: lần đầu vào mỗi phần
  const helloKey = `${KEY_HELLO}.${page}`;
  if (store.get(helloKey) !== '1' && !muted()) {
    store.set(helloKey, '1');
    const greet = () => (anyModal() ? setTimeout(greet, 1500) : say(L.intro, 'hop'));
    setTimeout(greet, 2200);
  }
  wander(); wake(); resetIdle();

  return {
    say, mood, hint, explain, open, close, grow, home: () => go(0, 0),
    /** Chạy tới điểm (px, py) trên màn hình rồi nói. */
    visit,
    visitEl(node, o) { if (!node) return; const r = node.getBoundingClientRect(); if (r.width) visit(r.left + r.width / 2, r.top - 46, o); },
    /** Mừng chiến thắng: chạy tới, xoay vòng, pháo giấy, phóng to. */
    celebrate(text, px, py) {
      say(text, 'win');
      const r = btn.getBoundingClientRect();
      confetti(px ?? r.left + r.width / 2, py ?? r.top);
    },
    sad(text) { say(text, 'sad'); },
    get muted() { return muted(); },
  };
}
