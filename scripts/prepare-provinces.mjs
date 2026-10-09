import { readFileSync, writeFileSync } from 'node:fs';
import { Delaunay } from 'd3-delaunay';
import clipping from 'polygon-clipping';
import { geoArea, geoContains } from 'd3-geo';
import { countries, capitalNames, LANDLOCKED } from '../src/data/countries.js';
import { extraCities, capitalOverrides, portCapitals } from '../src/data/city-catalog.js';

const map=JSON.parse(readFileSync(new URL('../public/world-1936.json',import.meta.url)));
const cities={}, provinces=[];
const radius=6371, mercator=([lon,lat])=>[radius*lon*Math.PI/180,radius*Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,lat))*Math.PI/360))];
const inverse=([x,y])=>[+(x/radius*180/Math.PI).toFixed(6),+((2*Math.atan(Math.exp(y/radius))-Math.PI/2)*180/Math.PI).toFixed(6)];
const points=new Map();
const link=(a,b)=>{if(a!==b && !cities[a].neighbors.includes(b)){cities[a].neighbors.push(b);cities[b].neighbors.push(a);}};
for(const country of map.features) {
  const c=countries[country.id], override=capitalOverrides[c.id];
  const entries=[['capital',override?.name || capitalNames[c.id] || c.capital,...(override?.position || c.center),override?.coastal ?? portCapitals.has(c.id)],...(extraCities[c.id] || [])];
  const definitions=entries.map(([slug,name,lon,lat,coastal],i)=>({id:`${c.id}-${slug}`,country:c.id,name,position:[lon,lat],capital:i===0,coastal:!!coastal,victoryPoints:i===0?5:coastal?3:2,industry:i===0?2:1,garrison:i===0?24:12,neighbors:[]}));
  const coords=definitions.map(x=>mercator(x.position));
  const delaunay=Delaunay.from(coords), voronoi=delaunay.voronoi([-21000,-21000,21000,21000]);
  const source=(country.geometry.type==='Polygon'?[country.geometry.coordinates]:country.geometry.coordinates).map(p=>p.map(r=>r.map(mercator)));
  for(const [i,city] of definitions.entries()) {
    const cell=voronoi.cellPolygon(i);
    let result=definitions.length===1 ? source : clipping.intersection(source,[Array.from(cell,p=>[...p])]);
    if(!result.length)throw new Error(`Empty province: ${city.id} ${city.name}`);
    const geometry={type:'MultiPolygon',coordinates:result.map(p=>p.map(r=>r.map(inverse)))};
    const f={type:'Feature',id:city.id,properties:{city:city.id,country:c.id},geometry};
    if(geoArea(f)>Math.PI*2)for(const p of geometry.coordinates)for(const r of p)r.reverse();
    city.landPosition=geoContains(country,city.position);
    cities[city.id]=city;provinces.push(f);
    for(const polygon of geometry.coordinates)for(const ring of polygon)for(const [x,y] of ring) {
      const key=`${x.toFixed(4)},${y.toFixed(4)}`;
      if(!points.has(key))points.set(key,new Set());points.get(key).add(city.id);
    }
  }
  // Do not create ground connections across seas or foreign territory (e.g. East Prussia).
  for(const [i,city] of definitions.entries())for(const n of delaunay.neighbors(i)){
    const other=definitions[n];if(!other)continue;
    const dry=[.2,.4,.6,.8].every(t=>geoContains(country,[city.position[0]+(other.position[0]-city.position[0])*t,city.position[1]+(other.position[1]-city.position[1])*t]));
    if(dry)link(city.id,other.id);
  }
}
// Shared original border vertices connect regions across historical countries.
for(const ids of points.values())for(const a of ids)for(const b of ids) {
  if(cities[a].country!==cities[b].country && countries[cities[a].country].neighbors.includes(cities[b].country))link(a,b);
}
// Short, sparsely sampled borders may have no common vertices after clipping.
for(const c of Object.values(countries))for(const neighbor of c.neighbors) {
  const own=Object.values(cities).filter(x=>x.country===c.id),other=Object.values(cities).filter(x=>x.country===neighbor);
  if(own.some(a=>a.neighbors.some(id=>cities[id].country===neighbor)))continue;
  let pair,min=Infinity;
  for(const a of own)for(const b of other){const aa=mercator(a.position),bb=mercator(b.position),d=Math.hypot(aa[0]-bb[0],aa[1]-bb[1]);if(d<min){min=d;pair=[a.id,b.id];}}
  if(pair)link(...pair);
}
for(const city of Object.values(cities))city.neighbors.sort();
writeFileSync(new URL('../public/provinces-1936.json',import.meta.url),JSON.stringify({type:'FeatureCollection',features:provinces}));
writeFileSync(new URL('../src/data/cities.json',import.meta.url),JSON.stringify(cities,null,2));
console.log(`Prepared ${provinces.length} city regions inside ${map.features.length} historical territories.`);
console.log('Cities close to or outside the simplified shoreline:',Object.values(cities).filter(c=>!c.landPosition).map(c=>c.name).join(', '));
