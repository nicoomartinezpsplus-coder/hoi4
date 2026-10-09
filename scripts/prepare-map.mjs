import { readFileSync, writeFileSync } from 'node:fs';
import { feature, neighbors } from 'topojson-client';
import { geoArea } from 'd3-geo';
// CShapes 2.0, GW coding, all independent states and dependencies on 1 Jan 1936.
const topology = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const geometries = topology.objects.countries.geometries;
const collection = feature(topology, topology.objects.countries);
const adjacent = neighbors(geometries);
const round = value => Array.isArray(value) ? value.map(round) : Math.round(value * 10000) / 10000;
// D3 expects clockwise exterior spherical rings. CShapes uses GIS winding.
for (const [i, f] of collection.features.entries()) {
  if (geoArea(f) > 2 * Math.PI) {
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const polygon of polygons) for (const ring of polygon) ring.reverse();
  }
  f.geometry.coordinates = round(f.geometry.coordinates);
  const p = f.properties;
  f.id = String(p.gwcode);
  f.properties = { id: f.id, name: p.country_name, owner: p.status === 'independent' || p.owner === '0' ? f.id : p.owner, status: p.status, capital: p.capname, center: [p.caplong, p.caplat], neighbors: adjacent[i].map(n => String(geometries[n].properties.gwcode)) };
}
writeFileSync('public/world-1936.json', JSON.stringify(collection));
writeFileSync('src/data/geography.json', JSON.stringify(Object.fromEntries(collection.features.map(f => [f.id, f.properties])), null, 2));
console.log(`Prepared ${collection.features.length} historical territories, ${readFileSync('public/world-1936.json').length} bytes`);
