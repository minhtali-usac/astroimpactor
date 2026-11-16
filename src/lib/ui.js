// Tiện ích giao diện dùng chung: header/footer theo nhận diện USAC, thông báo, chú giải,
// hộp thoại, thanh trượt
import { ABOUT_HTML } from './about.js';

const PAGES = [
  { id: 'solar', href: './index.html', title: 'Quan sát NEO', sub: 'Hệ Mặt Trời 3D' },
  { id: 'impact', href: './impact.html', title: 'Destroyer', sub: 'kiến tạo va chạm' },
  { id: 'defense', href: './defense.html', title: 'Defender', sub: 'bảo vệ hành tinh' },
];

const ICON = {
  help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.2" fill="currentColor"/></svg>',
  about: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7.6" r="1.2" fill="currentColor"/></svg>',
};

function docModal(id, title, bodyHtml) {
  const m = document.createElement('div');
  m.className = 'modal'; m.id = id;
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', title);
  m.innerHTML = `<div class="modal-card modal-doc"><div class="modal-head"><h2>${title}</h2><button type="button" class="btn icon-btn" data-close aria-label="Đóng">✕</button></div><div class="modal-body">${bodyHtml}</div></div>`;
  document.body.appendChild(m);
  return m;
}

/**
 * Header + footer + hộp thoại Giới thiệu/Trợ giúp + câu hỏi dẫn dắt.
 * @param {'solar'|'impact'|'defense'} active
 * @param {string} extraHtml nút riêng của trang (đặt trước Trợ giúp)
 * @param {{question?: string, help?: string}} opts
 */
export function mountTopbar(active, extraHtml = '', opts = {}) {
  const bar = document.createElement('header');
  bar.className = 'topbar';
  bar.innerHTML = `
    <a class="brand" href="./index.html" aria-label="IMPACTOR, CLB Thiên văn USAC">
      <img class="brand-logo" src="./og-logo.png" alt="Logo CLB Thiên văn USAC" width="44" height="44">
      <span class="brand-text"><span class="brand-name">IMPACTOR</span><span class="brand-sub">Asteroid Impact Simulation</span></span>
    </a>
    <nav class="nav" aria-label="Phần mô phỏng">${PAGES.map((p, i) => `
      <a href="${p.href}" class="${p.id === active ? 'active' : ''}" ${p.id === active ? 'aria-current="page"' : ''} title="${p.title} · ${p.sub}">
        <span class="tab-num">${i + 1}</span><span class="tab-label"><span class="tab-title">${p.title}</span><span class="tab-sub">${p.sub}</span></span>
      </a>`).join('')}
    </nav>
    <div class="topbar-spacer"></div>
    ${extraHtml}
    ${opts.help ? `<button type="button" class="hbtn" id="helpBtn" title="Hướng dẫn sử dụng (phím ?)">${ICON.help}<span class="lbl">Trợ giúp</span></button>` : ''}
    <button type="button" class="hbtn" id="aboutBtn" title="Giới thiệu IMPACTOR">${ICON.about}<span class="lbl">Giới thiệu</span></button>`;
  document.body.prepend(bar);

  const ftr = document.createElement('footer');
  ftr.className = 'ftr';
  ftr.innerHTML = `<span class="ftr-slogan">CLB Thiên văn USAC · Lan tỏa thiên văn đến cộng đồng</span><span class="dot">·</span>
    <a href="mailto:clb.usac@gmail.com">clb.usac@gmail.com</a><span class="dot">·</span>
    <a href="https://www.facebook.com/clbusac" target="_blank" rel="noopener">Fanpage</a><span class="dot">·</span>
    <a href="https://web.clbtvusac.com/" target="_blank" rel="noopener">web.clbtvusac.com</a>`;
  document.body.appendChild(ftr);

  if (opts.question) {
    const q = document.createElement('div');
    q.className = 'stage-q'; q.setAttribute('aria-hidden', 'true');
    q.innerHTML = `<span class="stage-q-k">Câu hỏi</span><span class="stage-q-t"></span>`;
    q.querySelector('.stage-q-t').textContent = opts.question;
    document.body.appendChild(q);
  }

  docModal('aboutModal', 'Giới thiệu IMPACTOR', ABOUT_HTML);
  bar.querySelector('#aboutBtn').addEventListener('click', () => openModal('aboutModal'));
  if (opts.help) {
    docModal('helpModal', 'Hướng dẫn sử dụng', opts.help);
    bar.querySelector('#helpBtn').addEventListener('click', () => openModal('helpModal'));
    addEventListener('keydown', e => { if (e.key === '?' && !e.target.matches('input, select, textarea')) openModal('helpModal'); });
  }
  // Lần đầu ghé thăm: tự mở phần Giới thiệu
  let seen = true;
  try { seen = localStorage.getItem('impactor.about.v1') === '1'; localStorage.setItem('impactor.about.v1', '1'); } catch { /* bộ nhớ trình duyệt bị chặn */ }
  if (!seen) setTimeout(() => openModal('aboutModal'), 600);
  return bar;
}

