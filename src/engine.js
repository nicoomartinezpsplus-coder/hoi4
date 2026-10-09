import { countries, UNIT_TYPES, TECHS } from './data/countries.js';
import { cities, citiesByCountry, capitalCity, nearestCity } from './data/cities.js';
export const START_DATE = Date.UTC(1936, 0, 1, 12);
export const SAVE_KEY = 'ironfront-campaign-v1';
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export const isEnemy = (s,a,b) => s.wars.some(w => (w[0]===a && w[1]===b) || (w[0]===b && w[1]===a));
export const sovereign = (s,id) => s.territories[id] || countries[id]?.owner || id;
export const distance = (a,b) => {
  const rad = Math.PI/180, dlat=(b[1]-a[1])*rad, dlon=(b[0]-a[0])*rad;
  return 12742*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlon/2)**2));
};
export function createGame(player='255') {
  const states={}, units=[];
  for (const c of Object.values(countries)) {
    if (c.status !== 'independent' && c.owner !== c.id) continue;
    states[c.id]={manpower:c.manpower, industry:c.industry, fuel:c.fuel, political:150, stock:900, stability:c.stability, technologies:[], relation:0};
    for (const [type,t] of Object.entries(UNIT_TYPES)) {
      const count = c[type];
      if (!count) continue;
      const groups=t.category==='land' ? Math.min(3,Math.ceil(count/8)) : 1;
      let remaining=count;
      for (let n=0;n<groups;n++) {
        const amount=Math.ceil(remaining/(groups-n)); remaining-=amount;
        const oldPosition=c.cities[(n+Object.keys(UNIT_TYPES).indexOf(type))%c.cities.length];
        const city=t.category==='naval' ? (citiesByCountry[c.id].find(x=>x.coastal) || capitalCity(c.id)) : nearestCity(c.id,oldPosition);
        const position=city.position;
        units.push({id:`${c.id}-${type}-${n}`,owner:c.id,type,count:amount,health:100,organization:100,location:c.id,city:city.id,position:[...position],order:null});
      }
    }
  }
  return {version:2,cityControl:Object.fromEntries(Object.values(cities).map(c=>[c.id,countries[c.country].owner])),defeated:[],player,hours:0,paused:true,speed:1,states,units,territories:Object.fromEntries(Object.values(countries).map(c=>[c.id,c.owner])),wars:[],allies:[],queue:[],research:[],battles:[],events:[{id:'welcome',hours:0,type:'info',text:'1 января 1936 года. Мир на пороге перемен.'},{id:'ready',hours:0,type:'success',text:`${countries[player].name}: командование ждёт ваших приказов.`}],nextId:1};
}
function log(s,text,type='info') {s.events.unshift({id:`event-${s.nextId++}`,hours:s.hours,text,type});s.events=s.events.slice(0,60);}
export function total(s,owner,category) {return s.units.filter(u=>u.owner===owner && (!category || UNIT_TYPES[u.type].category===category)).reduce((n,u)=>n+u.count,0);}
export function power(s,u) {
  const st=s.states[u.owner], category=UNIT_TYPES[u.type].category;
  const tech=category==='land' ? (st.technologies.includes('weapons')?1.2:1) : (st.technologies.includes('aviation')?1.3:1);
  const fuel=UNIT_TYPES[u.type].fuel && st.fuel<=0 ? .45 : 1;
  return u.count*UNIT_TYPES[u.type].power*u.health/100*Math.max(.3,u.organization/100)*tech*fuel;
}
export function act(state,action) {
  const s=structuredClone(state), p=s.states[s.player];
  if(action.type==='pause' && s.defeated.includes(s.player))return {state,error:'Ваше государство капитулировало. Начните новую кампанию в меню.'};
  if(action.type==='pause') {s.paused=!s.paused;return {state:s};}
  if(action.type==='speed') {s.speed=clamp(action.speed,1,5);return {state:s};}
  if(action.type==='train') {
    const t=UNIT_TYPES[action.unit];
    if(!t) return {state,error:'Неизвестный тип подразделения.'};
    if(t.category==='naval' && !Object.values(cities).some(c=>c.coastal && cityOwner(s,c.id)===s.player)) return {state,error:'Для строительства кораблей нужен подконтрольный портовый город.'};
    if(p.stock<t.cost || p.manpower<t.men) return {state,error:'Недостаточно снаряжения или людских резервов.'};
    if(s.queue.filter(q=>q.owner===s.player).length>=6) return {state,error:'Очередь заполнена: одновременно можно готовить 6 подразделений.'};
    p.stock-=t.cost;p.manpower-=t.men;
    s.queue.push({id:`queue-${s.nextId++}`,owner:s.player,type:action.unit,progress:0,duration:t.days*24});
    log(s,`Начата подготовка: ${t.name.toLowerCase()}.`, 'production');return {state:s,message:'Подразделение добавлено в очередь подготовки.'};
  }
  if(action.type==='cancelTrain') {
    const q=s.queue.find(q=>q.id===action.id && q.owner===s.player);
    if(!q) return {state};
    p.stock+=UNIT_TYPES[q.type].cost*.75;p.manpower+=UNIT_TYPES[q.type].men;
    s.queue=s.queue.filter(x=>x.id!==q.id);return {state:s,message:'Подготовка отменена. Возвращено 75% снаряжения.'};
  }
  if(action.type==='research') {
    const t=TECHS[action.tech];if(!t) return {state};
    if(p.technologies.includes(action.tech) || s.research.some(r=>r.owner===s.player && r.tech===action.tech)) return {state,error:'Эта технология уже изучена или исследуется.'};
    if(s.research.some(r=>r.owner===s.player)) return {state,error:'Дождитесь окончания текущего исследования.'};
    if(p.stock<t.cost) return {state,error:'Недостаточно снаряжения для исследования.'};
    p.stock-=t.cost;s.research.push({owner:s.player,tech:action.tech,progress:0,duration:t.days*24});
    log(s,`Начато исследование: ${t.name}.`,'production');return {state:s,message:'Исследование начато.'};
  }
  if(action.type==='diplomacy') {
    const target=sovereign(s,action.target);
    if(target===s.player || !s.states[target]) return {state,error:'Выберите независимое иностранное государство.'};
    const other=s.states[target];
    if(action.kind==='war') {
      if(isEnemy(s,s.player,target)) return {state,error:'Вы уже находитесь в состоянии войны.'};
      if(s.allies.includes(target)) return {state,error:'Нельзя объявить войну союзнику.'};
      if(p.political<50) return {state,error:'Нужно 50 политического влияния.'};
      p.political-=50;s.wars.push([s.player,target]);p.stability=Math.max(20,p.stability-3);
      log(s,`${countries[s.player].name} объявляет войну: ${countries[target].name}.`,'war');return {state:s,message:'Война объявлена. Выберите войска и цель на карте.'};
    }
    if(isEnemy(s,s.player,target)) return {state,error:'Дипломатия недоступна во время войны.'};
    if(action.kind==='relations') {
      if(p.political<20) return {state,error:'Нужно 20 политического влияния.'};
      p.political-=20;other.relation=Math.min(100,other.relation+30);log(s,`Отношения с ${countries[target].name} улучшены.`);return {state:s,message:'Отношения улучшены на 30.'};
    }
    if(action.kind==='alliance') {
      if(s.allies.includes(target)) return {state,error:'Это государство уже является союзником.'};
      if(other.relation<60) return {state,error:'Для союза нужны отношения не ниже +60.'};
      s.allies.push(target);log(s,`Заключён союз: ${countries[target].name}.`,'success');return {state:s,message:'Союз заключён. Теперь доступно перемещение войск по территории союзника.'};
    }
  }
  if(action.type==='order') {
    const selected=s.units.filter(u=>action.ids?.includes(u.id) && u.owner===s.player);
    if(!selected.length)return {state,error:'Сначала выберите подразделения.'};
    let target=cities[action.city];
    if(!target && countries[action.target]) {
      const candidates=citiesByCountry[action.target];
      target=candidates.find(c=>cityOwner(s,c.id)!==s.player && selected.some(u=>landRoute(s,u,c.id))) || capitalCity(action.target);
    }
    if(!target)return {state,error:'Выберите город назначения.'};
    const owner=cityOwner(s,target.id),hostile=isEnemy(s,s.player,owner);
    if(owner!==s.player && !hostile && !s.allies.includes(owner))return {state,error:'Сначала объявите войну или заключите союз в дипломатии.'};
    let ordered=0,problem='';
    for(const u of selected) {
      const cat=UNIT_TYPES[u.type].category;
      if(engaged(s,u)){problem='Подразделение уже участвует в сражении.';continue;}
      if(u.city===target.id && !hostile){problem='Подразделение уже находится в этом городе.';continue;}
      let route=[u.city,target.id],bySea=false;
      if(cat==='land') {
        route=landRoute(s,u,target.id);
        if(!route && target.coastal && total(s,s.player,'naval')>0) {
          const ports=Object.values(cities).filter(c=>c.coastal && cityOwner(s,c.id)===s.player && distance(c.position,target.position)<6500);
          for(const port of ports.sort((a,b)=>distance(u.position,a.position)-distance(u.position,b.position))){
            const toPort=landRoute(s,u,port.id);if(toPort){route=[...toPort,target.id];bySea=true;break;}
          }
        }
        if(!route){problem='Нет доступного фронта. Сначала захватите соседние области или выберите порт для морского вторжения.';continue;}
      }
      if(cat==='air' && distance(u.position,target.position)>2500){problem='Цель за пределами радиуса авиации (2 500 км).';continue;}
      if(cat==='naval' && !target.coastal){problem='Флот может действовать только в портовых городах.';continue;}
      const waypoints=[u.position,...route.slice(1).map(id=>cities[id].position)];
      const length=waypoints.slice(1).reduce((sum,p,i)=>sum+distance(waypoints[i],p),0);
      u.order={target:target.country,targetCity:target.id,route,bySea,progress:0,duration:cat==='air'?8:cat==='naval'?30:Math.max(6,length/18),from:[...u.position],mission:cat!=='land'};
      ordered++;
    }
    if(!ordered)return {state,error:problem || 'Приказ недоступен.'};
    log(s,`${hostile?'Наступление':'Переброска'}: ${target.name}. Подразделений: ${ordered}.`,hostile?'war':'info');
    return {state:s,targetCity:target.id,message:`Приказ передан ${ordered} подразделениям. Цель: ${target.name}.${problem?' '+problem:''}`};
  }
  if(action.type==='halt') {
    for(const u of s.units.filter(u=>action.ids.includes(u.id) && u.owner===s.player)) {
      if(engaged(s,u)) continue;
      if(u.order) {u.position=[...u.order.from];u.order=null;}
    }
    return {state:s,message:'Приказы на перемещение отменены.'};
  }
  return {state};
}
export const cityOwner=(s,id)=>s.cityControl[id];
export const cityName=id=>cities[id]?.name || 'город';
const engaged=(s,u)=>s.battles.some(b=>b.units.includes(u.id) || (b.targetCity===u.city && b.defender===u.owner));
export function landRoute(s,u,targetId) {
  if(!cities[u.city] || !cities[targetId])return null;
  if(u.city===targetId)return [u.city];
  const costs=new Map([[u.city,0]]),previous=new Map(),open=new Set([u.city]);
  while(open.size){
    let current;for(const id of open)if(current===undefined || costs.get(id)<costs.get(current))current=id;
    open.delete(current);if(current===targetId){const route=[current];while(previous.has(route[0]))route.unshift(previous.get(route[0]));return route;}
    for(const neighbor of cities[current].neighbors){
      const owner=cityOwner(s,neighbor);
      const friendly=owner===u.owner || (u.owner===s.player && s.allies.includes(owner));
      if(neighbor!==targetId && !friendly)continue;
      const cost=costs.get(current)+distance(cities[current].position,cities[neighbor].position);
      if(cost<(costs.get(neighbor) ?? Infinity)){costs.set(neighbor,cost);previous.set(neighbor,current);open.add(neighbor);}
    }
  }
  return null;
}
function stationed(s,u,id) {u.city=id;u.location=cities[id].country;u.position=[...cities[id].position];u.order=null;}
function retreat(s,u,exclude) {
  const home=Object.values(cities).filter(c=>c.id!==exclude && cityOwner(s,c.id)===u.owner).sort((a,b)=>distance(u.position,a.position)-distance(u.position,b.position))[0];
  if(home){stationed(s,u,home.id);u.organization=Math.max(20,u.organization);u.health=Math.max(10,u.health);}else u.health=0;
}
function resolveArrival(s,u) {
  const dest=u.order.targetCity,owner=cityOwner(s,dest),hostile=isEnemy(s,u.owner,owner);
  u.order=null;
  if(!hostile){stationed(s,u,dest);return;}
  let battle=s.battles.find(b=>b.targetCity===dest && b.attacker===u.owner);
  if(!battle){battle={id:`battle-${s.nextId++}`,target:cities[dest].country,targetCity:dest,attacker:u.owner,defender:owner,units:[],progress:0,elapsed:0};s.battles.push(battle);log(s,`Сражение за город ${cityName(dest)} началось.`,'war');}
  if(!battle.units.includes(u.id))battle.units.push(u.id);
}
function capture(s,b) {
  const city=cities[b.targetCity],previous=cityOwner(s,city.id);
  if(previous===b.attacker)return;
  s.cityControl[city.id]=b.attacker;
  // Industrial sites transfer with control, including on a counterattack.
  const factories=Math.min(city.industry,s.states[previous].industry);
  s.states[previous].industry-=factories;s.states[b.attacker].industry+=factories;
  const region=citiesByCountry[city.country],controller=s.cityControl[region[0].id];
  s.territories[city.country]=region.every(c=>cityOwner(s,c.id)===controller)?controller:countries[city.country].owner;
  log(s,`Город ${city.name} захвачен. Контроль области: ${countries[b.attacker].name}.`,'success');
  if(region.every(c=>cityOwner(s,c.id)===b.attacker))log(s,`${countries[city.country].name}: все городские области под контролем ${countries[b.attacker].name}.`,'success');
}
function moveAlongRoute(s,u,elapsed){
  const order=u.order;
  if(UNIT_TYPES[u.type].category==='land') {
    const blocked=order.route.slice(1,-1).some(id=>cityOwner(s,id)!==u.owner && !(u.owner===s.player && s.allies.includes(cityOwner(s,id))));
    if(blocked){stationed(s,u,u.city);log(s,`Маршрут к ${cityName(order.targetCity)} перекрыт. Приказ остановлен.`,'war');return;}
  }
  order.progress+=elapsed;
  const t=Math.min(1,order.progress/order.duration),waypoints=[order.from,...order.route.slice(1).map(id=>cities[id].position)];
  if(waypoints.length===1)waypoints.push(cities[order.targetCity].position);
  const lengths=waypoints.slice(1).map((p,i)=>distance(waypoints[i],p)),total=lengths.reduce((a,b)=>a+b,0);
  let remaining=t*total,index=0;
  while(index<lengths.length-1 && remaining>lengths[index]){remaining-=lengths[index];index++;}
  const fraction=lengths[index]>0?Math.min(1,remaining/lengths[index]):1,a=waypoints[index],b=waypoints[index+1];
  u.position=[a[0]+(b[0]-a[0])*fraction,a[1]+(b[1]-a[1])*fraction];
  if(t>=1)resolveArrival(s,u);
}
export function tick(state,elapsedHours) {
  if(state.paused || elapsedHours<=0) return state;
  const s=structuredClone(state), hours=Math.min(elapsedHours,24);s.hours+=hours;
  for(const [id,st] of Object.entries(s.states)) {
    st.stock+=st.industry*.55*hours/24;st.manpower+=st.industry*20*hours/24;st.political+=2.5*hours/24;
    const active=s.units.filter(u=>u.owner===id && (u.order || s.battles.some(b=>b.units.includes(u.id))));
    const usage=active.reduce((n,u)=>n+UNIT_TYPES[u.type].fuel*u.count,0);
    st.fuel=clamp(st.fuel+(st.industry*2-usage*8)*hours/24,0,30000);
  }
  for(const u of s.units) {
    if(u.order) {
      moveAlongRoute(s,u,hours);
    } else if(!engaged(s,u)) {
      u.organization=clamp(u.organization+hours*.3,0,100);u.health=clamp(u.health+hours*.04,0,100);
    }
  }
  for(const q of s.queue) {
    const available=Object.values(cities).filter(c=>cityOwner(s,c.id)===q.owner && (q.type!=='ship' || c.coastal));
    if(!available.length)continue;
    q.progress+=hours*Math.min(1.8,.6+s.states[q.owner].industry/80);
    if(q.progress>=q.duration) {
      const city=available.find(c=>c.capital && c.country===q.owner) || available[0];
      if(city)s.units.push({id:`unit-${s.nextId++}`,owner:q.owner,type:q.type,count:1,health:100,organization:100,location:city.country,city:city.id,position:[...city.position],order:null});
      log(s,`${UNIT_TYPES[q.type].name}: новое подразделение готово.`, 'success');
    }
  }
  s.queue=s.queue.filter(q=>q.progress<q.duration);
  for(const r of s.research) {
    r.progress+=hours;
    if(r.progress>=r.duration) {
      s.states[r.owner].technologies.push(r.tech);
      if(r.tech==='industry') s.states[r.owner].industry+=8;
      log(s,`Исследование завершено: ${TECHS[r.tech].name}.`,'success');
    }
  }
  s.research=s.research.filter(r=>r.progress<r.duration);
  const completed=[];
  for(const b of s.battles) {
    const attackers=s.units.filter(u=>b.units.includes(u.id));
    const defenders=s.units.filter(u=>u.owner===b.defender && u.city===b.targetCity && !u.order);
    const attack=attackers.reduce((n,u)=>n+power(s,u),0);
    const defense=defenders.reduce((n,u)=>n+power(s,u),0)+cities[b.targetCity].garrison;
    const hasGround=attackers.some(u=>UNIT_TYPES[u.type].category==='land');
    b.elapsed+=hours;b.progress=clamp(b.progress+hours*(attack/Math.max(20,defense)-.4)*1.2,-100,100);
    for(const u of attackers) {u.organization=clamp(u.organization-hours*.5,0,100);u.health=clamp(u.health-hours*defense/Math.max(20,attack)*.14,0,100);}
    for(const u of defenders) {u.organization=clamp(u.organization-hours*.45,0,100);u.health=clamp(u.health-hours*attack/Math.max(20,defense)*.14,0,100);}
    if(b.progress>=100 && hasGround) {
      capture(s,b);
      for(const u of attackers){if(UNIT_TYPES[u.type].category==='land')stationed(s,u,b.targetCity);else stationed(s,u,u.city);u.organization=Math.max(30,u.organization);}
      for(const u of defenders)retreat(s,u,b.targetCity);
      completed.push(b.id);
    } else if(b.progress<=-100 || !attackers.length || attackers.every(u=>u.health<15 || u.organization<10) || (b.elapsed>=96 && !hasGround)) {
      for(const u of attackers){if(cityOwner(s,u.city)!==u.owner)retreat(s,u,b.targetCity);else stationed(s,u,u.city);u.organization=30;}
      log(s,hasGround?`Наступление на ${cityName(b.targetCity)} остановлено. Войска отступают.`:`Миссия в ${cityName(b.targetCity)} завершена. Для захвата территории нужна пехота или танки.`,hasGround?'war':'info');
      completed.push(b.id);
    }
  }
  s.battles=s.battles.filter(b=>!completed.includes(b.id));
  s.units=s.units.filter(u=>u.health>0);
  for(const id of Object.keys(s.states)) {
    if(s.defeated.includes(id) || Object.values(s.cityControl).includes(id))continue;
    s.defeated.push(id);s.units=s.units.filter(u=>u.owner!==id);s.queue=s.queue.filter(q=>q.owner!==id);s.research=s.research.filter(r=>r.owner!==id);s.wars=s.wars.filter(w=>!w.includes(id));
    log(s,`${countries[id].name} капитулирует: все города потеряны.`,'war');if(id===s.player)s.paused=true;
  }
  if(Math.floor(s.hours/72)>Math.floor(state.hours/72)) {
    for(const war of s.wars) {
      const enemy=war.find(id=>id!==s.player);if(!enemy || s.defeated.includes(enemy))continue;
      const fronts=Object.values(cities).filter(c=>cityOwner(s,c.id)===s.player && c.neighbors.some(n=>cityOwner(s,n)===enemy)).sort((a,b)=>(countries[b.country].owner===enemy)-(countries[a.country].owner===enemy));
      const squad=s.units.filter(u=>u.owner===enemy && !u.order && !engaged(s,u) && UNIT_TYPES[u.type].category==='land' && u.organization>60).slice(0,2);
      let ordered=0;
      for(const u of squad){for(const target of fronts){const route=landRoute(s,u,target.id);if(route){u.order={target:target.country,targetCity:target.id,route,bySea:false,progress:0,duration:Math.max(12,route.slice(1).reduce((n,id,i)=>n+distance(cities[route[i]].position,cities[id].position),0)/18),from:[...u.position],mission:false};ordered++;break;}}}
      if(ordered)log(s,`${countries[enemy].name}: обнаружено наступление на городские области.`,'war');
    }
  }
  return s;
}
function validLegacy(s) {
  if(!s || s.version!==1 || !countries[s.player] || !s.states?.[s.player] || !Number.isFinite(s.hours) || s.hours<0 || ![1,2,3,4,5].includes(s.speed)) return false;
  if(!['units','queue','research','battles','wars','allies','events'].every(k=>Array.isArray(s[k])) || !s.territories || !Number.isInteger(s.nextId)) return false;
  const nums=['manpower','industry','fuel','political','stock','stability'];
  if(!Object.entries(s.states).every(([id,v])=>countries[id] && nums.every(k=>Number.isFinite(v[k])) && Array.isArray(v.technologies))) return false;
  if(!s.units.every(u=>s.states[u.owner] && UNIT_TYPES[u.type] && countries[u.location] && Number.isFinite(u.count) && Number.isFinite(u.health) && Number.isFinite(u.organization) && Array.isArray(u.position) && u.position.length===2 && u.position.every(Number.isFinite) && (!u.order || countries[u.order.target] && Number.isFinite(u.order.progress) && u.order.duration>0 && Array.isArray(u.order.from)))) return false;
  if(!s.queue.every(q=>s.states[q.owner] && UNIT_TYPES[q.type] && Number.isFinite(q.progress) && q.duration>0)) return false;
  if(!s.research.every(r=>s.states[r.owner] && TECHS[r.tech] && Number.isFinite(r.progress) && r.duration>0)) return false;
  if(!s.battles.every(b=>countries[b.target] && s.states[b.attacker] && s.states[b.defender] && Array.isArray(b.units) && Number.isFinite(b.progress) && Number.isFinite(b.elapsed))) return false;
  return Object.entries(s.territories).every(([id,owner])=>countries[id] && countries[owner]);
}

