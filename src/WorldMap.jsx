import { useState, useMemo, useRef, useEffect } from 'react';
import { geoMercator, geoPath, geoGraticule10, geoCentroid, geoArea } from 'd3-geo';
import { Plus, Minus, LocateFixed, Globe2, Layers, MapPin, Crosshair, Navigation, Compass, X } from 'lucide-react';
import { countries, UNIT_TYPES, capitalNames } from './data/countries.js';
import { sovereign, isEnemy } from './engine.js';

const projection=geoMercator().scale(160).center([0,20]).translate([500,350]);
const path=geoPath(projection);
const graticule=path(geoGraticule10());
const labels={ '255':[10.7,51.2], '290':[24,52.3], '365':[39,57.5], '220':[2.2,46.4], '325':[12.7,42.6], '200':[-3.8,55], '380':[16,62], '385':[7.5,63.5], '375':[27,64.2], '315':[17,49.2], '305':[13,47.5], '360':[26,46.4], '345':[19,43.5], '310':[19.5,47], '230':[-3.3,40.2], '640':[33,39], '615':[3.5,32.7], '620':[18,29.5], '651':[30,27.5] };
export default function WorldMap({ geo, game, target, onCountry, selected, onUnit, layer, setLayer, viewSignal }) {
  const [view,setView]=useState({x:416,y:152,w:250,h:175});
  const [hover,setHover]=useState(null), [pointer,setPointer]=useState([0,0]), [hint,setHint]=useState(true);
  const svgRef=useRef(null), drag=useRef(null), dragged=useRef(false);
  const aspect=useRef(.7), measured=useRef(false);
  useEffect(()=>{
    const observer=new ResizeObserver(([entry])=>{
      const {width,height}=entry.contentRect;if(!width || !height)return;
      aspect.current=height/width;
      const firstMeasurement=!measured.current;measured.current=true;
      setView(v=>{
        const w=firstMeasurement && width<500 ? 190 : v.w, h=w*aspect.current;
        return {x:v.x+(v.w-w)/2,y:v.y+(v.h-h)/2,w,h};
      });
    });
    observer.observe(svgRef.current);return ()=>observer.disconnect();
  },[]);
  const shapes=useMemo(()=>geo.features.map(f=>({id:f.id,d:path(f),label:projection(labels[f.id] || geoCentroid(f)),area:geoArea(f)})),[geo]);
  const zoom=1000/view.w;
  const changeZoom=(factor,anchor)=>setView(v=>{
    const w=Math.max(75,Math.min(1000,v.w*factor)), h=w*aspect.current;
    const a=anchor || [v.x+v.w/2,v.y+v.h/2], x=a[0]-(a[0]-v.x)*w/v.w, y=a[1]-(a[1]-v.y)*h/v.h;
    return {x:Math.max(-30,Math.min(1000-w+30,x)),y:Math.max(-50,Math.min(760-h,y)),w,h};
  });
  useEffect(()=>{
    if(!viewSignal) return;
    const [x,y]=projection(countries[game.player].center);
    const w=svgRef.current.clientWidth<500?190:250,h=w*aspect.current;
    setView({x:x-w/2,y:y-h/2,w,h});
  },[viewSignal,game.player]);
  const mapPoint=e=>{
    const point=svgRef.current.createSVGPoint();point.x=e.clientX;point.y=e.clientY;
    const transformed=point.matrixTransform(svgRef.current.getScreenCTM().inverse());
    return [transformed.x,transformed.y];
  };
  const color=(id)=>{
    const owner=sovereign(game,id), c=countries[owner] || countries[id];
    if(layer==='diplomatic') return owner===game.player?'#899a70':isEnemy(game,game.player,owner)?'#a55e51':game.allies.includes(owner)?'#648b97':'#596c60';
    if(layer==='military') return owner===game.player?'#82976d':isEnemy(game,game.player,owner)?'#936052':'#5c6b5e';
    return c.color;
  };
  return <section className="map-stage" aria-label="Историческая карта мира 1936 года">
    <svg ref={svgRef} className={`world-map ${selected.length?'ordering':''}`} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet"
      onWheel={e=>{changeZoom(e.deltaY>0?1.12:.89,mapPoint(e));}}
      onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,view};dragged.current=false;}}
      onPointerMove={e=>{
        const rect=svgRef.current.getBoundingClientRect();setPointer([e.clientX-rect.left,e.clientY-rect.top]);
        if(!drag.current)return;const d=drag.current,dx=e.clientX-d.x,dy=e.clientY-d.y;
        if(Math.abs(dx)+Math.abs(dy)>5){dragged.current=true;svgRef.current.setPointerCapture(e.pointerId);setHover(null);setView({...d.view,x:d.view.x-dx/rect.width*d.view.w,y:d.view.y-dy/rect.height*d.view.h});}
      }} onPointerUp={e=>{drag.current=null;if(svgRef.current.hasPointerCapture(e.pointerId))svgRef.current.releasePointerCapture(e.pointerId);}} onPointerCancel={()=>{drag.current=null;}} onPointerLeave={()=>setHover(null)}>
      <defs>
        <pattern id="water-lines" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 3.5h7" stroke="#627d82" strokeWidth=".12" opacity=".22" /></pattern>
        <pattern id="occupied" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" x2="0" y1="0" y2="2" stroke="#d4c898" strokeWidth=".5" opacity=".4"/></pattern>
        <filter id="paper-grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3" seed="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".15"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>
        <filter id="marker-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy=".4" stdDeviation=".4" floodOpacity=".45"/></filter>
      </defs>
      <rect x="-1000" y="-1000" width="3000" height="3000" fill="#31464a" />
      <rect x="-1000" y="-1000" width="3000" height="3000" fill="url(#water-lines)" />
      <path d={graticule} fill="none" stroke="#9db0a0" strokeWidth=".2" opacity=".13"/>
      <g filter="url(#paper-grain)">
        {shapes.map(f=><path key={f.id} d={f.d} data-country={f.id} className={`country-shape ${target===f.id?'target-country':''}`} fill={color(f.id)} stroke={target===f.id?'#e3cc87':'#d0c9ad'} strokeWidth={target===f.id?.6:.18} strokeLinejoin="round"
          onPointerEnter={()=>!drag.current && setHover(f.id)} onPointerLeave={()=>setHover(null)} onClick={e=>{e.stopPropagation();if(!dragged.current)onCountry(f.id);}}><title>{countries[f.id].name}</title></path>)}
        {shapes.filter(f=>game.territories[f.id]!==countries[f.id].owner).map(f=><path key={f.id} d={f.d} fill="url(#occupied)" pointerEvents="none"/>)}
      </g>
      <g className="country-labels" pointerEvents="none">
        {shapes.filter(f=>countries[f.id].status==='independent' && f.area>.0008).map(f=> <text key={f.id} x={f.label[0]} y={f.label[1]} textAnchor="middle" fontSize={f.id==='365'?4.4:f.area>.03?3.7:2.2} letterSpacing={f.area>.015?1.2:.4}>{countries[f.id].adjective}</text>)}
      </g>
      {zoom>2 && <g className="capital-labels" pointerEvents="none">{Object.values(countries).filter(c=>c.status==='independent').map(c=>{
        const xy=projection(c.center);
        return <g key={c.id} transform={`translate(${xy})`}><circle r=".5"/><text x="1.3" y=".7" fontSize="1.7">{capitalNames[c.id] || c.capital}</text></g>;
      })}</g>}
      {game.units.filter(u=>u.owner===game.player && u.order).map(u=>{
        const a=projection(u.position),b=projection(countries[u.order.target].center);
        return <g key={u.id} pointerEvents="none"><path className="order-line" d={`M${a}L${b}`} fill="none" stroke="#e2c57e" strokeWidth=".55" strokeDasharray="1.4 1"/><circle cx={b[0]} cy={b[1]} r="1.8" fill="none" stroke="#e2c57e" strokeWidth=".35"/></g>;
      })}
      {game.battles.map(b=>{const xy=projection(countries[b.target].center);return <g key={b.id} transform={`translate(${xy})`} className="battle-marker" pointerEvents="none"><circle r="3.2" fill="#c36b48" opacity=".25"/><circle r="2" fill="#ac4e3d"/><text y=".85" textAnchor="middle" fontSize="2.8" fill="#f9ead0">⚔</text></g>;})}
      {layer!=='diplomatic' && game.units.filter(u=>u.owner===game.player || (isEnemy(game,game.player,u.owner) && (zoom>3 || layer==='military'))).map((u,i)=>{
        const xy=projection(u.position), own=u.owner===game.player, chosen=selected.includes(u.id), type=UNIT_TYPES[u.type], size=zoom<2?2.5:1;
        return <g key={u.id} transform={`translate(${xy[0]+(type.category==='air'?3:type.category==='naval'?-3:(i%2)*1.5)} ${xy[1]}) scale(${size})`} className={`unit-counter ${chosen?'chosen':''}`} role="button" aria-label={`${own?'Ваши':'Вражеские'} ${type.name}, ${u.count}`} tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(own)onUnit(u.id);else onCountry(u.location);}}} onClick={e=>{e.stopPropagation();if(!dragged.current){if(own)onUnit(u.id);else onCountry(u.location);}}}>
          <title>{countries[u.owner].name}: {type.name}, {u.count} · {u.order?'Выполняет приказ':'Ожидает приказа'}</title>
          <rect className="counter-box" x="-3.8" y="-2.3" width="7.6" height="4.6" rx=".45" fill={own?'#e6dec1':'#b47765'} stroke={chosen?'#ffda83':own?'#314735':'#622e24'} strokeWidth={chosen?.6:.28} filter="url(#marker-shadow)"/>
          <g stroke="#334433" strokeWidth=".3" fill="none">
            {u.type==='infantry' && <><rect x="-2.65" y="-.9" width="2.7" height="1.8"/><path d="m-2.65-.9 2.7 1.8m0-1.8-2.7 1.8"/></>}
            {u.type==='artillery' && <circle cx="-1.3" r=".7" fill="#334433"/>}
            {u.type==='tank' && <rect x="-2.6" y="-.65" width="2.6" height="1.3" rx=".65"/>}
            {type.category==='air' && <path d="m-1.35-1.3 0 2.6m-1.5-1.1 3-.9m-2.2 2 .7-.3.7.3"/>}
            {type.category==='naval' && <path d="m-2.9 0 3 0-.5 1-2 0-.5-1m1.6-1.3v1.3m-.8-.8h1.7"/>}
          </g>
          <text x="1.6" y=".75" fontSize="2.15" fill="#2c3b2b" textAnchor="middle" fontWeight="700">{u.count}</text>
          <rect x="-3.35" y="1.75" width={6.7*u.organization/100} height=".35" fill={u.organization>60?'#65834e':'#ae7c49'}/>
        </g>;
      })}
      <text x="405" y="288" className="sea-label" fontSize="4" transform="rotate(-65 405 288)" pointerEvents="none">АТЛАНТИЧЕСКИЙ ОКЕАН</text>
      <text x="532" y="328" className="sea-label" fontSize="3.1" pointerEvents="none">СРЕДИЗЕМНОЕ МОРЕ</text>
    </svg>
    <div className="map-heading"><span className="eyebrow">ОПЕРАЦИОННАЯ КАРТА</span><h2>{zoom<1.8?'Мировой театр':countries[game.player].center[0]>60?'Восточный театр':'Европейский театр'}</h2><span className="map-caption"><span className="status-dot"/> Границы на 1 января 1936 года</span></div>
    <div className="map-legend"><span><i style={{background:countries[game.player].color}}/> Ваша страна</span><span><i className="enemy-key"/> Противник</span><span><i className="neutral-key"/> Нейтральные</span></div>
    <div className="map-layers" aria-label="Слой карты">
      {[['political',Layers,'Политическая карта'],['military',Crosshair,'Военная карта'],['diplomatic',Globe2,'Дипломатическая карта']].map(([id,Icon,name])=><button key={id} className={layer===id?'active':''} onClick={()=>setLayer(id)} title={name} aria-label={name}><Icon size={17}/></button>)}
    </div>
    <div className="map-tools"><button onClick={()=>changeZoom(.8)} title="Приблизить" aria-label="Приблизить карту"><Plus size={19}/></button><button onClick={()=>changeZoom(1.25)} title="Отдалить" aria-label="Отдалить карту"><Minus size={19}/></button><span/><button onClick={()=>{const p=projection(countries[game.player].center);const w=svgRef.current.clientWidth<500?190:250,h=w*aspect.current;setView({x:p[0]-w/2,y:p[1]-h/2,w,h});}} title="К своей стране" aria-label="К своей стране"><LocateFixed size={18}/></button><button onClick={()=>setView({x:0,y:40,w:1000,h:700})} title="Весь мир" aria-label="Весь мир"><Globe2 size={18}/></button></div>
    <div className="map-compass"><Compass size={46} strokeWidth={1}/><span>N</span></div>
    <div className="map-scale"><span>500 км</span><i/><small>{Math.round(zoom*100)}%</small></div>
    {hover && !drag.current && <div className="map-tooltip" style={{left:Math.min(pointer[0]+15,svgRef.current?.clientWidth-210),top:Math.min(pointer[1]+18,svgRef.current?.clientHeight-75)}}><strong>{countries[hover].name}</strong><span>{countries[sovereign(game,hover)]?.name} · {isEnemy(game,game.player,sovereign(game,hover))?'В состоянии войны':'Нажмите для выбора'}</span></div>}
    {hint && <div className={`map-hint ${selected.length?'order-hint':''}`}><Navigation size={15}/><span>{selected.length?`Выбрано ${selected.length}. Нажмите на страну, чтобы отдать приказ.`:'Перетаскивайте карту · Колесо мыши для масштаба'}</span><button onClick={()=>setHint(false)} aria-label="Скрыть подсказку"><X size={13}/></button></div>}
  </section>;
}
