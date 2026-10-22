import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode singlefile` inlines everything into one HTML file for the shareable preview.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'singlefile' ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === 'singlefile' ? 'dist-preview' : 'dist', chunkSizeWarningLimit: 2000 },
}));