export function validSave(s) {
  if(!s || s.version!==2 || !validLegacy({...s,version:1}) || !s.cityControl || !Array.isArray(s.defeated))return false;
  if(!Object.keys(cities).every(id=>s.states[s.cityControl[id]]) || Object.keys(s.cityControl).some(id=>!cities[id]))return false;
  if(!s.units.every(u=>cities[u.city]?.country===u.location && (!u.order || cities[u.order.targetCity] && Array.isArray(u.order.route) && u.order.route.length>0 && u.order.route.every(id=>cities[id]) && u.order.route.at(-1)===u.order.targetCity)))return false;
  return s.battles.every(b=>cities[b.targetCity]?.country===b.target);
}
export function restoreGame(raw) {
  if(validSave(raw))return {...raw,paused:true};
  if(!validLegacy(raw))return null;
  const s=structuredClone(raw);s.version=2;s.paused=true;s.defeated=[];
  s.cityControl=Object.fromEntries(Object.values(cities).map(c=>[c.id,s.territories[c.country]]));
  for(const u of s.units){const city=nearestCity(u.location,u.position);u.city=city.id;u.position=[...city.position];u.order=null;}
  s.battles=[];log(s,'Сохранение обновлено: контроль перенесён на города. Отдайте приказы заново.');
  return validSave(s)?s:null;
}
