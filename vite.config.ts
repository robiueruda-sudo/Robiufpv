import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Robiufpv/',
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
  server: {
    port: 3000,
    open: true,
  },
});
