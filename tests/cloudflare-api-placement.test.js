const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const wrangler=fs.readFileSync(path.join(root,'wrangler.toml'),'utf8');
const routes=JSON.parse(fs.readFileSync(path.join(root,'public','_routes.json'),'utf8'));
const worker=fs.readFileSync(path.join(root,'public','_worker.js'),'utf8');

test('Pages invokes the smart-placed worker only for API routes',()=>{
  assert.deepEqual(routes,{version:1,include:['/api/*'],exclude:[]});
  assert.match(wrangler,/\[placement\]\s*mode = "smart"/);
});

test('advanced-mode worker keeps a static-asset fallback as a safe deployment guard',()=>{
  assert.match(worker,/if \(!url\.pathname\.startsWith\('\/api\/'\)\) return env\.ASSETS\.fetch\(request\)/);
});
