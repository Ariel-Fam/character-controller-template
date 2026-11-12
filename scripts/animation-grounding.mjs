// Regenerate baked corrections after replacing a character asset:
// node scripts/animation-grounding.mjs --write
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const localRequire=createRequire(path.join(root,'lib/game/animation-clips.ts'));
const mod={exports:{}};
new Function('module','exports','require',ts.transpileModule(fs.readFileSync(path.join(root,'lib/game/animation-clips.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(mod,mod.exports,localRequire);
export const prepareClips=mod.exports.prepareAnimationClips;
export const models={runner:'me20Animations.glb',intergalactron:'interGalactronAnimated.glb',cubehelix:'cubeHelixAnimated.glb',cyberroid:'cyberRoid/CyberRoidAnimated.glb'};
export async function loadRig(id){
 const bytes=fs.readFileSync(path.join(root,'public/model',models[id]));
 const length=bytes.readUInt32LE(12),asset=JSON.parse(bytes.subarray(20,20+length));
 delete asset.images;delete asset.textures;delete asset.materials;
 for(const mesh of asset.meshes)for(const primitive of mesh.primitives)delete primitive.material;
 asset.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+length).toString('base64');
 globalThis.ProgressEvent??=class ProgressEvent {};
 return new GLTFLoader().parseAsync(JSON.stringify(asset),'');
}
export function skinnedBounds(scene){
 scene.updateMatrixWorld(true);
 scene.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox();}});
 return new THREE.Box3().setFromObject(scene);
}
async function bake(){
 const result={};
 for(const id of Object.keys(models)){
  const gltf=await loadRig(id),rest=skinnedBounds(gltf.scene),scale=1.85/(rest.max.y-rest.min.y);
  const clips=prepareClips(gltf.animations,id,false).filter(c=>c.name.startsWith('Dive_Down')||(['cubehelix','cyberroid'].includes(id)&&c.name==='Backflip'));
  const mixer=new THREE.AnimationMixer(gltf.scene);result[id]={};
  for(const clip of clips){
   mixer.stopAllAction();const action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();mixer.setTime(0);
   const track=clip.tracks.find(t=>/hips.*\.position$/i.test(t.name));
   const bone=THREE.PropertyBinding.findNode(gltf.scene,track.name.slice(0,-9));
   gltf.scene.updateMatrixWorld(true);const unit=bone.parent.matrixWorld.elements[5];
   const steps=Math.ceil(clip.duration*60),offsets=[];
   for(let frame=0;frame<=steps;frame++){
    mixer.setTime(Math.min(clip.duration-.00001,clip.duration*frame/steps));
    const bottom=(skinnedBounds(gltf.scene).min.y-rest.min.y)*scale;
    offsets.push(+((.012-bottom)/(scale*unit)).toFixed(6));
   }
   result[id][clip.name]={duration:clip.duration,offsets};
  }
  mixer.stopAllAction();console.log('Baked',id);
 }
 fs.writeFileSync(path.join(root,'lib/game/animation-grounding.json'),JSON.stringify(result,null,2)+'\n');
}
if(process.argv[2]==='--write')await bake();
