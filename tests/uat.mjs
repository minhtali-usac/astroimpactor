// Kiểm thử chấp nhận trên trình duyệt thật (Edge/Chrome headless qua puppeteer-core).
//   1) npm run dev            (hoặc: npx vite preview --port 5173)
//   2) npm run uat            (đặt BROWSER=đường-dẫn-chrome nếu không dùng Edge mặc định)
// Ảnh chụp lưu ở tests/uat-shots/ (không đưa lên git).
import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.UAT_URL || 'http://localhost:5173';
const BROWSER = process.env.BROWSER || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => existsSync(p));
const OUT = new URL('./uat-shots/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? '✔' : '✖'} ${name}${info ? ` — ${info}` : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: BROWSER, headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1440,900'],
});

async function openPage(path, { width = 1440, height = 900, mobile = false, fresh = true } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('requestfailed', r => errors.push(`request failed: ${r.url()} (${r.failure()?.errorText})`));
  if (fresh) await page.evaluateOnNewDocument(() => { try { localStorage.setItem('impactor.about.v1', '1'); localStorage.setItem('impactor.dog.mute', '1'); } catch {} });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.getElementById('loader'), { timeout: 60000 });
  return { page, errors };
}
const shot = (page, name) => page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, OUT)) });
const fps = page => page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(Math.round(n / 2)); })(); }));
const text = (page, sel) => page.$eval(sel, e => e.textContent.trim()).catch(() => null);
const visible = (page, sel) => page.$eval(sel, e => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && !e.classList.contains('hidden') && e.getClientRects().length > 0; }).catch(() => false);

