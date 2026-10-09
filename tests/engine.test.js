import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { geoContains } from 'd3-geo';
import { countries, UNIT_TYPES } from '../src/data/countries.js';
import { createGame, act, tick, total, validSave, isEnemy, power } from '../src/engine.js';
const run = (s,hours) => { for(let n=0;n<hours;n++) s=tick(s,1);return s; };

test('pause freezes time, preparation and movement while accepting commands',()=>{
 let s=createGame();s=act(s,{type:'train',unit:'infantry'}).state;
 const unchanged=tick(s,24);assert.equal(unchanged,s);assert.equal(s.queue[0].progress,0);
 s=act(s,{type:'pause'}).state;s=tick(s,6);assert.equal(s.hours,6);assert.ok(s.queue[0].progress>0);
 s=act(s,{type:'pause'}).state;assert.equal(tick(s,24).hours,6);
});
test('training spends reserves, completes over time and adds a real unit',()=>{
 let s=createGame();const men=s.states['255'].manpower,before=total(s,'255','land');
 s=act(s,{type:'train',unit:'tank'}).state;assert.equal(s.states['255'].manpower,men-UNIT_TYPES.tank.men);
 s.paused=false;s=run(s,241);assert.equal(s.queue.length,0);assert.equal(total(s,'255','land'),before+1);assert.ok(s.units.some(u=>u.id.startsWith('unit-') && u.type==='tank'));
});
test('cancel returns manpower and only 75% of equipment',()=>{
 let s=createGame(),stock=s.states['255'].stock,men=s.states['255'].manpower;
 s=act(s,{type:'train',unit:'infantry'}).state;s=act(s,{type:'cancelTrain',id:s.queue[0].id}).state;
 assert.equal(s.states['255'].manpower,men);assert.equal(s.states['255'].stock,stock-30);assert.equal(s.queue.length,0);
});
test('research finishes and changes industry and combat power',()=>{
 let s=createGame();s=act(s,{type:'research',tech:'industry'}).state;
 assert.ok(act(s,{type:'research',tech:'weapons'}).error);
 s.paused=false;s=run(s,240);assert.equal(s.states['255'].industry,40);assert.ok(s.states['255'].technologies.includes('industry'));
 const before=power(s,s.units.find(u=>u.type==='tank' && u.owner==='255'));
 s=act(s,{type:'research',tech:'weapons'}).state;s=run(s,288);
 assert.ok(power(s,s.units.find(u=>u.type==='tank' && u.owner==='255'))>before);
});
test('peace blocks invasion, diplomacy declares war and ground units capture Austria',()=>{
 let s=createGame();const ids=s.units.filter(u=>u.owner==='255' && UNIT_TYPES[u.type].category==='land').map(u=>u.id);
 assert.ok(act(s,{type:'order',ids,target:'305'}).error);
 s=act(s,{type:'diplomacy',kind:'war',target:'305'}).state;assert.ok(isEnemy(s,'255','305'));
 const order=act(s,{type:'order',ids,target:'305'});assert.ok(!order.error);s=order.state;s.paused=false;s=run(s,240);
 assert.equal(s.territories['305'],'255');assert.ok(s.events.some(e=>e.text.includes('территория занята')));
});
test('air-only missions do damage but cannot conquer territory',()=>{
 let s=createGame();s=act(s,{type:'diplomacy',kind:'war',target:'305'}).state;
 const ids=s.units.filter(u=>u.owner==='255' && UNIT_TYPES[u.type].category==='air').map(u=>u.id);
 s=act(s,{type:'order',ids,target:'305'}).state;s.paused=false;s=run(s,120);
 assert.equal(s.territories['305'],'305');assert.ok(s.events.some(e=>e.text.includes('Для захвата территории')));
});
test('relations, alliance and resource requirements are enforced',()=>{
 let s=createGame();assert.ok(act(s,{type:'diplomacy',kind:'alliance',target:'305'}).error);
 for(let n=0;n<2;n++)s=act(s,{type:'diplomacy',kind:'relations',target:'305'}).state;
 s=act(s,{type:'diplomacy',kind:'alliance',target:'305'}).state;assert.ok(s.allies.includes('305'));
 assert.ok(act(s,{type:'diplomacy',kind:'war',target:'305'}).error);
 s.states['255'].stock=0;assert.ok(act(s,{type:'train',unit:'tank'}).error);
 s=createGame('305');assert.ok(act(s,{type:'train',unit:'ship'}).error);
});
test('enemy issues a counterattack rather than waiting passively',()=>{
 let s=createGame();s=act(s,{type:'diplomacy',kind:'war',target:'290'}).state;s.paused=false;s=run(s,73);
 assert.ok(s.units.some(u=>u.owner==='290' && u.order?.target==='255'));
});
test('saves round trip and corrupt saves are rejected',()=>{
 const s=createGame();assert.ok(validSave(JSON.parse(JSON.stringify(s))));assert.equal(validSave({version:1}),false);
 const corrupt=structuredClone(s);corrupt.units[0].type='unknown';assert.equal(validSave(corrupt),false);
});
test('1936 borders retain Austria, Czechoslovakia, eastern Poland and East Prussia',()=>{
 const map=JSON.parse(readFileSync(new URL('../public/world-1936.json',import.meta.url)));
 assert.equal(map.features.length,170);assert.equal(countries['305'].owner,'305');assert.equal(countries['315'].owner,'315');
 const germany=map.features.find(f=>f.id==='255'),poland=map.features.find(f=>f.id==='290');
 assert.ok(geoContains(germany,[13.4,52.52]));assert.ok(geoContains(germany,[20.5,54.71]));assert.ok(geoContains(poland,[24.03,49.84]));
 assert.ok(countries['255'].neighbors.includes('305'));assert.ok(countries['255'].neighbors.includes('290'));
 assert.equal(countries['620'].owner,'325');assert.equal(countries['750'].owner,'200');
});
