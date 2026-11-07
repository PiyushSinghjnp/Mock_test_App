const { defineConfig } = require('vite');
const { viteStaticCopy } = require('vite-plugin-static-copy');
const path = require('path');

module.exports = defineConfig({
  root: '.',
  publicDir: 'public',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'admin.html',
      }
    }
  },
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'css', dest: '' },
        { src: 'js/test-engine.js', dest: '' },
        { src: 'js/solution-engine.js', dest: '' },
        { src: 'img', dest: '' },
        { src: 'images', dest: '' },
        { src: 'lib', dest: '' },
        { src: 'data', dest: '' },
        { src: 'scraped', dest: '' },
        { src: 'scraped_specs', dest: '' },
        { src: 'papers', dest: '' },
        { src: 'oliveimg', dest: '' },
      ]
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'js'),
      '@components': path.resolve(__dirname, 'js/components'),
      '@hooks': path.resolve(__dirname, 'js/hooks'),
      '@utils': path.resolve(__dirname, 'js/utils'),
      '@state': path.resolve(__dirname, 'js/state'),
    }
  },
  css: {
    postcss: {}
  }
});
