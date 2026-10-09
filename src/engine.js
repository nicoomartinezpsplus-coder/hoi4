import { countries, UNIT_TYPES, TECHS, LANDLOCKED } from './data/countries.js';
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
        const position=c.cities[(n+Object.keys(UNIT_TYPES).indexOf(type))%c.cities.length];
        units.push({id:`${c.id}-${type}-${n}`,owner:c.id,type,count:amount,health:100,organization:100,location:c.id,position:[position[0]+(type==='artillery'?0.6:type==='tank'?-0.7:0),position[1]+(t.category==='air'?1.3:t.category==='naval'?-1.3:n*.15)],order:null});
      }
    }
  }
  return {version:1,player,hours:0,paused:true,speed:1,states,units,territories:Object.fromEntries(Object.values(countries).map(c=>[c.id,c.owner])),wars:[],allies:[],queue:[],research:[],battles:[],events:[{id:'welcome',hours:0,type:'info',text:'1 января 1936 года. Мир на пороге перемен.'},{id:'ready',hours:0,type:'success',text:`${countries[player].name}: командование ждёт ваших приказов.`}],nextId:1};
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
  if(action.type==='pause') {s.paused=!s.paused;return {state:s};}
  if(action.type==='speed') {s.speed=clamp(action.speed,1,5);return {state:s};}
  if(action.type==='train') {
    const t=UNIT_TYPES[action.unit];
    if(!t) return {state,error:'Неизвестный тип подразделения.'};
    if(t.category==='naval' && LANDLOCKED.has(s.player)) return {state,error:'Для строительства кораблей нужен выход к морю.'};
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
    const target=countries[action.target];if(!target) return {state};
    const owner=sovereign(s,target.id), hostile=isEnemy(s,s.player,owner);
    const selected=s.units.filter(u=>action.ids.includes(u.id) && u.owner===s.player);
    if(!selected.length) return {state,error:'Сначала выберите подразделения.'};
    if(owner!==s.player && !hostile && !s.allies.includes(owner)) return {state,error:'Сначала объявите войну или заключите союз в дипломатии.'};
    let ordered=0, problem='';
    for(const u of selected) {
      const cat=UNIT_TYPES[u.type].category;
      if(s.battles.some(b=>b.units.includes(u.id))) {problem='Подразделение уже участвует в сражении.';continue;}
      if(hostile && u.location===target.id) {u.order={target:target.id,progress:0,duration:1,from:[...u.position],mission:true};ordered++;continue;}
      if(!hostile && u.location===target.id) {problem='Подразделение уже находится на этой территории.';continue;}
      if(cat==='land') {
        const current=countries[u.location];
        const adjacent=current.neighbors.includes(target.id) || current.neighbors.some(id=>sovereign(s,id)===owner && owner!==s.player && countries[id].neighbors.includes(target.id));
        const bySea=!LANDLOCKED.has(u.location) && !LANDLOCKED.has(target.id) && total(s,s.player,'naval')>0;
        if(!adjacent && !(bySea && distance(u.position,target.center)<6500)) {problem='Нет доступного маршрута. Нужна общая граница или флот для морского вторжения.';continue;}
      }
      if(cat==='air' && distance(u.position,target.center)>2500) {problem='Цель за пределами радиуса авиации (2 500 км).';continue;}
      if(cat==='naval' && LANDLOCKED.has(target.id)) {problem='Флот может действовать только у побережья.';continue;}
      const duration=cat==='air'?8:cat==='naval'?30:Math.max(12,distance(u.position,target.center)/18);
      u.order={target:target.id,progress:0,duration,from:[...u.position],mission:cat!=='land'};ordered++;
    }
    if(!ordered) return {state,error:problem || 'Приказ недоступен.'};
    log(s,`${hostile?'Наступление':'Переброска'}: ${target.name}. Подразделений: ${ordered}.`,hostile?'war':'info');
    return {state:s,message:`Приказ передан ${ordered} подразделениям.${problem?' '+problem:''}`};
  }
  if(action.type==='halt') {
    for(const u of s.units.filter(u=>action.ids.includes(u.id) && u.owner===s.player)) {
      if(s.battles.some(b=>b.units.includes(u.id))) continue;
      if(u.order) {u.position=[...u.order.from];u.order=null;}
    }
    return {state:s,message:'Приказы на перемещение отменены.'};
  }
  return {state};
}
function resolveArrival(s,u) {
  const dest=u.order.target, owner=sovereign(s,dest), hostile=isEnemy(s,u.owner,owner);
  u.order=null;
  if(!hostile) {u.location=dest;u.position=[...countries[dest].center];return;}
  let battle=s.battles.find(b=>b.target===dest && b.attacker===u.owner);
  if(!battle) {
    battle={id:`battle-${s.nextId++}`,target:dest,attacker:u.owner,defender:owner,units:[],progress:0,elapsed:0};
    s.battles.push(battle);log(s,`Сражение за ${countries[dest].name} началось.`,'war');
  }
  battle.units.push(u.id);
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
      u.order.progress+=hours;
      const t=Math.min(1,u.order.progress/u.order.duration), dest=countries[u.order.target].center;
      u.position=[u.order.from[0]+(dest[0]-u.order.from[0])*t,u.order.from[1]+(dest[1]-u.order.from[1])*t];
      if(t>=1) resolveArrival(s,u);
    } else if(!s.battles.some(b=>b.units.includes(u.id))) {
      u.organization=clamp(u.organization+hours*.3,0,100);u.health=clamp(u.health+hours*.04,0,100);
    }
  }
  for(const q of s.queue) {
    q.progress+=hours*Math.min(1.8,.6+s.states[q.owner].industry/80);
    if(q.progress>=q.duration) {
      const c=countries[q.owner];
      s.units.push({id:`unit-${s.nextId++}`,owner:q.owner,type:q.type,count:1,health:100,organization:100,location:q.owner,position:[...c.center],order:null});
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
    const defenders=s.units.filter(u=>u.owner===b.defender && u.location===b.target);
    const attack=attackers.reduce((n,u)=>n+power(s,u),0);
    const defense=defenders.reduce((n,u)=>n+power(s,u),0)+25;
    const hasGround=attackers.some(u=>UNIT_TYPES[u.type].category==='land');
    b.elapsed+=hours;b.progress=clamp(b.progress+hours*(attack/Math.max(20,defense)-.4)*1.2,-100,100);
    for(const u of attackers) {u.organization=clamp(u.organization-hours*.5,0,100);u.health=clamp(u.health-hours*defense/Math.max(20,attack)*.14,0,100);}
    for(const u of defenders) {u.organization=clamp(u.organization-hours*.45,0,100);u.health=clamp(u.health-hours*attack/Math.max(20,defense)*.14,0,100);}
    if(b.progress>=100 && hasGround) {
      s.territories[b.target]=b.attacker;
      for(const u of attackers) {u.location=b.target;u.organization=Math.max(30,u.organization);}
      for(const u of defenders) {u.location=u.owner;u.position=[...countries[u.owner].center];u.organization=35;u.health=Math.max(15,u.health);}
      s.states[b.attacker].industry+=Math.max(1,Math.floor(countries[b.target].industry*.2));
      log(s,`${countries[b.target].name}: территория занята армией ${countries[b.attacker].name}.`,'success');
      completed.push(b.id);
    } else if(b.progress<=-100 || !attackers.length || attackers.every(u=>u.health<15 || u.organization<10) || (b.elapsed>=96 && !hasGround)) {
      for(const u of attackers) {u.position=[...countries[u.location].center];u.organization=30;}
      log(s,hasGround?`Наступление на ${countries[b.target].name} остановлено. Войска отступают.`:`Миссия в ${countries[b.target].name} завершена. Для захвата территории нужна пехота или танки.`,hasGround?'war':'info');
      completed.push(b.id);
    }
  }
  s.battles=s.battles.filter(b=>!completed.includes(b.id));
  s.units=s.units.filter(u=>u.health>0);
  // Enemy countries react in continuous time, not turns.
  if(Math.floor(s.hours/72)>Math.floor(state.hours/72)) {
    for(const war of s.wars) {
      const enemy=war.find(id=>id!==s.player);if(!enemy) continue;
      const target=Object.keys(s.territories).find(id=>s.territories[id]===s.player && countries[id].neighbors.some(n=>sovereign(s,n)===enemy));
      if(!target) continue;
      const squad=s.units.filter(u=>u.owner===enemy && !u.order && !s.battles.some(b=>b.units.includes(u.id)) && UNIT_TYPES[u.type].category==='land' && u.organization>60).slice(0,2);
      for(const u of squad) u.order={target,progress:0,duration:36,from:[...u.position],mission:false};
      if(squad.length) log(s,`${countries[enemy].name}: обнаружено наступление противника.`,'war');
    }
  }
  return s;
}
export function validSave(s) {
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
