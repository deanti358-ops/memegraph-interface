import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // hashconnect/@hashgraph/sdk expect a node-ish environment
  define: {
    global: 'globalThis',
  },
})
