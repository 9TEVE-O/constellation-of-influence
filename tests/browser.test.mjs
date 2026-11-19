import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const url = new URL('../index.html', import.meta.url).href;
const browser = await chromium.launch({ headless: true });
after(async () => browser.close());

async function open(options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(url);
  return {context,page};
}

test('eight stars can be opened and the matching story is presented', async () => {
  const {context,page} = await open();
  try {
    assert.equal(await page.locator('#stars button').count(), 8);
    await page.getByRole('button',{name:'The Origin',exact:true}).first().click();
    assert.equal(await page.locator('#detailTitle').innerText(),'The Origin');
    assert.equal(await page.getByRole('button',{name:'The Origin',exact:true}).first().getAttribute('aria-pressed'),'true');
  } finally { await context.close(); }
});

test('keyboard activation preserves focused star after a redraw', async () => {
  const {context,page} = await open();
  try {
    const star = page.locator('#stars [data-id="origin"]');
    await star.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset?.id),'origin');
    assert.equal(await page.locator('#detailTitle').innerText(),'The Origin');
  } finally { await context.close(); }
});

test('list view and search work without exposing filtered-out stars', async () => {
  const {context,page} = await open();
  try {
    await page.locator('#listMode').click();
    assert.equal(await page.locator('#listView button:visible').count(),8);
    await page.locator('#search').fill('generosity');
    assert.equal(await page.locator('#listView button:visible').count(),1);
    assert.equal(await page.locator('#listView button:visible').first().getAttribute('data-id'),'human');
    await page.locator('#search').fill('not-a-constellation-name');
    assert.equal(await page.locator('#listView button:visible').count(),0);
    assert.equal(await page.locator('#noResults').isVisible(),true);
  } finally { await context.close(); }
});

test('filtering hides irrelevant stars, and related links restore visibility', async () => {
  const {context,page} = await open();
  try {
    await page.locator('[data-filter="technology"]').click();
    assert.equal(await page.locator('#stars button').count(),3);
    await page.locator('#stars [data-id="elle"]').click();
    await page.locator('#relatedButtons').getByRole('button',{name:'The Origin'}).click();
    assert.equal(await page.locator('[data-filter="all"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#detailTitle').innerText(),'The Origin');
    assert.equal(await page.locator('#stars button').count(),8);
  } finally { await context.close(); }
});

for (const width of [320,390,768,1440]) {
  test('viewport '+width+'px has no horizontal page overflow', async () => {
    const {context,page} = await open({viewport:{width,height:900}});
    try {
      const geometry = await page.evaluate(() => ({
        scroll:document.documentElement.scrollWidth,
        client:document.documentElement.clientWidth
      }));
      assert.ok(geometry.scroll <= geometry.client+1, JSON.stringify(geometry));
      assert.equal(await page.locator('#stars button:visible').count(),8);
    } finally {await context.close();}
  });
}

test('reduced motion disables smooth scrolling and star transitions', async () => {
  const {context,page} = await open({reducedMotion:'reduce'});
  try {
    assert.equal(await page.locator('html').evaluate(node=>getComputedStyle(node).scrollBehavior),'auto');
    assert.equal(await page.locator('.star .orb').first().evaluate(node=>getComputedStyle(node).transitionDuration),'0s');
  } finally {await context.close();}
});

for (const view of ['map','list']) {
  test('axe WCAG 2 A/AA scan on '+view+' view', async () => {
    const {context,page} = await open();
    try {
      if(view==='list')await page.locator('#listMode').click();
      const results = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
      assert.deepEqual(results.violations.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.map(n=>n.target)})),[]);
    } finally {await context.close();}
  });
}


for (const width of [320,390]) {
  test('visible star hit areas remain distinct at '+width+'px', async () => {
    const {context,page}=await open({viewport:{width,height:750}});
    try {
      const rects=await page.locator('#stars button:visible').evaluateAll(nodes=>
        nodes.map(node=>({name:node.textContent.trim(),r:node.getBoundingClientRect().toJSON()}))
      );
      for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
        const a=rects[i].r,b=rects[j].r;
        const overlapWidth=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
        const overlapHeight=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
        assert.equal(overlapWidth*overlapHeight,0,
          'Overlapping touch targets: '+rects[i].name+' and '+rects[j].name+
          ' ('+overlapWidth.toFixed(1)+' x '+overlapHeight.toFixed(1)+'px)');
      }
    } finally{await context.close();}
  });
}
