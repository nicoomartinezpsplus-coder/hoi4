import geography from './geography.json' with { type: 'json' };

const major = {
  '255': { name: 'Германия', full: 'Германский рейх', adjective: 'ГЕРМАНИЯ', color: '#737e70', flag: 'germany', ideology: 'Авторитаризм', leader: 'Берлин', manpower: 1240000, industry: 32, fuel: 8200, infantry: 24, artillery: 6, tank: 3, fighter: 4, bomber: 2, ship: 2, stability: 88, cities: [[13.4,52.52],[8.68,50.11],[11.58,48.14],[10,53.55],[17.04,51.1],[7.46,51.51]] },
  '365': { name: 'СССР', full: 'Советский Союз', adjective: 'СОВЕТСКИЙ СОЮЗ', color: '#826152', flag: 'ussr', ideology: 'Коммунизм', manpower: 3600000, industry: 40, fuel: 18000, infantry: 55, artillery: 12, tank: 8, fighter: 8, bomber: 4, ship: 4, stability: 76, cities: [[37.62,55.75],[30.32,59.93],[30.52,50.45],[36.23,49.99],[44.51,48.7],[50.1,53.2]] },
  '200': { name: 'Великобритания', full: 'Соединённое Королевство', adjective: 'ВЕЛИКОБРИТАНИЯ', color: '#987f68', flag: 'britain', ideology: 'Демократия', manpower: 980000, industry: 38, fuel: 14000, infantry: 16, artillery: 5, tank: 2, fighter: 5, bomber: 3, ship: 12, stability: 91, cities: [[-0.12,51.5],[-2.24,53.48],[-3.19,55.95]] },
  '220': { name: 'Франция', full: 'Французская Республика', adjective: 'ФРАНЦИЯ', color: '#708692', flag: 'france', ideology: 'Демократия', manpower: 1150000, industry: 29, fuel: 9000, infantry: 25, artillery: 7, tank: 3, fighter: 4, bomber: 2, ship: 6, stability: 64, cities: [[2.35,48.86],[4.84,45.76],[5.37,43.3],[7.75,48.58]] },
  '325': { name: 'Италия', full: 'Королевство Италия', adjective: 'ИТАЛИЯ', color: '#739081', flag: 'italy', ideology: 'Авторитаризм', manpower: 850000, industry: 22, fuel: 6000, infantry: 20, artillery: 5, tank: 2, fighter: 3, bomber: 2, ship: 6, stability: 81, cities: [[12.49,41.9],[9.19,45.46],[14.27,40.85]] },
  '2': { name: 'США', full: 'Соединённые Штаты', adjective: 'СОЕДИНЁННЫЕ ШТАТЫ', color: '#788979', flag: 'usa', ideology: 'Демократия', manpower: 2400000, industry: 60, fuel: 24000, infantry: 12, artillery: 4, tank: 2, fighter: 4, bomber: 3, ship: 10, stability: 94, cities: [[-77.04,38.9],[-87.63,41.88],[-118.24,34.05]] },
  '740': { name: 'Япония', full: 'Японская империя', adjective: 'ЯПОНИЯ', color: '#b19878', flag: 'japan', ideology: 'Авторитаризм', manpower: 1500000, industry: 28, fuel: 7200, infantry: 26, artillery: 6, tank: 2, fighter: 5, bomber: 3, ship: 9, stability: 86, cities: [[139.75,35.68],[135.5,34.69],[130.4,33.59]] },
  '290': { name: 'Польша', full: 'Польская Республика', adjective: 'ПОЛЬША', color: '#a58a8a', flag: 'poland', ideology: 'Нейтралитет', manpower: 620000, industry: 15, fuel: 4000, infantry: 16, artillery: 4, tank: 1, fighter: 2, bomber: 1, ship: 1, stability: 75, cities: [[21,52.25],[19.94,50.06],[23.9,49.84]] },
};
const names = { '205':'Ирландия','210':'Нидерланды','211':'Бельгия','212':'Люксембург','225':'Швейцария','230':'Испания','235':'Португалия','291':'Данциг','305':'Австрия','310':'Венгрия','315':'Чехословакия','339':'Албания','345':'Югославия','350':'Греция','355':'Болгария','360':'Румыния','366':'Эстония','367':'Латвия','368':'Литва','375':'Финляндия','380':'Швеция','385':'Норвегия','390':'Дания','395':'Исландия','20':'Канада','40':'Куба','70':'Мексика','140':'Бразилия','160':'Аргентина','530':'Эфиопия','560':'Южная Африка','630':'Иран','640':'Турция','645':'Ирак','651':'Египет','670':'Саудовская Аравия','700':'Афганистан','710':'Китай','711':'Тибет','712':'Монголия','750':'Британская Индия','800':'Сиам','900':'Австралия','920':'Новая Зеландия','620':'Итальянская Ливия','615':'Французский Алжир','616':'Тунис','652':'Сирия','625':'Судан','850':'Голландская Ост-Индия','840':'Филиппины','730':'Корея','713':'Тайвань','600':'Марокко','678':'Йемен','698':'Оман','790':'Непал','760':'Бутан','130':'Эквадор','135':'Перу','145':'Боливия','150':'Парагвай','155':'Чили','165':'Уругвай','100':'Колумбия','101':'Венесуэла','90':'Гватемала','91':'Гондурас','92':'Сальвадор','93':'Никарагуа','94':'Коста-Рика','95':'Панама','41':'Гаити','42':'Доминиканская Республика' };
const palette = ['#7d8980','#827e69','#819386','#8a827e','#85939c','#899574','#b0a085','#778c87'];
export const LANDLOCKED = new Set(['305','310','315','225','212','700','711','712','790','760','145','150','291','530']);
export const countries = Object.fromEntries(Object.entries(geography).map(([id,p]) => [id, {
  ...p, name: names[id] || p.name, full: names[id] || p.name, adjective: (names[id] || p.name).toUpperCase(),
  color: palette[Number(id) % palette.length], flag:'generic', ideology:'Нейтралитет',
  manpower: 150000 + (Number(id)%12)*40000, industry: 5+Number(id)%9, fuel: 3500,
  infantry: 4+Number(id)%7, artillery: 1+Number(id)%3, tank: Number(id)%2,
  fighter: 1, bomber: 0, ship: LANDLOCKED.has(id) ? 0 : 1, stability: 70+Number(id)%20,
  cities: [p.center], ...major[id],
}]));
export const MAJORS = ['255','365','200','220','325','2','740','290'];
export const UNIT_TYPES = {
  infantry: { name:'Пехота', plural:'Пехотные дивизии', category:'land', short:'ПЕХ', days:4, cost:120, men:10000, power:10, fuel:0, description:'Основа армии. Удерживает фронт и занимает территории.' },
  artillery: { name:'Артиллерия', plural:'Артиллерийские бригады', category:'land', short:'АРТ', days:6, cost:180, men:4000, power:16, fuel:1, description:'Огневая поддержка. Усиливает наступление сухопутных войск.' },
  tank: { name:'Танки', plural:'Танковые дивизии', category:'land', short:'ТАН', days:10, cost:320, men:6000, power:30, fuel:5, description:'Мобильная ударная сила. Высокая мощь и расход топлива.' },
  fighter: { name:'Истребители', plural:'Истребительные крылья', category:'air', short:'АВИ', days:7, cost:240, men:1500, power:18, fuel:3, description:'Завоёвывают превосходство в воздухе. Радиус 2 500 км.' },
  bomber: { name:'Бомбардировщики', plural:'Бомбардировочные крылья', category:'air', short:'БОМ', days:9, cost:280, men:2000, power:24, fuel:4, description:'Поддерживают наступление. Радиус 2 500 км.' },
  ship: { name:'Корабли', plural:'Боевые флотилии', category:'naval', short:'ФЛТ', days:14, cost:400, men:3000, power:22, fuel:4, description:'Блокируют побережье. Поддерживают морское вторжение.' },
};
export const TECHS = {
  weapons:{name:'Модернизация вооружения',description:'+20% к боевой мощи сухопутных войск',days:12,cost:250},
  industry:{name:'Промышленная модернизация',description:'+8 заводов и ускорение производства',days:10,cost:300},
  aviation:{name:'Новая авиационная доктрина',description:'+30% к боевой мощи авиации и флота',days:14,cost:280},
};
export const capitalNames = { '255':'Берлин','365':'Москва','200':'Лондон','220':'Париж','325':'Рим','290':'Варшава','305':'Вена','315':'Прага','310':'Будапешт','360':'Бухарест','345':'Белград','380':'Стокгольм','385':'Осло','375':'Хельсинки','390':'Копенгаген','230':'Мадрид','235':'Лиссабон','210':'Амстердам','211':'Брюссель','225':'Берн','640':'Анкара','740':'Токио','2':'Вашингтон','710':'Пекин' };
