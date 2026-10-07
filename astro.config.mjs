import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { existsSync } from 'node:fs'
import path from 'node:path'

// Dev server only. GitHub Pages serves public/<dir>/index.html at /<dir>/,
// but Vite's public-dir middleware only serves exact file paths, so in
// `npm run dev` the static pages under public/ (survive-or-thrive,
// walkadmin, the old /lfe/ redirects) 404 at their real URLs. Rewrite a
// directory URL to its index.html when public/ has one, so dev matches
// production. Registered before Vite's own middlewares, so the public-dir
// middleware then serves the file as normal.
function publicDirIndex() {
  return {
    name: 'public-dir-index',
    apply: 'serve',
    configureServer(server) {
      // Vite normalises publicDir to forward slashes; resolve() puts it back
      // in the platform's form so the containment check below works on
      // Windows too.
      const publicDir = path.resolve(server.config.publicDir)
      server.middlewares.use((req, _res, next) => {
        const url = req.url || ''
        const q = url.indexOf('?')
        const pathname = q === -1 ? url : url.slice(0, q)
        if (pathname.length > 1 && pathname.endsWith('/')) {
          let rel
          try { rel = decodeURIComponent(pathname) } catch { return next() }
          const file = path.join(publicDir, rel, 'index.html')
          if (file.startsWith(publicDir + path.sep) && existsSync(file)) {
            req.url = pathname + 'index.html' + (q === -1 ? '' : url.slice(q))
          }
        }
        next()
      })
    },
  }
}

export default defineConfig({
  site: 'https://www.seismicshift.nz',
  trailingSlash: 'always',
  integrations: [
    react(),
    // Keep the internal/auth-gated tools out of the public sitemap. /erp/public/
    // is the one ERP route meant to be discoverable, so it is deliberately not
    // excluded here.
    sitemap({
      filter: (page) =>
        !page.includes('/erp/triage/') &&
        !page.includes('/erp/admin/') &&
        !page.includes('/erp/public-preview/') &&
        !page.includes('/erp/codes/') &&
        !page.endsWith('/erp/') &&
        !page.endsWith('/walk/'), // unlinked - reachable by direct URL only, like public/survive-or-thrive
    }),
  ],
  vite: {
    plugins: [tailwindcss(), publicDirIndex()],
  },
})
