import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

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
        !page.endsWith('/walk/'), // unlinked - reachable by direct URL only, like public/build-to-thrive
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})