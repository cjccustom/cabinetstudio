import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { execSync } from 'node:child_process';

// Which build this is, shown in the header: the commit and the day it was built
const commit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'dev'; } })();
const built = new Date().toISOString().slice(0, 16).replace('T', ' ');

// `--mode singlefile` inlines everything into one HTML file for the shareable preview.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'singlefile' ? [react(), viteSingleFile()] : [react()],
  define: { __BUILD__: JSON.stringify(`${commit} · ${built} UTC`) },
  build: { outDir: mode === 'singlefile' ? 'dist-preview' : 'dist', chunkSizeWarningLimit: 2000 },
}));
