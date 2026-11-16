// Xuất ảnh xem trước Chó phi hành gia: node tests/dog-preview.mjs  → tests/uat-shots/dog.png
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); await p.setViewport({ width: 900, height: 520 });
await p.goto('http://localhost:5173/defense.html', { waitUntil: 'domcontentloaded' });
await p.evaluate(async () => {
  const m = await import('/src/mascot/dog3d.js');
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0c0f16;display:flex;align-items:center;justify-content:center;gap:24px';
  d.innerHTML = `<img src="${m.snapshot(480)}" width=480><img src="${m.snapshot(96)}" width=96>`;
  document.body.appendChild(d);
});
await new Promise(r => setTimeout(r, 500));
await p.screenshot({ path: fileURLToPath(new URL('./uat-shots/dog.png', import.meta.url)) });
await b.close();
