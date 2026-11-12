/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');const THREE=require('three');
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const loaded={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(loaded,loaded.exports,p=>p.startsWith('.')?load(path.resolve(path.dirname(file),p+'.ts')):require(p));cache.set(file,loaded.exports);return loaded.exports;}
const {characterDefinition}=load('lib/game/characters.ts');const {CombatStore}=load('lib/game/combat.ts');const {controllerMove,controllerBinding,stick,PAD_BUTTONS}=load('lib/game/controller.ts');
test('CyberRoid exposes every native clip once with unique usable controls',()=>{
 const c=characterDefinition('cyberroid'),b=fs.readFileSync('public'+c.model),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
 const mapped=[...c.moves.map(m=>m.clip),...Object.values(c.automatic).filter(c=>c!=='CyberIdle')];
 assert.deepEqual([...mapped].sort(),g.animations.map(a=>a.name).sort());
 assert.equal(new Set(c.moves.map(m=>m.key)).size,c.moves.length);
 assert.ok(c.moves.every(m=>!['W','A','S','D','R','F','4'].includes(m.key)));
 for(const m of c.moves){const clip=g.animations.find(a=>a.name===m.clip),duration=Math.max(...clip.samplers.map(s=>g.accessors[s.input].max[0]));assert.ok(m.loop ? m.duration>=4 : m.clip==="Backflip" ? m.duration===.9 : Math.abs(duration-m.duration)<.002);}
 assert.equal(c.moves.find(m=>m.key==='T').combat.kind,'laser');
});
test('all four characters have reachable controller moves in three distinct banks',()=>{
 for(const id of ['runner','intergalactron','cyberroid','cubehelix']){
  const moves=characterDefinition(id).moves,reachable=[];
  for(let bank=0;bank<3;bank++)for(const b of PAD_BUTTONS){const m=controllerMove(moves,b,bank);if(m)reachable.push(m.key);}
  assert.deepEqual(reachable,moves.map(m=>m.key));assert.equal(new Set(moves.map((_,i)=>controllerBinding(i))).size,moves.length);
 }
 assert.equal(stick(.1),0);assert.equal(stick(-.1),0);assert.equal(stick(1),1);assert.equal(stick(-1),-1);
});
test('decor takes four punches or three kicks and stays destroyed after streaming',()=>{
 const store=new CombatStore();for(let i=0;i<3;i++)store.damage('gem',25);assert.equal(store.getHealth('gem'),25);store.damage('gem',25);assert.equal(store.getHealth('gem'),0);
 const object=new THREE.Group(),target={id:'gem',object,bounds:new THREE.Box3(new THREE.Vector3(-1,-1,-3),new THREE.Vector3(1,1,-2)),name:'gem'};
 store.register(target)();store.register(target);assert.equal(store.getHealth('gem'),0);
 for(let i=0;i<3;i++)store.damage('statue',35);assert.equal(store.getHealth('statue'),0);
 store.damage('statue',1000);assert.equal(store.getHealth('statue'),0);
});
test('target acquisition rejects distant, rear-facing and destroyed decor',()=>{
 const store=new CombatStore();for(const [id,z] of [['front',-3],['behind',3],['far',-40]])store.register({id,name:id,object:new THREE.Group(),bounds:new THREE.Box3(new THREE.Vector3(-.5,-1,z-.5),new THREE.Vector3(.5,1,z+.5))});
 const origin=new THREE.Vector3(),forward=new THREE.Vector3(0,0,-1);
 assert.equal(store.acquire(origin,forward,3.2).id,'front');store.damage('front',100);assert.equal(store.acquire(origin,forward,3.2),undefined);assert.equal(store.acquire(origin,forward,45).id,'far');
});
test('laser health drains progressively and reaches zero without floating point leftovers',()=>{
 const store=new CombatStore();for(let i=0;i<60;i++)store.damage('target',100/120);assert.ok(Math.abs(store.getHealth('target')-50)<1e-8);for(let i=0;i<60;i++)store.damage('target',100/120);assert.equal(store.getHealth('target'),0);
});
test('destruction emits one sound event per object, never on repeated damage or remount',()=>{
 const store=new CombatStore(),events=[];const stop=store.onDestroyed(id=>events.push(id));store.damage('a',50);assert.equal(events.length,0);store.damage('a',50);store.damage('a',50);assert.deepEqual(events,['a']);stop();store.damage('b',100);assert.deepEqual(events,['a']);
});

test('updated cosmic characters map only native clips, including automatic falling',()=>{
 for(const id of ['intergalactron','cubehelix']){
  const c=characterDefinition(id),b=fs.readFileSync('public'+c.model),g=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
  const native=new Set(g.animations.map(a=>a.name));
  for(const clip of [...Object.values(c.automatic),...c.moves.map(m=>m.clip),c.jump.clip])assert.ok(native.has(clip),id+': '+clip);
  assert.equal(c.automatic.fall,'Fall2');assert.equal(new Set(c.moves.map(m=>m.key)).size,c.moves.length);
  assert.deepEqual([...new Set([...Object.values(c.automatic),...c.moves.map(m=>m.clip)])].sort(),[...native].sort());
 }
});

test('CubeHelix and CyberRoid backflips finish one rotation within the physical jump',()=>{
 const flightTime=2*10/23;
 for(const id of ['cubehelix','cyberroid']){
  const m=characterDefinition(id).moves.find(m=>m.clip==='Backflip');
  assert.ok(m.retainOnDescent);assert.equal(m.kind,'flip');
  assert.ok(Math.abs(m.duration-flightTime)<.05,'rotation and physical landing stay synchronized');
 }
});

test('CyberRoid and CubeHelix breakdance loop at native speed for four seconds',()=>{
 for(const id of ['cyberroid','cubehelix']){
 const m=characterDefinition(id).moves.find(m=>m.key==='7');
 assert.equal(m.clip,'Breakdance_1990');assert.equal(m.duration,4);assert.equal(m.loop,true);assert.equal(m.kind,'dance');
 }
});

test('corrected dive and backflip poses remain at the capsule base through full clips',async()=>{
 const {loadRig,skinnedBounds,prepareClips,models}=await import('./animation-grounding.mjs');
 const THREE=await import('three');
 const curves=require('../lib/game/animation-grounding.json');
 for(const id of Object.keys(models)){
  const gltf=await loadRig(id),rest=skinnedBounds(gltf.scene),scale=1.85/(rest.max.y-rest.min.y);
  const mixer=new THREE.AnimationMixer(gltf.scene);
  for(const clip of prepareClips(gltf.animations,id).filter(c=>curves[id][c.name])){
   mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
   for(let frame=0;frame<Math.ceil(clip.duration*60);frame++){
    mixer.setTime(frame/60);const bottom=(skinnedBounds(gltf.scene).min.y-rest.min.y)*scale;
    assert.ok(bottom>-.025&&bottom<.08,`${id} ${clip.name} frame ${frame}: ${bottom}`);
   }
  }
  mixer.stopAllAction();
 }
});
