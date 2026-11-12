'use client';
import { useRef, useEffect, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useRapier, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import type { AnimationState } from './Avatar';
import type { Settings } from '@/lib/game/types';
import type { CombatTarget } from '@/lib/game/combat';
import { characterDefinition } from '@/lib/game/characters';
import { useCombat } from './Combat';
function stopSound(sound:HTMLAudioElement|undefined){
  if(sound){sound.pause();sound.currentTime=0;}
}
export default function CombatEffects({model,state,body,settings,paused,flying}:{
  model:RefObject<THREE.Group|null>;state:RefObject<AnimationState>;body:RefObject<RapierRigidBody|null>;settings:Settings;paused:boolean;flying:boolean;
}){
  const {store}=useCombat(),{world,rapier}=useRapier();
  const beam=useRef<THREE.Group>(null),core=useRef<THREE.Mesh>(null);
  const audio=useRef<HTMLAudioElement|null>(null);
  const impacts=useRef<Partial<Record<'impactHit'|'laserImpact'|'airPunch',HTMLAudioElement>>>({});
  const attack=useRef({epoch:-1,clip:'',elapsed:0,hit:false,acquired:false,target:undefined as CombatTarget|undefined});
  useEffect(()=>{
    const sound=new Audio('/model/cyberRoid/darkLazer.mp3');
    const contacts={impactHit:new Audio('/model/cyberRoid/impactHit.mp3'),laserImpact:new Audio('/model/cyberRoid/laserImpact.mp3'),airPunch:new Audio('/model/cyberRoid/airPunch.mp3')};
    sound.loop=true;audio.current=sound;impacts.current=contacts;
    return()=>{for(const voice of [sound,...Object.values(contacts)]){voice.pause();voice.src='';}audio.current=null;impacts.current={};};
  },[]);
  useEffect(()=>{for(const voice of [audio.current,...Object.values(impacts.current)])if(voice){voice.volume=settings.volume*.65;voice.muted=settings.sfxMuted;}},[settings.volume,settings.sfxMuted]);
  useEffect(()=>{if(paused||flying||settings.character!=='cyberroid'){audio.current?.pause();stopSound(impacts.current.airPunch);Object.values(impacts.current).forEach(voice=>voice.pause());if(beam.current)beam.current.visible=false;}},[paused,flying,settings.character]);
  useFrame((_,dt)=>{
    const visual=beam.current,root=model.current,sound=audio.current;
    if(!visual||!root)return;
    visual.visible=false;
    if(paused)return;
    const move=settings.character==='cyberroid'&&!flying?characterDefinition('cyberroid').moves.find(m=>m.clip===state.current.clip&&m.combat):undefined;
    if(!move?.combat){stopSound(impacts.current.airPunch);if(sound){sound.pause();sound.currentTime=0;}attack.current.epoch=-1;return;}
    const a=attack.current;
    if(a.epoch!==state.current.epoch||a.clip!==move.clip){
      stopSound(impacts.current.airPunch);
      Object.assign(a,{epoch:state.current.epoch,clip:move.clip,elapsed:0,hit:false,acquired:false,target:undefined});
      if(sound){sound.pause();sound.currentTime=0;if(move.combat.kind==='laser')void sound.play().catch(()=>{});}
    }
    const duration=state.current.duration??move.duration;
    const previousElapsed=a.elapsed;
    a.elapsed=state.current.elapsed??(a.elapsed+Math.min(dt,.05));
    if(a.elapsed>=duration){sound?.pause();stopSound(impacts.current.airPunch);return;}
    const laser=move.combat.kind==='laser';
    if(laser&&sound?.paused)void sound.play().catch(()=>{});
    root.updateWorldMatrix(true,true);
    const rotation=root.getWorldQuaternion(new THREE.Quaternion());
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(rotation);
    const origin=root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,1.15,0).applyQuaternion(rotation));
    if(!a.acquired&&a.elapsed>.1){a.target=store.acquire(origin,forward,laser?45:3.2);a.acquired=true;}
    if(laser){
      let palm:THREE.Object3D|undefined;
      root.traverse(o=>{if(/RightHandMiddle1$/.test(o.name))palm=o;});
      if(palm)palm.getWorldPosition(origin);
    }
    const playImpact=(name:'impactHit'|'laserImpact'|'airPunch')=>{
      const contact=impacts.current[name];
      if(!contact||contact.muted||contact.volume===0)return;
      contact.currentTime=0;void contact.play().catch(()=>{});
    };
    const target=a.target;
    const endpoint=origin.clone().addScaledVector(forward,laser?45:3.2);
    let valid=false,distance=laser?45:3.2;
    if(target&&store.getHealth(target.id)>0){
      // Aim at the closest region of the actual mesh, then check the physical line of sight.
      const point=target.bounds.clampPoint(origin,new THREE.Vector3());
      if(point.distanceTo(origin)<.1)target.bounds.getCenter(point);
      const direction=point.sub(origin).normalize();
      const ray=new THREE.Raycaster(origin,direction,0,laser?45:3.2);
      let hit=ray.intersectObject(target.object,true)[0];
      if(!hit){
        target.bounds.getCenter(point).sub(origin).normalize();ray.set(origin,point);hit=ray.intersectObject(target.object,true)[0];
      }
      if(hit){
        endpoint.copy(hit.point);distance=hit.distance;
        const obstruction=world.castRay(new rapier.Ray(origin,ray.ray.direction),distance+.05,true,rapier.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,body.current??undefined);
        valid=!obstruction||obstruction.timeOfImpact>=distance-.15;
        if(obstruction&&!valid)endpoint.copy(origin).addScaledVector(ray.ray.direction,obstruction.timeOfImpact);
      }
    }
    if(laser&&a.elapsed>=duration*.15&&previousElapsed<duration*.95){
      // Beam coordinates are world-space; independent of the character's radial frame.
      const delta=endpoint.clone().sub(origin);visual.position.copy(origin).addScaledVector(delta,.5);
      visual.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());
      const pulse=1+Math.sin(a.elapsed*30)*.18;visual.scale.set(pulse,delta.length(),pulse);visual.visible=true;
      if(core.current)core.current.rotation.y=a.elapsed*5;
      const channelTime=Math.max(0,Math.min(a.elapsed,duration*.95)-Math.max(previousElapsed,duration*.15));
      if(valid&&target&&channelTime>0){
        // One impact at first confirmed beam contact, never on every damage tick.
        if(!a.hit){a.hit=true;playImpact('laserImpact');}
        store.damage(target.id,110*channelTime/(duration*.8));
      }
    }else if(!laser&&!a.hit&&a.elapsed>=duration*.48){
      a.hit=true;if(valid&&target){playImpact('impactHit');store.damage(target.id,move.combat.damage);}else playImpact('airPunch');
    }
  });
  return <group ref={beam} visible={false}>
    <mesh ref={core}><cylinderGeometry args={[.045,.045,1,10]}/><meshBasicMaterial color="#d5faff" toneMapped={false}/></mesh>
    <mesh><cylinderGeometry args={[.12,.12,1,12]}/><meshBasicMaterial color="#52cfff" transparent opacity={.38} depthWrite={false} toneMapped={false}/></mesh>
  </group>;
}
