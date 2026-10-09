import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {geoArea,geoContains} from 'd3-geo';
import {createGame,act,tick,validSave,restoreGame,landRoute} from '../src/engine.js';
import {cities,citiesByCountry} from '../src/data/cities.js';
import {countries,UNIT_TYPES} from '../src/data/countries.js';
const run=(s,hours)=>{for(let n=0;n<hours;n++)s=tick(s,1);return s;};
const war=()=>act(createGame(),{type:'diplomacy',kind:'war',target:'305'}).state;
const ground=s=>s.units.filter(u=>u.owner===s.player && UNIT_TYPES[u.type].category==='land').map(u=>u.id);

test('city regions cover every country and retain the historical external borders',()=>{
 const world=JSON.parse(fs.readFileSync(new URL('../public/world-1936.json',import.meta.url)));
 const regions=JSON.parse(fs.readFileSync(new URL('../public/provinces-1936.json',import.meta.url)));
 assert.equal(Object.keys(cities).length,479);assert.equal(regions.features.length,479);
 for(const country of world.features){const group=regions.features.filter(f=>f.properties.country===country.id);assert.ok(group.length>0);assert.ok(Math.abs(group.reduce((sum,f)=>sum+geoArea(f),0)-geoArea(country))<.000006);}
 for(const [id,point] of [['255-konigsberg',[20.5073,54.7104]],['290-lwow',[24.0297,49.8397]],['305-salzburg',[13.055,47.8095]]])assert.ok(geoContains(regions.features.find(f=>f.id===id),point));
 assert.equal(cities['255-konigsberg'].country,'255');assert.equal(cities['290-lwow'].country,'290');
 for(const c of Object.values(cities))for(const n of c.neighbors)assert.ok(cities[n].neighbors.includes(c.id));
});
test('a ground army can travel between two cities of its own country',()=>{
 let s=createGame();const u=s.units.find(u=>u.owner==='255' && u.type==='infantry' && u.city==='255-capital');
 const result=act(s,{type:'order',ids:[u.id],city:'255-hamburg'});assert.ok(!result.error);
 s=result.state;assert.equal(s.units.find(x=>x.id===u.id).order.targetCity,'255-hamburg');
 assert.equal(tick(s,24),s);s.paused=false;s=run(s,100);
 const arrived=s.units.find(x=>x.id===u.id);assert.equal(arrived.city,'255-hamburg');assert.equal(arrived.location,'255');assert.deepEqual(arrived.position,cities['255-hamburg'].position);
});
test('an army cannot skip an enemy front and directly attack inland Vienna',()=>{
 let s=war();const u=s.units.find(u=>u.owner==='255' && u.city==='255-munich' && u.type==='infantry');
 assert.equal(landRoute(s,u,'305-capital'),null);
 assert.ok(act(s,{type:'order',ids:[u.id],city:'305-capital'}).error);
 assert.ok(!act(s,{type:'order',ids:[u.id],city:'305-salzburg'}).error);
 s.cityControl['305-linz']='255';assert.ok(landRoute(s,u,'305-capital'));
});
test('capture affects one city, industrial control and only its local defenders',()=>{
 let s=war();const before=s.states['255'].industry,opponent=s.states['305'].industry;
 const u=s.units.find(u=>u.owner==='255' && u.city==='255-munich' && u.type==='infantry');
 s=act(s,{type:'order',ids:[u.id],city:'305-salzburg'}).state;s.paused=false;s=run(s,48);
 assert.equal(s.cityControl['305-salzburg'],'255');assert.equal(s.cityControl['305-capital'],'305');assert.equal(s.territories['305'],'305');
 assert.equal(s.states['255'].industry,before+1);assert.equal(s.states['305'].industry,opponent-1);
 assert.ok(s.units.filter(u=>u.owner==='305' && u.city==='305-capital').every(u=>u.health===100));
 assert.ok(s.events.some(e=>e.text.includes('Город Зальцбург захвачен')));
});
test('air support and ships cannot occupy a city; fleets need a port',()=>{
 let s=war();const air=s.units.filter(u=>u.owner==='255' && UNIT_TYPES[u.type].category==='air').map(u=>u.id);
 s=act(s,{type:'order',ids:air,city:'305-salzburg'}).state;s.paused=false;s=run(s,110);
 assert.equal(s.cityControl['305-salzburg'],'305');
 const ships=s.units.filter(u=>u.owner==='255' && u.type==='ship').map(u=>u.id);
 assert.ok(act(s,{type:'order',ids:ships,city:'305-capital'}).error);
 s=act(s,{type:'diplomacy',kind:'war',target:'290'}).state;
 assert.ok(!act(s,{type:'order',ids:ships,city:'290-gdynia'}).error);
});
test('capturing the final city occupies the country and ends its resistance',()=>{
 let s=war();for(const c of citiesByCountry['305'])if(!c.capital)s.cityControl[c.id]='255';
 const result=act(s,{type:'order',ids:ground(s),city:'305-capital'});assert.ok(!result.error);
 s=result.state;s.paused=false;for(let n=0;n<300 && s.cityControl['305-capital']!=='255';n++)s=tick(s,1);
 assert.equal(s.cityControl['305-capital'],'255');assert.equal(s.territories['305'],'255');assert.ok(s.defeated.includes('305'));assert.ok(!s.wars.some(w=>w.includes('305')));assert.ok(!s.units.some(u=>u.owner==='305'));
});
test('a counterattack can recapture a city without creating extra factories',()=>{
 let s=war();s=act(s,{type:'order',ids:ground(s),city:'305-salzburg'}).state;s.paused=false;
 for(let n=0;n<80 && s.cityControl['305-salzburg']!=='255';n++)s=tick(s,1);
 assert.equal(s.cityControl['305-salzburg'],'255');
 const industry=s.states['255'].industry+s.states['305'].industry;
 // Isolate recapture from other fronts; the city's regular occupying army remains.
 s.units=s.units.filter(u=>u.owner!=='255' || u.city==='305-salzburg');
 for(const u of s.units)if(u.owner==='305' && UNIT_TYPES[u.type].category==='land'){u.count=100;u.organization=100;}
 s.player='305';s.paused=true;const r=act(s,{type:'order',ids:ground(s),city:'305-salzburg'});assert.ok(!r.error);
 s=r.state;s.paused=false;for(let n=0;n<100 && s.cityControl['305-salzburg']!=='305';n++)s=tick(s,1);
 assert.equal(s.cityControl['305-salzburg'],'305');assert.equal(s.states['255'].industry+s.states['305'].industry,industry);assert.equal(s.territories['305'],'305');
});
test('old campaigns preserve time, resources and conquests when migrating to cities',()=>{
 const old=createGame();old.version=1;delete old.cityControl;delete old.defeated;old.hours=123;old.paused=false;old.territories['305']='255';
 for(const u of old.units)delete u.city;
 old.units[0].order={target:'305',progress:1,duration:24,from:old.units[0].position,mission:false};
 const saved=restoreGame(old);assert.ok(saved);assert.equal(saved.version,2);assert.equal(saved.hours,123);assert.equal(saved.paused,true);assert.equal(saved.states['255'].stock,old.states['255'].stock);
 assert.ok(citiesByCountry['305'].every(c=>saved.cityControl[c.id]==='255'));assert.ok(saved.units.every(u=>cities[u.city] && !u.order));assert.ok(validSave(saved));
 const corrupt=structuredClone(saved);corrupt.cityControl['305-capital']='missing';assert.equal(validSave(corrupt),false);assert.equal(restoreGame(corrupt),null);
});
test('new saves preserve partial occupation and city orders after reload',()=>{
 let s=war();s.cityControl['305-salzburg']='255';s=act(s,{type:'order',ids:ground(s),city:'305-linz'}).state;
 const loaded=restoreGame(JSON.parse(JSON.stringify(s)));assert.ok(loaded);assert.equal(loaded.cityControl['305-salzburg'],'255');assert.equal(loaded.cityControl['305-capital'],'305');assert.ok(loaded.units.some(u=>u.order?.targetCity==='305-linz'));assert.equal(loaded.paused,true);
});

