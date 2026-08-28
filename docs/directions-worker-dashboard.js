// Cloudflare Worker: proxies OpenRouteService directions so the ORS API key
// never reaches the client. This is a plain-JS build of workers/directions.ts
// in this repo, for pasting into the Cloudflare dashboard's Worker "Edit
// code" editor (the dashboard runs plain JS only, no TypeScript build step).
//
// Set these on the Worker under Settings > Variables and Secrets:
//   ORS_API_KEY    (Secret)         - your OpenRouteService key
//   ALLOWED_ORIGIN (Text/Plaintext) - comma-separated allowed origins, e.g.
//                    https://www.seismicshift.nz,http://localhost:4321

const ORS_DIRECTIONS_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson'

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? ''
    const allowedOrigins = (env.ALLOWED_ORIGIN ?? '').split(',').map((o) => o.trim()).filter(Boolean)
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return new Response('Invalid JSON body', { status: 400, headers: corsHeaders })
    }

    const coordinates = body.coordinates
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return new Response('coordinates must be an array of at least 2 [lng, lat] pairs', {
        status: 400,
        headers: corsHeaders,
      })
    }

    const orsResponse = await fetch(ORS_DIRECTIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: env.ORS_API_KEY,
        'Content-Type': 'application/json',
      },
      // instructions=false: the client only draws the polyline and uses its
      // own per-leg "Open in Maps" deep links for turn-by-turn.
      body: JSON.stringify({ coordinates, instructions: false }),
    })

    if (!orsResponse.ok) {
      return new Response('Upstream routing error', { status: 502, headers: corsHeaders })
    }

    const geojson = await orsResponse.text()
    return new Response(geojson, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  },
}
