'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec3 } from '@/lib/game/types';

/** Small DOM markers owned by this effect, without a nested React root. */
export default function WorldLabel({position,title,detail,onClick,health}:{
  position:Vec3; title:string; detail?:string; onClick?:()=>void; health?:number;
}) {
  const {gl}=useThree();
  const group=useRef<THREE.Group>(null);
  const element=useRef<HTMLDivElement|null>(null);
  const projected=useMemo(()=>new THREE.Vector3(),[]);
  const interactive=!!onClick;
  useEffect(()=>{
    const wrapper=document.createElement('div');
    wrapper.dataset.worldLabel='';
    wrapper.style.cssText='position:absolute;top:0;left:0;display:none;pointer-events:none;z-index:5;';
    const label=document.createElement(interactive?'button':'div');
    label.className=interactive?'orbit-retry':'orbit-label';
    label.style.pointerEvents=interactive?'auto':'none';
    wrapper.append(label);
    gl.domElement.parentElement?.append(wrapper);
    element.current=wrapper;
    return()=>{element.current=null;wrapper.remove();};
  },[gl,interactive]);
  useEffect(()=>{
    const label=element.current?.firstElementChild;
    if(!label)return;
    // This DOM node is created and owned by the effect above, not React.
    // eslint-disable-next-line react-hooks/immutability
    label.textContent=title;
    if(detail){const small=document.createElement('small');small.textContent=detail;label.append(small);}
    if(health!==undefined){
      const bar=document.createElement('div'),fill=document.createElement('span');
      bar.className='decor-health';bar.setAttribute('role','progressbar');
      bar.setAttribute('aria-label',`${title} health`);bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');bar.setAttribute('aria-valuenow',String(Math.ceil(health)));
      fill.style.width=`${Math.max(0,Math.min(100,health))}%`;bar.append(fill);label.append(bar);
    }
    const click=(event:Event)=>{event.stopPropagation();onClick?.();};
    label.addEventListener('click',click);
    return()=>label.removeEventListener('click',click);
  },[title,detail,onClick,interactive,health]);
  useFrame(({camera,size})=>{
    const marker=group.current,wrapper=element.current;
    if(!marker||!wrapper)return;
    marker.getWorldPosition(projected).project(camera);
    let visible=projected.z>=-1&&projected.z<=1&&Math.abs(projected.x)<=1.1&&Math.abs(projected.y)<=1.1;
    for(let parent:THREE.Object3D|null=marker;parent&&visible;parent=parent.parent)visible=parent.visible;
    wrapper.style.display=visible?'':'none';
    if(visible)wrapper.style.transform=`translate(${(projected.x+1)*size.width/2}px,${(1-projected.y)*size.height/2}px) translate(-50%,-50%)`;
  });
  return <group ref={group} position={position}/>;
}
