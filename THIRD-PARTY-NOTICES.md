# Thông báo về thành phần bên thứ ba · Third-party notices

IMPACTOR dùng dữ liệu, thư viện, kết cấu ảnh và mô hình 3D của các nguồn dưới đây. Các thành phần này giữ nguyên giấy phép gốc; thông báo bản quyền trong `LICENSE` không áp dụng cho chúng.

*IMPACTOR uses the data, libraries, textures and 3D models listed below. They keep their original licenses; the copyright notice in `LICENSE` does not apply to them.*

## Dự án gốc · Upstream project

IMPACTOR phát triển tiếp từ **AstroImpactor** (NASA Space Apps Challenge 2025). Mã và tài nguyên kế thừa (kết cấu hành tinh, mô hình 3D vệ tinh và tên lửa, tệp `world_population.csv`) tuân theo giấy phép MIT gốc:

```
MIT License

Copyright (c) 2025 N3rson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Thư viện · Libraries (đóng gói qua npm · bundled via npm)

| Thành phần · Component | Dùng ở đâu · Used for | Giấy phép · License |
|---|---|---|
| [three.js](https://threejs.org/) 0.181 | Toàn bộ cảnh 3D · All 3D views | MIT |
| [globe.gl](https://github.com/vasturiano/globe.gl) 2.46 | Quả địa cầu ở Destroyer và Defender · Globe views | MIT |
| [topojson-client](https://github.com/topojson/topojson-client) 3.1 | Đọc mặt nạ lục địa · Land mask decoding | ISC |
| [world-atlas](https://github.com/topojson/world-atlas) 2.0 (dữ liệu [Natural Earth](https://www.naturalearthdata.com/)) | Phân biệt đất liền / đại dương · Land/ocean detection | ISC; dữ liệu Natural Earth thuộc phạm vi công cộng · public domain |
| [Vite](https://vitejs.dev/) | Công cụ build · Build tool | MIT |
| [Be Vietnam Pro](https://fonts.google.com/specimen/Be+Vietnam+Pro), [Chakra Petch](https://fonts.google.com/specimen/Chakra+Petch), [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) qua Google Fonts | Phông chữ · Typography | SIL Open Font License 1.1 |

## Dữ liệu khoa học · Scientific data

| Dữ liệu · Data | Nguồn · Source |
|---|---|
| Yếu tố quỹ đạo Kepler của 39.529 NEO (`src/data/cur_epoch_kep.json`) và danh sách rủi ro (`esa_risk_list_*.json`) | [ESA NEO Coordination Centre](https://neo.ssa.esa.int/computer-access) — sử dụng kèm ghi nguồn · used with attribution |
| Yếu tố quỹ đạo gần đúng của các hành tinh | E. M. Standish, *Keplerian Elements for Approximate Positions of the Major Planets*, JPL Solar System Dynamics |
| Mô hình hậu quả va chạm | G. S. Collins, H. J. Melosh, R. A. Marcus (2005), *Meteoritics & Planetary Science* 40(6): 817–840 |
| Hệ số khuếch đại động lượng β ≈ 3,6 | A. F. Cheng et al. (2023), *Nature* 616: 457–460 (DART) |
| Dân số đô thị (`public/data/population.csv`, 11.286 điểm) | Kế thừa từ dự án gốc; nguồn gốc chưa được ghi lại · Carried over from the upstream project; original source not recorded |

## Kết cấu ảnh và mô hình 3D · Textures and 3D models

- `src/images/earth_day_4k.jpg`, `earth_night_4k.jpg`: ảnh NASA Blue Marble và Black Marble (phạm vi công cộng · public domain), bản 4096×2048 lấy từ bộ ví dụ của [three-globe](https://github.com/vasturiano/three-globe) (MIT).

Kế thừa từ dự án gốc, theo ghi chú của dự án đó · Carried over from the upstream project, which credits:

- [Solar System Scope – Textures](https://www.solarsystemscope.com/textures/) (CC BY 4.0): bản đồ bề mặt hành tinh, Mặt Trời, vành đai Sao Thổ.
- [Planet Pixel Emporium](https://planetpixelemporium.com/) (miễn phí cho mục đích phi thương mại · free for non-commercial use): bản đồ độ cao (bump) và một số bản đồ bề mặt.
- [NASA 3D Resources](https://nasa3d.arc.nasa.gov/) (không giới hạn bản quyền · no copyright restrictions for NASA-produced media): mô hình Phobos, Deimos, kết cấu các vệ tinh Galileo.
- Mô hình vệ tinh (`public/models/satellite.glb`) và tên lửa (`public/models/rocket.glb`) — kế thừa từ dự án gốc · from the upstream project.