test('disconnected East Prussia needs a fleet rather than a ground teleport through Poland',()=>{
 let s=createGame();const u=s.units.find(u=>u.owner==='255' && u.city==='255-capital' && u.type==='infantry');
 assert.equal(landRoute(s,u,'255-konigsberg'),null);
 const naval=act(s,{type:'order',ids:[u.id],city:'255-konigsberg'});assert.ok(!naval.error);assert.ok(naval.state.units.find(x=>x.id===u.id).order.bySea);
 s.units=s.units.filter(u=>u.owner!=='255' || u.type!=='ship');assert.ok(act(s,{type:'order',ids:[u.id],city:'255-konigsberg'}).error);
});

test('capturing a port lets a landlocked country build ships, and losing it pauses construction',()=>{
 let s=createGame('305');
 assert.ok(act(s,{type:'train',unit:'ship'}).error);
 const port=Object.values(cities).find(c=>c.coastal && c.country==='325');
 assert.ok(port);s.cityControl[port.id]='305';
 const result=act(s,{type:'train',unit:'ship'});assert.ok(!result.error);
 s=result.state;s.paused=false;s=run(s,24);const progress=s.queue[0].progress;assert.ok(progress>0);
 s.cityControl[port.id]='325';s=run(s,24);assert.equal(s.queue[0].progress,progress);
 s.cityControl[port.id]='305';s.queue[0].progress=s.queue[0].duration;s=tick(s,1);
 const ship=s.units.find(u=>u.owner==='305' && u.type==='ship');assert.ok(ship);assert.equal(ship.city,port.id);
});
