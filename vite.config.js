import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps every asset path relative, so the build works on Vercel, Netlify,
// GitHub Pages (in a sub-folder) or even straight from a USB stick.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600,
    // older phones too: iPhones that stay on iOS 15, and Android browsers from 2022 on
    target: ['es2020', 'safari15', 'chrome100', 'firefox100', 'edge100'],
  },
})
