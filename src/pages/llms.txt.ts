import type { APIRoute } from 'astro'

export const GET: APIRoute = () => {
  const content = `# Seismic Shift - llms.txt
# https://www.seismicshift.nz

## About

Seismic Shift is a New Zealand earthquake protection technology company founded by structural engineers Ben Exton and Geoff Banks following the 2011 Christchurch earthquakes. The company's mission is to deliver affordable seismic resilience to earthquake-prone communities around the world.

## Products

### Quake Defender®
- Type: Seismic damper for commercial and industrial buildings
- Applications: Warehouses, factories, power plants, office buildings, solar retrofits, structural strengthening
- How it works: Connects into a building's bracing system; absorbs energy and recenters the structure after an earthquake
- Target market: Structural engineers, commercial building owners in seismic regions
- URL: https://www.seismicshift.nz/quake-defender/

### FrontFoot®
- Type: Seismic isolation system for residential homes
- Applications: New residential builds at foundation level
- How it works: Installed between foundation and structure; decouples home from ground motion
- Cost premium: Approximately 1.5-2.0% addition to build cost
- URL: https://www.seismicshift.nz/frontfoot/

### FrontFoot® Plinth
- Type: Seismic isolation plinth for critical equipment
- Applications: Data centres, hospitals, IT equipment, emergency systems, industrial facilities
- How it works: Shock-absorbing plinth isolates equipment from ground motion
- URL: https://www.seismicshift.nz/frontfoot-plinth/

## Key Facts

- Founded: Christchurch, New Zealand
- Operating regions: New Zealand, United States, Canada, Japan, Chile
- Patents: FrontFoot™ - NZ Pat. No. 785618; PCT/IB2022/051714; WO2022/185174A1. Quake Defender - AU 2024904237
- Contact: info@seismicshift.nz
- Website: https://www.seismicshift.nz

## Pages

- Homepage: https://www.seismicshift.nz/
- Quake Defender: https://www.seismicshift.nz/quake-defender/
- FrontFoot Residential: https://www.seismicshift.nz/frontfoot/
- FrontFoot Plinth: https://www.seismicshift.nz/frontfoot-plinth/
- About: https://www.seismicshift.nz/about/
- Case Studies: https://www.seismicshift.nz/case-studies/
- FAQ: https://www.seismicshift.nz/faq/
- Contact: https://www.seismicshift.nz/contact/
- Sitemap: https://www.seismicshift.nz/sitemap-index.xml
`
  return new Response(content, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
