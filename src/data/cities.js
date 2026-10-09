import cityData from './cities.json' with { type:'json' };
export const cities=cityData;
export const citiesByCountry=Object.fromEntries([...new Set(Object.values(cities).map(c=>c.country))].map(id=>[id,Object.values(cities).filter(c=>c.country===id)]));
export const capitalCity=id=>citiesByCountry[id]?.find(c=>c.capital);
export const nearestCity=(country,position)=>citiesByCountry[country]?.reduce((best,c)=>{
  const d=([x,y])=>(x-position[0])**2*Math.cos(position[1]*Math.PI/180)**2+(y-position[1])**2;
  return !best || d(c.position)<d(best.position)?c:best;
},null);