// --- Thông báo --------------------------------------------------------------
let toastHost;
export function toast(title, message = '', type = 'info', ms = 3200) {
  if (!toastHost) { toastHost = document.createElement('div'); toastHost.className = 'toasts'; document.body.appendChild(toastHost); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div><div class="t"></div>${message ? '<div class="m"></div>' : ''}</div>`;
  el.querySelector('.t').textContent = title;
  if (message) el.querySelector('.m').textContent = message;
  toastHost.appendChild(el);
  while (toastHost.children.length > 3) toastHost.firstChild.remove();
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  el.addEventListener('click', close);
  setTimeout(close, ms);
}

// --- Chú giải khi rê chuột (thuộc tính data-tip, data-tip-title) ------------
export function initTooltips(root = document) {
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  document.body.appendChild(tip);
  let anchor = null;
  const place = () => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    let x = r.right + 10, y = r.top - 4;
    if (x + w > innerWidth - 8) x = Math.max(8, r.left - w - 10);
    if (y + h > innerHeight - 8) y = innerHeight - h - 8;
    tip.style.left = `${x}px`; tip.style.top = `${Math.max(8, y)}px`;
  };
  root.addEventListener('pointerover', e => {
    const el = e.target.closest?.('[data-tip]');
    if (!el || el === anchor) return;
    anchor = el;
    const title = el.getAttribute('data-tip-title');
    tip.innerHTML = (title ? `<b></b>` : '') + '<span></span>';
    if (title) tip.querySelector('b').textContent = title;
    tip.querySelector('span').textContent = el.getAttribute('data-tip');
    tip.classList.add('show');
    place();
  });
  root.addEventListener('pointerdown', () => { anchor = null; tip.classList.remove('show'); });
  root.addEventListener('pointerout', e => {
    if (anchor && !anchor.contains(e.relatedTarget)) { anchor = null; tip.classList.remove('show'); }
  });
}

// --- Thanh trượt: tô phần đã chọn ------------------------------------------
export function paintRange(el) {
  const min = +el.min || 0, max = +el.max || 100, v = +el.value;
  el.style.setProperty('--fill', `${((v - min) / (max - min)) * 100}%`);
}
export function initRanges(root = document) {
  root.querySelectorAll('input[type=range]').forEach(el => { paintRange(el); el.addEventListener('input', () => paintRange(el)); });
}

// --- Hộp thoại -------------------------------------------------------------
export function openModal(id) { document.getElementById(id)?.classList.add('show'); }
export function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }
export function initModals() {
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.classList.remove('show'); });
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show')); });
}

// --- Màn hình tải ----------------------------------------------------------
export function loader() {
  const el = document.getElementById('loader');
  const bar = el?.querySelector('.loader-bar > div');
  const txt = el?.querySelector('.loader-text');
  return {
    set(p, msg) { if (bar) bar.style.width = `${Math.round(p * 100)}%`; if (msg && txt) txt.textContent = msg; },
    done() { el?.classList.add('done'); setTimeout(() => el?.remove(), 700); },
    fail(msg) { if (txt) { txt.textContent = msg; txt.style.color = 'var(--danger)'; } },
  };
}

/** Nút thu gọn bảng (khi bấm vào tiêu đề có data-collapse). */
export function initCollapsibles() {
  document.querySelectorAll('[data-collapse]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = document.getElementById(btn.dataset.collapse);
      p?.classList.toggle('collapsed');
      btn.textContent = p?.classList.contains('collapsed') ? '▾' : '▴';
    });
  });
}

/** Tải tệp với tiến độ (Content-Length). */
export async function fetchWithProgress(url, onProgress, as = 'arrayBuffer') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const total = +res.headers.get('content-length') || 0;
  if (!res.body || !total) { const out = await res[as](); onProgress?.(1); return out; }
  const reader = res.body.getReader();
  const chunks = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length; onProgress?.(Math.min(1, got / total));
  }
  const buf = new Uint8Array(got); let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.length; }
  if (as === 'arrayBuffer') return buf.buffer;
  const text = new TextDecoder().decode(buf);
  return as === 'json' ? JSON.parse(text) : text;
}
