/* Fleet Architect PR #4 regression tests; run `node --test fleet-optimizer.test.js`.
 * This test loads the optimizer from the ACTUAL generated app.js, so the
 * committed application is tested rather than a separate mock implementation.
 */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const start=app.indexOf('  function optimizedBuildFleet(');
const end=app.indexOf('\n  function buildFleet(){',start);
if(start<0||end<start)throw Error('PR #4 optimizer not found in app.js. Upload the generated app.js first.');
const sandbox={};
vm.runInNewContext(app.slice(start,end)+'\nthis.optimize=optimizedBuildFleet;',sandbox);
const optimize=sandbox.optimize;
function ship(id,type,cp,row,qty,extras={}){return {id,name:id,variant:'A',type,cp,row,qty,owned:true,atk:3,tank:3,aa:2,support:1,fighterSlots:0,largeFighterSlots:0,corvetteSlots:0,size:'Medium',...extras};}
const weights={offensive:{atk:5,tank:1.35,aa:1.15,support:.7},balanced:{atk:3,tank:2.8,aa:2,support:1.6},defensive:{atk:1.65,tank:4.5,aa:3.5,support:2.65}};
const score=(s,st)=>{const w=weights[st.strategy];return s.atk*w.atk+s.tank*w.tank+s.aa*w.aa*(st.airThreat?1.6:.75)+s.support*w.support;};
const roster=()=>[
 ship('FG300','Frigate',3,'Middle',15,{atk:3,tank:2,aa:1,support:4}),
 ship('Taurus','Destroyer',8,'Front',10,{atk:5,tank:4,aa:2}),
 ship('Eris','Destroyer',7,'Front',10,{atk:3,tank:5,aa:1}),
 ship('Winged Hussar','Destroyer',8,'Middle',10,{atk:4,tank:2}),
 ship('Ceres','Destroyer',8,'Back',10,{fighterSlots:2}),
 ship('AC721','Destroyer',12,'Back',10,{corvetteSlots:2}),
 ship('Callisto','Cruiser',20,'Middle',3,{atk:5,tank:3,aa:1}),
 ship('Eternal Storm','Battlecruiser',32,'Middle',2,{atk:5,tank:3,aa:2}),
 ship('Vitas-B010','Fighter',0,'Aircraft',4,{size:'Large'}),
 ship('AT021','Fighter',0,'Aircraft',12),
 ship('CV-M011','Corvette',0,'Aircraft',2)
];
const run=(ships,cp,strategy='balanced')=>optimize({ships,settings:{cp,strategy,airThreat:true,preferAircraft:true}},score);
function verify(r){
 let cp=0;
 for(const x of r.hulls){assert.ok(x.ship.owned);assert.ok(x.qty<=x.ship.qty);cp+=x.qty*x.ship.cp;}
 assert.equal(cp,r.spent);assert.ok(cp<=r.limit);
 let f=0,c=0,l=0;
 for(const x of r.assignments){assert.ok(x.qty<=x.ship.qty);if(x.ship.type==='Fighter'){f+=x.qty;if(x.ship.size==='Large')l+=x.qty;}else c+=x.qty;}
 assert.ok(f<=r.capacity.f);assert.ok(c<=r.capacity.c);assert.ok(l<=r.capacity.l);
}
test('balanced considers a cruiser/battlecruiser core',()=>{
 const r=run(roster(),300);verify(r);
 assert.ok(r.hulls.some(x=>['Cruiser','Battlecruiser'].includes(x.ship.type)), 'Expected at least one heavy ship in this fixture');
 assert.ok(r.candidateCount>=3);assert.ok(r.selectionNotes.some(x=>x.includes('Capital-ship core')));
});
test('all tested CP budgets are respected',()=>{for(const cap of [110,240,300,360])verify(run(roster(),cap));});
test('unowned and zero-quantity variants never appear',()=>{
 const s=roster();s.find(x=>x.id==='Callisto').owned=false;s.find(x=>x.id==='Eternal Storm').qty=0;
 const r=run(s,300);verify(r);assert.equal(r.hulls.some(x=>['Cruiser','Battlecruiser'].includes(x.ship.type)),false);
});
test('large fighters require large fighter slots',()=>{
 const s=[ship('Ceres','Destroyer',8,'Back',5,{fighterSlots:2}),ship('large','Fighter',0,'Aircraft',8,{size:'Large'}),ship('small','Fighter',0,'Aircraft',2)];
 const r=run(s,60);verify(r);assert.equal(r.assignments.some(x=>x.ship.id==='large'),false);
});
test('all three doctrines preserve hard constraints',()=>{for(const mode of ['balanced','offensive','defensive'])verify(run(roster(),300,mode));});
test('generation is deterministic and leaves saved inventory unchanged',()=>{
 const s=roster(),before=JSON.stringify(s),a=run(s,300),b=run(s,300);
 assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(JSON.stringify(s),before);
});
test('empty and oversized-only inventories return valid empty formations',()=>{
 for(const s of [[],[ship('oversized','Battlecruiser',40,'Back',1)]]){const r=run(s,10);verify(r);assert.equal(r.hulls.length,0);}
});
