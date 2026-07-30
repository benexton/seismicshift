import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  site: 'https://www.seismicshift.nz',
  trailingSlash: 'always',
  integrations: [
    react(),
    // Keep the internal triage tool out of the public sitemap.
    sitemap({
      filter: (page) => !page.includes('/kumamoto-triage-2026/'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})