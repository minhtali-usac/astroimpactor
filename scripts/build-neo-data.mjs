// Chuyển dữ liệu ESA (JSON ~14.6 MB) sang dạng nhị phân gọn (~1.6 MB) để web tải nhanh.
//
//   node scripts/build-neo-data.mjs
//
// Đầu vào : src/data/cur_epoch_kep.json, esa_risk_list_0.json, esa_risk_list_1.json
// Đầu ra  : public/data/neo.bin        Float32Array, 9 số/thiên thể (xem FIELDS)
//           public/data/neo_names.txt  tên/ký hiệu, mỗi dòng một thiên thể (cùng thứ tự)
//           public/data/neo_risk.json  danh sách rủi ro ESA, khóa = chỉ số trong neo.bin
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const outDir = join(dataDir, '..', '..', 'public', 'data');
const read = f => JSON.parse(readFileSync(join(dataDir, f), 'utf8'));

export const FIELDS = ['a', 'e', 'i', 'node', 'peri', 'M', 'epochOffset', 'H', 'G'];
const EPOCH_BASE = 61000; // MJD; epoch lưu dưới dạng độ lệch để giữ độ chính xác float32

const elements = read('cur_epoch_kep.json').data;
const risk = [...read('esa_risk_list_0.json').data, ...read('esa_risk_list_1.json').data];

const buf = new Float32Array(elements.length * FIELDS.length);
const names = [];
const indexByName = new Map();

elements.forEach((el, k) => {
  const o = k * FIELDS.length;
  buf[o + 0] = el.a;
  buf[o + 1] = el.e;
  buf[o + 2] = el.i;
  buf[o + 3] = el['long. node'];
  buf[o + 4] = el['arg. peric.'];
  buf[o + 5] = el['mean anomaly'];
  buf[o + 6] = Number(el['Epoch(MJD)']) - EPOCH_BASE;
  buf[o + 7] = el['absolute magnitude'] ?? NaN;
  buf[o + 8] = el['slope param'] ?? NaN;
  const name = String(el.Name);
  names.push(name);
  indexByName.set(name, k);
});

const riskOut = {};
for (const r of risk) {
  const k = indexByName.get(String(r['Num/des.']));
  if (k === undefined) continue;
  riskOut[k] = {
    name: r.Name || null,
    d: r.m ?? null,                 // đường kính ước tính (m)
    ipMax: r['IP max'] ?? null,     // xác suất va chạm lớn nhất (1 lần tiếp cận)
    psMax: r['PS max'] ?? null,     // thang Palermo lớn nhất
    ipCum: r['IP cum'] ?? r['IP max'] ?? null,
    psCum: r['PS cum'] ?? r['PS max'] ?? null,
    ts: r.TS ?? null,               // thang Torino
    v: r['Vel km/s'] ?? null,       // vận tốc tương đối khi va chạm (km/s)
    date: r['Date/Time'] ?? null,
    years: r.Years ?? null,
  };
}

writeFileSync(join(outDir, 'neo.bin'), Buffer.from(buf.buffer));
writeFileSync(join(outDir, 'neo_names.txt'), names.join('\n'));
writeFileSync(join(outDir, 'neo_risk.json'), JSON.stringify({ epochBase: EPOCH_BASE, fields: FIELDS, risk: riskOut }));
console.log(`OK: ${elements.length} NEO, ${Object.keys(riskOut).length} trong danh sách rủi ro.`);
