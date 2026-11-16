import { defineConfig } from 'vite';
import { resolve } from 'path';

// Cấu trúc:
//   index.html    — Hệ Mặt Trời & NEO
//   impact.html   — Mô phỏng va chạm (Kẻ hủy diệt)
//   defense.html  — Phòng thủ Trái Đất
//   public/       — dữ liệu & mô hình 3D phục vụ nguyên trạng (data/, models/)
export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  server: { host: true, open: '/index.html' },
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        impact: resolve(__dirname, 'impact.html'),
        defense: resolve(__dirname, 'defense.html'),
      },
    },
  },
  assetsInclude: ['**/*.glb'],
});
