import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://www.seismicshift.nz',
  trailingSlash: 'always',
  integrations: [
    react(),
    // Keep the internal/auth-gated tools out of the public sitemap. /lfe/public/
    // is the one LFE route meant to be discoverable, so it is deliberately not
    // excluded here (matching kumamoto-2026-public's inclusion).
    sitemap({
      filter: (page) =>
        !page.includes('/kumamoto-triage-2026/') &&
        !page.includes('/lfe/triage/') &&
        !page.includes('/lfe/admin/') &&
        !page.endsWith('/lfe/'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})