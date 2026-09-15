const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {loadReviewedCatalog}=require('../scripts/reviewed_catalog.js');
const {buildRows,render}=require('../scripts/build_server_kp_universe.cjs');
const bundle=require('../public/server-kp-universe.js');

test('server KP universe is a deterministic projection of the reviewed catalog',()=>{
  const catalog=loadReviewedCatalog(path.join(__dirname,'..'));
  assert.equal(bundle.CATALOG_VERSION,catalog.catalogVersion);
  assert.equal(JSON.stringify(bundle.rows),JSON.stringify(buildRows(catalog)));
  assert.equal(bundle.rows.length,catalog.knowledgePoints.length);
  assert.equal(new Set(bundle.rows.map(row=>row.id)).size,bundle.rows.length);
  assert.equal(render(catalog).includes(`const rows=${JSON.stringify(bundle.rows)}`),true);
});

test('every bundled route has sorted unique skill ids and no question content',()=>{
  for(const row of bundle.rows){
    assert.deepEqual(row.data.skillIds,[...new Set(row.data.skillIds)].sort());
    assert.equal('content' in row.data,false);
    assert.equal('answer' in row.data,false);
  }
});
