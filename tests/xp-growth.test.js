const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const xp=require('../public/xp-growth.js');
test('client levels agree with production server thresholds including exact boundaries',()=>{
 const source=fs.readFileSync(require.resolve('../public/_worker.js'),'utf8');const fn=source.slice(source.indexOf('function calculateLevel(totalXp)'),source.indexOf('\nfunction optionalText'));
 const server=vm.runInNewContext(fn+';calculateLevel');let total=0;
 for(let level=1;level<=99;level++){assert.equal(xp.levelInfo(total).level,level);assert.equal(xp.levelInfo(total).level,server(total));if(total)assert.equal(xp.levelInfo(total-1).level,level-1);total+=50+(level-1)*30}
 assert.equal(xp.levelInfo(100).level,2);assert.equal(xp.levelInfo(130).level,3);
});
test('a level-crossing journey fills the old bar then continues on the new one',()=>{
 const data=xp.journey(45,16);assert.equal(data.before.level,1);assert.equal(data.after.level,2);assert.equal(data.after.current,11);assert.equal(data.after.remaining,69);assert.equal(data.steps.length,2);assert.deepEqual(data.steps[0],{level:1,from:90,to:100});assert.equal(data.steps[1].level,2);assert.equal(data.steps[1].from,0);assert.ok(Math.abs(data.steps[1].to-13.75)<.0001);
});
test('multiple levels and exact-threshold endpoints retain every XP without recounting',()=>{
 const data=xp.journey(40,90);assert.equal(data.after.level,3);assert.equal(data.after.current,0);assert.equal(data.steps.length,2);assert.equal(data.levelsGained,2);assert.equal(data.earned,90);
});
test('zero XP has no fill animation or upgrade reward',()=>{const data=xp.journey(45,0);assert.deepEqual(data.steps,[]);assert.equal(data.levelsGained,0);assert.equal(data.newTitle,null);assert.match(xp.summaryMarkup(45,0),/本輪獲得 \+0 XP/)});
test('five-level titles are derived from accumulated progress',()=>{assert.equal(xp.journey(375,16).newTitle,'積墨學徒');assert.equal(xp.journey(380,8).newTitle,null);assert.equal(xp.titleFor(1),'文言新芽');assert.match(xp.titleFor(25),/25級/)});
test('invalid XP values are bounded and maximum level does not loop',()=>{for(const value of [-1,Infinity,NaN,'invalid'])assert.equal(xp.levelInfo(value).level,1);assert.equal(xp.levelInfo(1e9).level,99);assert.equal(xp.levelInfo(1e9).percent,100);assert.equal(xp.journey(1e9,8).steps.length,1)});
test('summary announces level and title unlocks with a static accessible endpoint',()=>{const html=xp.summaryMarkup(375,16);assert.match(html,/Lv\. 4 → Lv\. 5/);assert.match(html,/稱號解鎖：積墨學徒/);assert.match(html,/role="progressbar"/);assert.match(html,/再獲得 159 XP 升級/)});
