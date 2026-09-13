const test=require('node:test');
const assert=require('node:assert/strict');
const serverPractice=require('../public/server-practice-state.js');

test('intervention snapshots are deterministic across Firestore row and map key order',()=>{
  const a={
    id:'read.actor-tracking',
    data:{
      learningState:{tone:'neutral',actionable:false,priority:1,label:'觀察中',key:'watch'},
      kpIds:['kp_b','kp_a'],routeKpId:'kp_a',updatedAt:'2026-09-13T00:00:00.000Z',source:'server-native-v1',history:[]
    }
  };
  const b={
    id:'lex.context-inference',
    data:{
      learningState:{key:'none',label:'穩定',priority:0,actionable:false,tone:'neutral'},
      kpIds:['kp_c'],routeKpId:'kp_c',updatedAt:'2026-09-13T00:01:00.000Z',source:'server-native-v1',history:[]
    }
  };
  const aReordered={
    id:'read.actor-tracking',
    data:{
      learningState:{key:'watch',label:'觀察中',priority:1,actionable:false,tone:'neutral'},
      source:'server-native-v1',updatedAt:'2026-09-13T00:00:00.000Z',routeKpId:'kp_a',kpIds:['kp_b','kp_a'],history:[]
    }
  };
  const first=serverPractice.flattenInterventions([a,b]).interventionState;
  const second=serverPractice.flattenInterventions([b,aReordered]).interventionState;
  assert.equal(JSON.stringify(first),JSON.stringify(second));
  assert.deepEqual(Object.keys(first),['lex.context-inference','read.actor-tracking']);
  assert.deepEqual(Object.keys(first['read.actor-tracking']),[...Object.keys(first['read.actor-tracking'])].sort());
});
