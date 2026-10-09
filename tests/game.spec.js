import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-country="255"]').waitFor();
});

test('historical map renders, time runs continuously and pause freezes it',async({page})=>{
  await expect(page.locator('[data-country]')).toHaveCount(170);
  await expect(page.locator('.time-state')).toContainText('ИГРА НА ПАУЗЕ');
  const initial=await page.locator('.game-clock').innerText();
  await page.getByRole('button',{name:'Скорость 5x',exact:true}).click();
  await page.getByRole('button',{name:'Запустить время',exact:true}).click();
  await expect(page.locator('.game-clock')).not.toHaveText(initial);
  await page.keyboard.press('Space');
  await expect(page.locator('.time-state')).toContainText('ИГРА НА ПАУЗЕ');
  const frozen=await page.locator('.game-clock').innerText();
  await page.waitForTimeout(900);
  expect(await page.locator('.game-clock').innerText()).toBe(frozen);
});

test('training completes in real time, and all requested military branches are available',async({page})=>{
  await page.getByRole('button',{name:'Производство',exact:true}).click();
  await expect(page.locator('.production-card')).toHaveCount(6);
  const initialCount=await page.locator('.left-sidebar>.section-title .count-badge').innerText();
  await page.locator('.production-card').filter({has:page.getByRole('heading',{name:'Пехота',exact:true})}).getByRole('button',{name:/Подготовить/}).click();
  await expect(page.locator('.queue-full')).toHaveCount(1);
  await page.getByRole('button',{name:'Скорость 5x',exact:true}).click();
  await page.getByRole('button',{name:'Запустить время',exact:true}).click();
  await expect(page.locator('.queue-full')).toHaveCount(0,{timeout:17000});
  await expect(page.locator('.left-sidebar>.section-title .count-badge')).toHaveText(String(Number(initialCount)+1));
  await page.getByRole('tab',{name:/Авиация/}).click();
  await expect(page.locator('.unit-card')).toHaveCount(2);
  await page.getByRole('tab',{name:/Флот/}).click();
  await expect(page.locator('.unit-card')).toHaveCount(1);
});

test('research starts, blocks a second project and persists in a loaded save',async({page})=>{
  await page.getByRole('button',{name:'Исследования',exact:true}).click();
  await page.locator('.research-card').filter({hasText:'Промышленная модернизация'}).getByRole('button',{name:/Исследовать/}).click();
  await expect(page.locator('.tech-active')).toContainText('Исследуется');
  await expect(page.locator('.research-card').filter({hasText:'Модернизация вооружения'}).getByRole('button',{name:/Исследовать/})).toBeDisabled();
  await page.getByRole('button',{name:'Меню кампании',exact:true}).click();
  await page.getByRole('button',{name:'Сохранить кампанию',exact:true}).click();
  await page.reload();
  await page.getByRole('button',{name:'Исследования',exact:true}).click();
  await expect(page.locator('.tech-active')).toContainText('Исследуется');
  await expect(page.locator('.time-state')).toContainText('ИГРА НА ПАУЗЕ');
});

test('declare war, select troops and issue an invasion order through the map',async({page})=>{
  await page.getByRole('button',{name:'Дипломатия',exact:true}).click();
  await page.locator('.field-label select').selectOption('305');
  await page.getByRole('button',{name:/Объявить войну/}).click();
  await page.getByRole('dialog').getByRole('button',{name:/Объявить войну/}).click();
  await expect(page.locator('.relation-chip')).toHaveText('Война');
  await page.getByRole('button',{name:'Карта мира',exact:true}).click();
  await page.getByRole('button',{name:'Выбрать все',exact:true}).click();
  await expect(page.locator('.unit-card.selected')).toHaveCount(5);
  // Click an interior point in Austria, avoiding unit counters and city labels.
  const point=await page.evaluate(async()=>{
    const {geoMercator}=await import('/node_modules/.vite/deps/d3-geo.js');
    const projection=geoMercator().scale(160).center([0,20]).translate([500,350]);
    const [x,y]=projection([14.6,47.7]);const svg=document.querySelector('.world-map');
    const p=svg.createSVGPoint();p.x=x;p.y=y;const pt=p.matrixTransform(svg.getScreenCTM());return {x:pt.x,y:pt.y};
  });
  await page.mouse.click(point.x,point.y);
  await expect(page.locator('.toast')).toContainText('Приказ передан');
  await expect(page.locator('.order-line')).toHaveCount(5);
  await page.getByRole('button',{name:'Скорость 5x',exact:true}).click();
  await page.getByRole('button',{name:'Запустить время',exact:true}).click();
  await expect(page.locator('.battle-marker')).not.toHaveCount(0,{timeout:12000});
});

test('zoom, map layers and changing campaign country work',async({page})=>{
  const original=await page.locator('.world-map').getAttribute('viewBox');
  await page.getByRole('button',{name:'Приблизить карту',exact:true}).click();
  expect(await page.locator('.world-map').getAttribute('viewBox')).not.toBe(original);
  await page.getByRole('button',{name:'Весь мир',exact:true}).click();
  expect(await page.locator('.world-map').getAttribute('viewBox')).toBe('0 40 1000 700');
  await page.getByRole('button',{name:'Дипломатическая карта',exact:true}).click();
  await expect(page.locator('.unit-counter')).toHaveCount(0);
  await page.locator('.country-switch').click();
  await page.locator('.major-countries').getByRole('button',{name:/СССР/}).click();
  await expect(page.locator('.country-switch')).toContainText('СССР');
  await expect(page.locator('.nation-card h1')).toHaveText('Советский Союз');
});

test('mobile layout has no horizontal overflow and supports the full workflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button',{name:'Производство',exact:true}).click();
  await expect(page.locator('.production-card')).toHaveCount(6);
  await expect(page.locator('.production-card').first()).toBeVisible();
  await page.getByRole('button',{name:'Закрыть панель',exact:true}).click();
  await page.getByRole('button',{name:'Как играть',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Закрыть',exact:true}).click();
  await page.getByRole('button',{name:'Запустить время',exact:true}).click();
  await expect(page.getByRole('button',{name:'Поставить на паузу',exact:true})).toBeVisible();
  await page.screenshot({path:'/tmp/ironfront-mobile.png',fullPage:true});
});
