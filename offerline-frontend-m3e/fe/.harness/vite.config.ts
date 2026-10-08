// Throwaway: renders the real app against a seeded cache, with no network.
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const here = import.meta.dirname

/** Swaps the Amplify-backed auth module for a fixed signed-in identity. */
function stubs(): Plugin {
  return {
    name: 'harness-stubs',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || source.includes('.stub')) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (!resolved) return null
      const id = resolved.id.replace(/\\/g, '/')
      if (id.endsWith('/src/auth/authApi.ts')) return path.resolve(here, 'authApi.stub.ts')
      if (id.endsWith('/src/auth/amplify.ts')) return path.resolve(here, 'amplify.stub.ts')
      return null
    },
  }
}

/** Stands in for S3's presigned PUT, a little slowly so progress shows. */
function fakeUpload(): Plugin {
  return {
    name: 'harness-upload',
    configureServer(server) {
      server.middlewares.use('/__harness-put', (req, res) => {
        req.resume()
        req.on('end', () => {
          setTimeout(() => {
            res.statusCode = 200
            res.end()
          }, 600)
        })
      })
    },
  }
}

export default defineConfig({
  root: here,
  publicDir: path.resolve(here, '../public'),
  plugins: [stubs(), fakeUpload(), react()],
  resolve: { alias: { '@': path.resolve(here, '../src') } },
  server: { port: 5199, strictPort: true, fs: { allow: [path.resolve(here, '..')] } },
})
