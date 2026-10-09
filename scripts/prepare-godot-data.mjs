import fs from 'node:fs';
import { geoMercator, geoStream } from 'd3-geo';
import earcut, { flatten } from 'earcut';
import { countries, UNIT_TYPES, TECHS, MAJORS } from '../src/data/countries.js';
import { createGame } from '../src/engine.js';

const output = new URL('../godot/data/', import.meta.url);
fs.mkdirSync(output, { recursive: true });
const projection = geoMercator().scale(160).center([0,20]).translate([500,350]);
const read = file => JSON.parse(fs.readFileSync(new URL(file, import.meta.url)));
const convert = feature => {
  const polygons = [];
  let polygon, ring;
  geoStream(feature, projection.stream({
    polygonStart() { polygon = []; },
    polygonEnd() { if (polygon.length) polygons.push(polygon); },
    lineStart() { ring = []; },
    lineEnd() { if (ring.length >= 3) polygon.push(ring); },
    point(x,y) { ring.push([x,y].map(n => Math.round(n * 10000) / 10000)); },
    sphere() {},
  }));
  const all = polygons.flat(2);
  const meshes = polygons.map(rings => {
    const { vertices, holes, dimensions } = flatten(rings);
    return { points: rings.flat(), indices: earcut(vertices, holes, dimensions) };
  });
  return { id: feature.id, country: feature.properties.country ?? feature.id, polygons, meshes,
    bounds: [Math.min(...all.map(p=>p[0])), Math.min(...all.map(p=>p[1])), Math.max(...all.map(p=>p[0])), Math.max(...all.map(p=>p[1]))] };
};
fs.writeFileSync(new URL('game.json', output), JSON.stringify({ countries, unit_types: UNIT_TYPES, technologies: TECHS, majors: MAJORS, initial: createGame() }));
fs.copyFileSync(new URL('../src/data/cities.json', import.meta.url), new URL('cities.json', output));
fs.writeFileSync(new URL('map.json', output), JSON.stringify({
  regions: read('../public/provinces-1936.json').features.map(convert),
  borders: read('../public/world-1936.json').features.map(convert),
}));
for (const name of ['manrope.ttf', 'barlow-condensed.ttf', 'Manrope-OFL.txt', 'Barlow-OFL.txt']) {
  fs.copyFileSync(new URL(`../public/fonts/${name}`, import.meta.url), new URL(`../godot/fonts/${name}`, import.meta.url));
}
fs.copyFileSync(new URL('../LICENSE', import.meta.url), new URL('../godot/LICENSE', import.meta.url));
console.log(`Godot: ${Object.keys(countries).length} territories, 479 cities, local fonts and initial campaign exported.`);
