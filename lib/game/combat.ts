import * as THREE from 'three';
export const DECOR_HEALTH=100;
export type CombatTarget={id:string; object:THREE.Group; bounds:THREE.Box3; name:string};
/** A world-session store: streaming and character swaps never restore damaged objects. */
export class CombatStore {
  targets=new Map<string,CombatTarget>();
  private health=new Map<string,number>();
  private listeners=new Set<()=>void>();
  private destroyedListeners=new Set<(id:string)=>void>();
  onDestroyed=(listener:(id:string)=>void)=>{this.destroyedListeners.add(listener);return()=>{this.destroyedListeners.delete(listener);};};
  getHealth=(id:string)=>this.health.get(id)??DECOR_HEALTH;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  damage(id:string,amount:number){
    if(!Number.isFinite(amount)||amount<=0)return;
    const previous=this.getHealth(id),remaining=previous-amount,next=remaining<.001?0:remaining;
    if(next===previous)return;
    this.health.set(id,next);if(next===0)this.destroyedListeners.forEach(listener=>listener(id));this.listeners.forEach(listener=>listener());
  }
  register(target:CombatTarget){this.targets.set(target.id,target);return()=>{if(this.targets.get(target.id)===target)this.targets.delete(target.id);};}
  acquire(origin:THREE.Vector3,forward:THREE.Vector3,range:number){
    let result:CombatTarget|undefined,best=Infinity;
    const point=new THREE.Vector3();
    for(const target of this.targets.values()){
      if(this.getHealth(target.id)<=0)continue;
      target.bounds.clampPoint(origin,point);
      const delta=point.clone().sub(origin),distance=delta.length();
      if(distance>range)continue;
      if(distance>.1&&delta.normalize().dot(forward)<.45)continue;
      const score=distance+(1-(distance>.1?delta.dot(forward):1))*4;
      if(score<best){best=score;result=target;}
    }
    return result;
  }
}
