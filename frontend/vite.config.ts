import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The deployed API's CORS and the documents bucket's CORS rule are both
// currently scoped to exactly http://localhost:3000. strictPort stops Vite
// from silently moving to 3001 when the port is busy, which would otherwise
// turn every API call and every S3 upload into a CORS failure that reads
// like a backend outage.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
  },
  preview: {
    port: 3000,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    sourcemap: true,
    target: 'es2022',
  },
})
