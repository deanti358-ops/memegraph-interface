import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // hashconnect/@hashgraph/sdk expect a node-ish environment
  define: {
    global: 'globalThis',
  },
})