// ============================ 1. QUAN SÁT NEO ============================
{
  const { page, errors } = await openPage('/index.html');
  check('NEO: tải đủ 39.529 vật thể', (await text(page, '#neoCount'))?.includes('39.529 / 39.529'), await text(page, '#neoCount'));
  check('NEO: tốc độ khung hình (swiftshader, CPU)', true, `${await fps(page)} fps`);
  check('NEO: pixel ratio canvas khớp màn hình', await page.evaluate(() => document.querySelector('#scene canvas').width === innerWidth * devicePixelRatio || document.querySelector('#scene canvas').width === Math.round(innerWidth * Math.min(devicePixelRatio, 2))));
  await page.click('#famous .chip:nth-child(2)'); // Bennu
  await sleep(1800);
  check('NEO: chọn Bennu mở bảng chi tiết', (await visible(page, '#detailPanel')) && (await text(page, '#dTitle'))?.includes('Bennu'));
  check('NEO: Bennu có xác suất va chạm ESA', (await text(page, '#dBody'))?.includes('1 / 2.703'));
  await page.keyboard.press('Escape');
  await sleep(300);
  check('NEO: Esc đóng bảng chi tiết', !(await visible(page, '#detailPanel')));
  await page.focus('#search'); await page.keyboard.type('apoph'); await sleep(800);
  check('NEO: tìm kiếm có gợi ý', (await text(page, '#searchResults'))?.includes('Apophis'));
  await page.keyboard.press('Enter'); await sleep(1600);
  check('NEO: Enter chọn Apophis', (await text(page, '#dTitle'))?.includes('Apophis'));
  await page.keyboard.press('Escape');
  await page.click('label.switch:has(#fRisk)'); await sleep(300);
  check('NEO: lọc danh sách rủi ro còn 1.835', (await text(page, '#neoCount'))?.includes('1.835 /'), await text(page, '#neoCount'));
  await page.click('#colorMode button[data-v="risk"]'); await sleep(200);
  await page.click('label.switch:has(#tOrbits)'); await sleep(800);
  check('NEO: bật quỹ đạo các NEO đang lọc', true);
  const r0 = await text(page, '#simRate');
  await page.click('#tFaster'); await sleep(100);
  check('NEO: nút tua nhanh đổi tốc độ', (await text(page, '#simRate')) !== r0, `${r0} → ${await text(page, '#simRate')}`);
  await page.click('#tPlay'); await sleep(100);
  check('NEO: nút dừng', (await text(page, '#simRate')) === 'đang tạm dừng');
  await page.click('#tPlay');
  // hành tinh: về toàn cảnh rồi bấm nhãn Trái Đất
  await page.keyboard.press('Escape'); await page.keyboard.press('h'); await sleep(2500);
  const earthLabel = await page.$$eval('.p-label', els => { const e = els.find(x => x.textContent === 'Trái Đất'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  if (earthLabel) { await page.mouse.click(...earthLabel); await sleep(1700); }
  check('NEO: bấm nhãn hành tinh mở chi tiết', (await text(page, '#dTitle'))?.startsWith('Trái Đất'));
  await shot(page, '01-neo-earth');
  await page.keyboard.press('Escape'); await page.keyboard.press('h'); await sleep(1500);
  // hộp thoại
  await page.click('#helpBtn'); await sleep(250);
  check('NEO: mở Trợ giúp', await page.$eval('#helpModal', e => e.classList.contains('show')));
  await page.keyboard.press('Escape'); await sleep(250);
  await page.click('#aboutBtn'); await sleep(250);
  check('NEO: mở Giới thiệu', await page.$eval('#aboutModal', e => e.classList.contains('show') && e.textContent.includes('Hai vai trò, hai góc nhìn khoa học')));
  await page.click('#aboutModal [data-close]'); await sleep(250);
  // Chó phi hành gia
  check('Chó: có canvas 3D', await page.$eval('#mascot', e => e.classList.contains('m3d') && !!e.querySelector('canvas')));
  await page.click('#mascot'); await sleep(250);
  check('Chó: mở menu', !(await page.$eval('#buddy-menu', e => e.hidden)));
  await shot(page, '02-dog-menu');
  const items = await page.$$('#buddy-menu .bd-item');
  await items[1].click(); await sleep(300); // Điều gì đang xảy ra?
  check('Chó: "Điều gì đang xảy ra?" có lời giải thích', ((await text(page, '.mascot-bubble')) || '').length > 30, (await text(page, '.mascot-bubble'))?.slice(0, 70));
  await page.click('#mascot'); await sleep(200);
  await (await page.$$('#buddy-menu .bd-item'))[2].click(); await sleep(300);
  check('Chó: kiểm tra nhanh có 3 câu', (await page.$$('#dogQuiz .quiz-q')).length === 3);
  for (const q of await page.$$('#dogQuiz .quiz-q')) await (await q.$('.quiz-opt')).click();
  check('Chó: chấm điểm kiểm tra', /Kết quả: \d\/3/.test(await text(page, '#dogQuiz .quiz-score')), await text(page, '#dogQuiz .quiz-score'));
  check('Chó: nổi trên hộp thoại', await page.$eval('#mascot', e => e.classList.contains('in-dialog')));
  await shot(page, '03-dog-quiz');
  await page.click('#dogQuiz [data-close]'); await sleep(200);
  await page.click('#mascot'); await sleep(200);
  await (await page.$$('#buddy-menu .bd-item'))[3].click(); await sleep(300);
  check('Chó: mở bài khái niệm', await page.$eval('#dogConcept', e => e.classList.contains('show')));
  await page.click('#dogConcept [data-close]');
  await page.evaluate(() => document.getElementById('mascot').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
  await sleep(400);
  check('Chó: nhấp đúp phóng to', await page.$eval('#mascot', e => e.classList.contains('big')));
  check('NEO: không có lỗi', errors.length === 0, errors.slice(0, 5).join(' | '));
  await page.close();
}

// ============================ 2. DESTROYER ============================
{
  const { page, errors } = await openPage('/impact.html');
  check('Destroyer: tính kết quả ngay khi mở', (await text(page, '#results'))?.includes('Năng lượng giải phóng'));
  check('Destroyer: tốc độ khung hình', true, `${await fps(page)} fps`);
  await page.click('#events .chip[data-id="chicxulub"]');
  await page.waitForFunction(() => document.querySelector('#results')?.textContent.includes('Vùng ảnh hưởng') && !document.querySelector('#results .note'), { timeout: 20000 }).catch(() => {});
  await sleep(1500);
  const res = await text(page, '#results');
  check('Destroyer: Chicxulub tạo hố phức tạp', res?.includes('Hố va chạm (phức tạp)'));
  check('Destroyer: liệt kê thành phố trong vùng', res?.includes('Cancún'));
  await shot(page, '04-destroyer-chicxulub');
  const zones = await page.$$('#results .zone');
  await zones[0].click(); await sleep(200);
  check('Destroyer: bấm vùng để ẩn', await page.$eval('#results .zone', e => e.classList.contains('off')));
  // nhấp lên quả địa cầu để chọn vị trí
  const lat0 = await page.$eval('#iLat', e => e.value);
  await page.mouse.click(720, 450); await sleep(500);
  check('Destroyer: nhấp quả địa cầu đổi toạ độ', (await page.$eval('#iLat', e => e.value)) !== lat0, `${lat0} → ${await page.$eval('#iLat', e => e.value)}`);
  // đổi thông số
  await page.$eval('#iVel', e => { e.value = 40; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(200);
  check('Destroyer: kéo vận tốc cập nhật nhãn', (await text(page, '#iVelOut')) === '40 km/s');
  await page.$eval('#iDiameter', e => { e.value = 20; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.$eval('#iUnit', e => { e.value = 'm'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(200);
  check('Destroyer: kết quả cập nhật khi đổi thông số', (await text(page, '#results'))?.length > 100);
  await page.click('#launch');
  await page.waitForFunction(() => !document.getElementById('launch').disabled, { timeout: 30000 }).catch(() => {});
  check('Destroyer: thả thiên thạch hoàn tất', await page.$eval('#launch', e => !e.disabled));
  await page.click('#reset'); await sleep(300);
  check('Destroyer: xoá kết quả', (await text(page, '#results'))?.includes('dự kiến'));
  check('Destroyer: không có lỗi', errors.length === 0, errors.slice(0, 5).join(' | '));
  await page.close();
}

// ============================ 3. DEFENDER ============================
{
  const { page, errors } = await openPage('/defense.html?dur=6');
  check('Defender: phân tích trước nhiệm vụ', (await text(page, '#briefing'))?.includes('Khả năng tối đa'));
  await page.click('#difficulty button[data-v="easy"]'); await sleep(200);
  check('Defender: đổi độ khó', (await text(page, '#sTOut'))?.includes('năm'), await text(page, '#sTOut'));
  await page.click('#start'); await sleep(500);
  check('Defender: vào chế độ chơi', await visible(page, '#hud'));
  for (let i = 0; i < 5; i++) { await page.keyboard.press('r'); await sleep(150); }
  await page.keyboard.down('Space'); await sleep(1200); await page.keyboard.up('Space');
  await page.waitForFunction(() => document.getElementById('endModal').classList.contains('show'), { timeout: 30000 }).catch(() => {});
  const end = await text(page, '#endCard');
  check('Defender: kết thúc có hộp kết quả', !!end && end.length > 20, end?.slice(0, 40));
  await shot(page, '05-defender-end');
  await page.click('#mAgain').catch(() => {}); await sleep(600);
  check('Defender: chơi lại', await visible(page, '#hud'));
  await page.click('#abort'); await sleep(300);
  check('Defender: huỷ về thiết lập', await visible(page, '#setup'));
  check('Defender: không có lỗi', errors.length === 0, errors.slice(0, 5).join(' | '));
  await page.close();
}

// ============================ 4. ĐIỆN THOẠI ============================
for (const p of ['/index.html', '/impact.html', '/defense.html']) {
  const { page, errors } = await openPage(p, { width: 390, height: 844, mobile: true });
  await sleep(800);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check(`Điện thoại ${p}: không tràn ngang`, !overflow);
  await shot(page, `06-mobile${p.replace(/[/.]/g, '-')}`);
  check(`Điện thoại ${p}: không có lỗi`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

await browser.close();
const fail = results.filter(r => !r.ok);
console.log(`\n${results.length - fail.length}/${results.length} đạt`);
process.exit(fail.length ? 1 : 0);
