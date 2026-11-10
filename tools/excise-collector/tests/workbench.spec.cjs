// Uses the main workspace's existing Playwright; the shipped collector needs no npm.
const { chromium, expect } = require('../../../web/node_modules/@playwright/test');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { mkdirSync, readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const fixture = spawn('python', [path.join(__dirname,'fixture_server.py')], {stdio:['ignore','pipe','inherit']});
  let browser;
  try {
    const [line] = await once(fixture.stdout,'data');
    const config = JSON.parse(line.toString().trim());
    browser = await chromium.launch({headless:true});
    const page = await browser.newPage({viewport:{width:1360,height:1100}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(config.url);
    // Opening prepares the first challenge without a click.
    await expect(page.locator('#reference')).toHaveText('CR 001 / 2026');
    await expect(page.locator('#code')).toBeFocused();
    const initial = await page.evaluate(async()=>await (await fetch('/api/state')).json());
    assert.equal(initial.report.attempts,0);
    await page.locator('#code').fill('TEST');
    await page.locator('#code').press('Enter');
    await expect(page.locator('#reference')).toHaveText('CR 002 / 2026');
    await expect(page.locator('#code')).toBeFocused();
    const saved = await page.evaluate(async()=>await (await fetch('/api/state')).json());
    assert.equal(saved.report.statuses.downloaded,1);
    const record = saved.recent.find(x=>x.status==='downloaded');
    assert(existsSync(path.join(config.directory,'documents',record.sha256.slice(0,2),record.sha256+'.pdf')));
    // Reload resumes the current challenge; it cannot repeat the last POST.
    await page.reload();
    await expect(page.locator('#reference')).toHaveText('CR 002 / 2026');
    let state = await page.evaluate(async()=>await (await fetch('/api/state')).json());
    assert.equal(state.report.attempts,1);
    const challenge = state.active.id;
    await page.locator('#code').fill('WRONG');await page.locator('#code').press('Enter');
    await expect(page.locator('#notice')).toContainText('Security code was rejected');
    await expect(page.locator('#code')).toBeFocused();
    state = await page.evaluate(async()=>await (await fetch('/api/state')).json());
    assert.equal(state.active.task.cr_number,2);assert.notEqual(state.active.id,challenge);
    await page.locator('#code').fill('TEST');await page.locator('#code').press('Enter');
    await expect(page.locator('#reference')).toHaveText('CR 003 / 2026');
    await expect(page.locator('#code')).toBeFocused();
    // Change parameters with Enter. The next image uses the selected office and range.
    await page.locator('#office').fill('after:1502');
    await page.locator('[name=years]').selectOption('2026');
    await page.locator('[name=start]').fill('7');await page.locator('[name=end]').fill('8');
    await page.locator('[name=end]').press('Enter');
    await expect(page.locator('#reference')).toHaveText('CR 007 / 2026');
    await expect(page.locator('#office-name')).toHaveText('New Office Beta');
    await expect(page.locator('#coverage')).toContainText('0 of 2 queries');
    await page.locator('#code').fill('TEST');await page.locator('#code').press('Enter');
    await expect(page.locator('#reference')).toHaveText('CR 008 / 2026');
    await expect(page.locator('#code')).toBeFocused();
    const output=path.join(__dirname,'../.runtime');mkdirSync(output,{recursive:true});
    await page.screenshot({path:path.join(output,'workbench-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.reload();
    await expect(page.locator('#code')).toBeFocused();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(output,'workbench-mobile.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: automatic startup, Enter-only saves, next-code focus, wrong-code recovery, reload, scope switching and mobile layout.');
  } finally {
    if(browser) await browser.close();
    fixture.kill('SIGTERM');
  }
})().catch(error=>{console.error(error);process.exit(1);});
