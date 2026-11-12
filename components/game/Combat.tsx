'use client';
import { createContext, useContext, useMemo, useState, useRef, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CombatStore } from '@/lib/game/combat';
import type { Settings, Vec3 } from '@/lib/game/types';
import WorldLabel from './WorldLabel';
const Context=createContext<{store:CombatStore;enabled:boolean;paused:boolean}|null>(null);
export function CombatProvider({settings,paused,children}:{settings:Settings;paused:boolean;children:ReactNode}){
  const [store]=useState(()=>new CombatStore());
  const breakSounds=useRef<HTMLAudioElement[]>([]);
  useEffect(()=>{
    const voices=Array.from({length:3},()=>new Audio('/model/cyberRoid/break.mp3'));
    breakSounds.current=voices;let next=0;
    const unsubscribe=store.onDestroyed(()=>{
      const sound=voices[next++%voices.length];
      if(sound.muted||sound.volume===0)return;
      sound.currentTime=0;void sound.play().catch(()=>{});
    });
    return()=>{unsubscribe();voices.forEach(sound=>{sound.pause();sound.src='';});breakSounds.current=[];};
  },[store]);
  // eslint-disable-next-line react-hooks/immutability -- These HTMLAudioElements are effect-owned playback resources.
  useEffect(()=>{for(const sound of breakSounds.current){sound.volume=settings.volume*.8;sound.muted=settings.sfxMuted;if(paused)sound.pause();}},[settings.volume,settings.sfxMuted,paused]);
  const value=useMemo(()=>({store,enabled:settings.character==='cyberroid',paused}),[store,settings.character,paused]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCombat(){const value=useContext(Context);if(!value)throw Error('CombatProvider missing');return value;}
export function Destructible({id,name,children}:{id:string;name:string;children:ReactNode}){
  const {store,enabled,paused}=useCombat();
  const health=useSyncExternalStore(store.subscribe,()=>store.getHealth(id),()=>100);
  const [initiallyAlive]=useState(health>0);
  const root=useRef<THREE.Group>(null),label=useRef<THREE.Group>(null);
  const [labelPosition,setLabelPosition]=useState<Vec3>([0,1,0]);
  useEffect(()=>{
    const object=root.current;if(!object)return;
    object.updateWorldMatrix(true,true);
    const bounds=new THREE.Box3().setFromObject(object);
    if(bounds.isEmpty())return;
    const up=new THREE.Vector3(0,1,0).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
    const size=bounds.getSize(new THREE.Vector3());
    const reach=(Math.abs(up.x)*size.x+Math.abs(up.y)*size.y+Math.abs(up.z)*size.z)/2;
    const point=bounds.getCenter(new THREE.Vector3()).addScaledVector(up,reach+.65);
    // Labels remain in local coordinates even on the underside of a planet.
    object.worldToLocal(point);
    setLabelPosition(point.toArray() as Vec3);
    return store.register({id,name,object,bounds});
  },[id,name,store]);
  useFrame(({camera})=>{
    if(label.current&&root.current){
      const position=root.current.getWorldPosition(new THREE.Vector3());
      label.current.visible=enabled&&health>0&&camera.position.distanceTo(position)<45;
    }
  });
  return <group ref={root}>
    {health>0?children:initiallyAlive?<Shatter paused={paused}/>:null}
    {enabled&&health>0&&<group ref={label}><WorldLabel position={labelPosition} title={name} detail={`${Math.ceil(health)} / 100`} health={health}/></group>}
  </group>;
}
function Shatter({paused}:{paused:boolean}){
  const group=useRef<THREE.Group>(null),elapsed=useRef(0);
  useFrame((_,dt)=>{
    if(paused||!group.current)return;
    elapsed.current+=Math.min(dt,.05);const t=elapsed.current;
    group.current.visible=t<.65;
    group.current.children.forEach((o,i)=>{
      const a=i*2.399;o.position.set(Math.cos(a)*t*.6,.25+t*.4-t*t*.5,Math.sin(a)*t*.6);
      o.scale.setScalar(Math.max(0,.06*(1-t/.65)));
    });
  });
  return <group ref={group}>{Array.from({length:10},(_,i)=><mesh key={i}><octahedronGeometry args={[1,0]}/><meshBasicMaterial color={i%2?'#72dfff':'#c49aff'} toneMapped={false}/></mesh>)}</group>;
}
