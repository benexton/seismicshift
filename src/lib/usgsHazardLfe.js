// Pulls report-ready hazard figures from a USGS event's detail feed: the
// ShakeMap intensity/PGA/PGV maps and the Ground Failure liquefaction and
// landslide probability maps. Not every event has every product, so callers
// should treat every field as possibly null.
export async function fetchUsgsHazardFigures(usgsEventId) {
  if (!usgsEventId) return null;
  const res = await fetch(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/detail/${usgsEventId}.geojson`);
  if (!res.ok) throw new Error(`USGS lookup failed (status ${res.status})`);
  const data = await res.json();
  const products = data.properties?.products ?? {};
  const shakemap = products.shakemap?.[0];
  const groundFailure = products['ground-failure']?.[0];
  const contentUrl = (item, name) => item?.contents?.[name]?.url ?? null;
  return {
    intensityUrl: contentUrl(shakemap, 'download/intensity.jpg'),
    pgaUrl: contentUrl(shakemap, 'download/pga.jpg'),
    pgvUrl: contentUrl(shakemap, 'download/pgv.jpg'),
    liquefactionUrl: contentUrl(groundFailure, 'zhu_2017_general.png'),
    landslideUrl: contentUrl(groundFailure, 'jessee_2018.png'),
  };
}
