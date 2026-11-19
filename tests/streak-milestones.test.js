const test=require('node:test');
const assert=require('node:assert/strict');
const {model,dateKey,badgeName}=require('../public/streak-milestones.js');
const now=Date.parse('2026-11-19T12:00:00Z');
test('Hong Kong calendar handles midnight and year boundaries',()=>{
 assert.equal(dateKey(Date.parse('2026-11-19T15:59:59Z')),'2026-11-19');
 assert.equal(dateKey(Date.parse('2026-11-19T16:00:00Z')),'2026-11-20');
 assert.equal(dateKey(Date.parse('2026-12-31T16:00:00Z')),'2027-01-01');
 assert.equal(dateKey(Date.parse('2026-12-31T16:00:00Z'),-1),'2026-12-31');
});
test('first visit gives an attainable five-day goal',()=>{
 const m=model({},now);assert.equal(m.current,0);assert.equal(m.next,5);assert.equal(m.earned,0);assert.equal(m.celebrate,0);
});
test('yesterday keeps the streak alive until the current day ends',()=>{
 const m=model({streak:7,lastGoalDate:'2026-11-18'},now);assert.equal(m.current,7);assert.equal(m.filled,2);assert.equal(m.next,10);assert.equal(m.remaining,3);assert.equal(m.complete,false);
});
test('each multiple of five unlocks a collectible and then begins a fresh segment',()=>{
 for(const days of [5,10,15,20,25,100,105]){
  const m=model({streak:days,lastGoalDate:'2026-11-19'},now);
  assert.equal(m.celebrate,days);assert.equal(m.earned,days/5);assert.equal(m.filled,0);assert.equal(m.next,days+5);
  assert.equal(model({streak:days,lastGoalDate:'2026-11-19',streakCelebratedThrough:days},now).celebrate,0);
 }
});
test('expired streaks keep all badges and give a fresh start',()=>{
 const m=model({streak:20,longestStreak:25,lastGoalDate:'2026-11-17',streakCelebratedThrough:20},now);
 assert.equal(m.current,0);assert.equal(m.best,25);assert.equal(m.earned,5);assert.equal(m.next,5);assert.equal(m.celebrate,0);assert.match(m.message,/重新出發/);
});
test('repeating an already collected milestone does not replay its reward',()=>{
 assert.equal(model({streak:5,longestStreak:20,lastGoalDate:'2026-11-19',streakCelebratedThrough:20},now).celebrate,0);
});
test('yesterday milestone does not trigger a belated celebration',()=>{
 assert.equal(model({streak:10,lastGoalDate:'2026-11-18'},now).celebrate,0);
 assert.equal(model({streak:10,lastGoalDate:'2026-11-20'},now).celebrate,0);
});
test('milestone names continue beyond the first four badges',()=>{
 assert.equal(badgeName(5),'初露墨光');assert.equal(badgeName(20),'文言同行');assert.equal(badgeName(25),'持之以恆');
});
