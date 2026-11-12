const manifest: OrbitAsset[] = [];
import type { Level, Vec3 } from './types';
export type OrbitAsset = {
  id: string; kind: 'planet' | 'statue'; model: string; distant?: string;
  bounds: {min: Vec3; max: Vec3}; landing?: Vec3; statuePoints?: Vec3[];
  triangles: number; bytes: number; sourceBytes: number;
};
export type OrbitPlanet = { id: string; name: string; asset: OrbitAsset; position: Vec3; diameter: number; orbitRadius: number; orbitCenter: Vec3; inclination: number; landing: Vec3 };
export const orbitAssets = manifest as unknown as OrbitAsset[];
export const statueAssets = orbitAssets.filter(a=>a.kind==='statue');
export function createOrbits(level: Level): OrbitPlanet[] {
  const bounds=level.bounds ?? {min:[-25,-5,-162],max:[25,28,10]};
  const cx=(bounds.min[0]+bounds.max[0])/2,cz=(bounds.min[2]+bounds.max[2])/2;
  const extent=Math.max(bounds.max[0]-bounds.min[0],bounds.max[2]-bounds.min[2]);
  return orbitAssets.filter(a=>a.kind==='planet').map((asset,i)=>{
    const orbitRadius=extent*.65+180+i*55, inclination=(i%2?1:-1)*.12;
    const angle=i*2.399963+(level.id||1)*.21;
    const orbitCenter:Vec3=[cx,bounds.max[1]+100+i*18+orbitRadius*.12,cz];
    const position:Vec3=[cx+Math.cos(angle)*orbitRadius,orbitCenter[1]+Math.sin(angle)*orbitRadius*Math.sin(inclination),cz+Math.sin(angle)*orbitRadius*Math.cos(inclination)];
    const diameter=110+(i%5)*18;
    return {id:asset.id,name:`Orbit ${String(i+1).padStart(2,'0')}`,asset,position,diameter,orbitRadius,orbitCenter,inclination,landing:asset.landing!.map((v,k)=>position[k]+v*diameter) as Vec3};
  });
}
export function planetAt(planets:OrbitPlanet[],p:Vec3,margin=12) {
  return planets.find(planet=>p.every((v,k)=>v>=planet.position[k]+planet.asset.bounds.min[k]*planet.diameter-margin && v<=planet.position[k]+planet.asset.bounds.max[k]*planet.diameter+(k===1?45:margin)));
}
export function inOpenSpace(level:Level,p:Vec3) {
  const b=level.bounds;return !!b&&(p[0]<b.min[0]-30||p[0]>b.max[0]+30||p[2]<b.min[2]-30||p[2]>b.max[2]+30||p[1]>b.max[1]+35);
}
export const HOVER_HEIGHT=0.9144;
export const ALTITUDE_STEP=0.6096;
/** Absolute flight altitude survives leaving a map; a new surface sets the local landing floor. */
export function flightTarget(target:number,ground:number|null) {
  return ground===null?Math.max(-200,target):Math.max(target,ground+.94+HOVER_HEIGHT);
}
export function canLand(bodyY:number,ground:number|null) {
  return ground!==null && Math.abs(bodyY-.94-ground-HOVER_HEIGHT)<.22;
}
