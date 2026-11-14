import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';

const rows=JSON.parse(readFileSync('outputs/potions.json'));
assert.equal(new Set(rows.map(row=>row.token)).size,185);
assert.deepEqual([0,1,2,3].map(type=>rows.filter(row=>row.type===type).length),[100,50,25,10]);

const db=new DatabaseSync(':memory:');
for(const migration of ['drizzle/0000_spotty_hammerhead.sql','drizzle/0001_stiff_thing.sql']) {
  db.exec(readFileSync(migration,'utf8').replaceAll('--> statement-breakpoint',''));
}
globalThis.testDB={prepare(sql){return{bind(...args){return{async first(){return db.prepare(sql).get(...args)}}}}}};

let source=readFileSync('app/api/drink/route.ts','utf8')
  .replace("import { env } from 'cloudflare:workers';",'const env={DB:globalThis.testDB};')
  .replace("import { registry } from '../../../lib/registry';",readFileSync('lib/registry.ts','utf8').replace('export const','const'))
  .replace("import { masterRegistry } from '../../../lib/master-registry';",readFileSync('lib/master-registry.ts','utf8').replace('export const','const'))
  .replace("import { publicPotion, rollPotion, types } from '../../../lib/potions';",readFileSync('lib/potions.ts','utf8').replaceAll('export ','').replace(/type PotionDefinition = \{[\s\S]*?\};/,'')
  );
const js=ts.transpile(source,{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext});
const{POST,OPTIONS}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const request=(token,action='consume',origin='https://test.local')=>new Request('https://test.local/api/drink',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({token,action})});

const preflight=await OPTIONS(new Request('https://test.local/api/drink',{method:'OPTIONS',headers:{origin:'https://cat1ang.github.io'}}));
assert.equal(preflight.status,204);
assert.equal(preflight.headers.get('access-control-allow-origin'),'https://cat1ang.github.io');

for(let type=0;type<4;type++){
  const row=rows.find(item=>item.type===type);
  const inspected=await POST(request(row.token,'inspect'));
  const inspection=await inspected.json();
  assert.equal(inspection.status,'ready');
  assert.equal(inspection.type,type);
  assert.equal(db.prepare('select count(*) as n from consumed').get().n,type);

  const responses=await Promise.all(Array.from({length:8},()=>POST(request(row.token))));
  assert.ok(responses.every(response=>response.status===200));
  const bodies=await Promise.all(responses.map(response=>response.json()));
  assert.equal(bodies.filter(body=>!body.used).length,1);
  assert.equal(bodies.filter(body=>body.used).length,7);
  assert.deepEqual(new Set(bodies.map(body=>JSON.stringify(body.outcome))).size,1);
  const outcome=bodies[0].outcome;
  assert.ok(outcome.dice.every(value=>value>=1&&value<=4));
  assert.equal(outcome.amount,outcome.dice.reduce((sum,value)=>sum+value,[2,4,8,20][type]));

  const replay=await (await POST(request(row.token,'inspect'))).json();
  assert.equal(replay.status,'consumed');
  assert.deepEqual(replay.outcome,outcome);
}

assert.equal((await POST(request('f'.repeat(48),'inspect'))).status,404);
assert.equal((await POST(request(rows[0].token,'inspect','https://evil.example'))).status,403);
assert.equal(db.prepare('select count(*) as n from consumed').get().n,4);
console.log('PASS: inspect is safe, four atomic consumptions survive 32 concurrent requests, results replay, CORS is restricted.');

const masters=JSON.parse(readFileSync('outputs/master-codes.json'));
for(const row of masters){
  for(let i=0;i<3;i++){
    const response=await POST(request(row.token));
    const body=await response.json();
    assert.equal(response.status,200);assert.equal(body.demo,true);assert.equal(body.type,row.type);
  }
}
assert.equal(db.prepare('select count(*) as n from consumed').get().n,4);
console.log('PASS: all four master codes remain reusable and never touch the consumed table.');
