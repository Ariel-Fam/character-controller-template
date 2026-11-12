import type { AnimationClip } from "three";
import * as groundingData from "./animation-grounding.json";
const grounding = groundingData as Record<string, Record<string, {duration:number; offsets:number[]}>>;

/** Prepare private clips without modifying the cached GLTF animations. */
export function prepareAnimationClips(
  clips: AnimationClip[],
  character = "runner",
  applyGrounding = true,
) {
  const prepared = clips.map((clip) => {
    const copy = clip.clone();
    for (const track of copy.tracks) {
      if (
        !track.name.endsWith(".position") ||
        !/hips|root|armature/i.test(track.name)
      )
        continue;
      const x = track.values[0],
        y = track.values[1],
        z = track.values[2];
      const attached = ["Hang_and_Climb_Left", "Hang_and_Climb_Rght", "Slow_Ladder_Climb", "climbing_up_wall"].includes(clip.name);
      for (let i = 0; i < track.values.length; i += 3) {
        // Keep horizontal travel under the physics controller's control.
        track.values[i] = x;
        track.values[i + 2] = z;
        // The capsule follows the ledge/ladder. Authored root ascent must not lift the mesh twice.
        if (attached) track.values[i + 1] = y;
        if (character === "intergalactron" && /hips/i.test(track.name)) {
          const lift: Record<string, number> = {
            Idle_6: 2.65,
            Walking: 6.3,
            Running: 7.3,
            Run_Jump_and_Roll: 6.4,
            Backflip: 0.03,
            Backflip_and_Hooks: 0.05,
            Backflip_Sweep_Kick: 0.035,
            push_up: 0.02,
            ForwardRight_Run_Fight: 0.035,
          };
          track.values[i + 1] += lift[clip.name] ?? 0;
        }
        // Ground the inverted pose. The replacement cosmic rigs use centimetre-scale hips.
        // Its skinned surface reaches -1.177 in model units; lift the hips
        // before mixing so entry/exit crossfades inherit the correction.
        if (clip.name === "Breakdance_1990" && /hips/i.test(track.name)) {
          track.values[i + 1] += character === "runner" ? 1.18 : character === "intergalactron" ? -17.4 : character === "cyberroid" ? .975 : character === "cubehelix" ? -42 : 0;
        }
      }
      // Bake pose clearance into dense hip keys once, never skin vertices in the game loop.
      const curve = applyGrounding && /hips/i.test(track.name) ? grounding[character]?.[clip.name] : undefined;
      if (curve) {
        const interpolant = track.InterpolantFactoryMethodLinear();
        const times = [...new Set([...track.times,...curve.offsets.map((_,i)=>curve.duration*i/(curve.offsets.length-1))])].sort((a,b)=>a-b);
        const values:number[]=[];
        for (const time of times) {
          const value=interpolant.evaluate(time);
          const t=Math.min(curve.offsets.length-1,Math.max(0,time/curve.duration*(curve.offsets.length-1)));
          const left=Math.floor(t),right=Math.min(left+1,curve.offsets.length-1);
          const offset=curve.offsets[left]+(curve.offsets[right]-curve.offsets[left])*(t-left);
          values.push(value[0],value[1]+offset,value[2]);
        }
        track.times=new Float32Array(times);track.values=new Float32Array(values);
      }
    }
    return copy;
  });
  if (character === "cyberroid") {
    // Hold the planted recovery stance from this rig's Aura Pulse, with both feet down.
    const idle = prepared.find(c=>c.name==="_01a1b669_9df3_7024_ac8d_adcca2d86937")?.clone();
    if(idle){
      idle.name="CyberIdle";idle.duration=1;
      for(const track of idle.tracks){
        const size=track.getValueSize(),value=track.values.slice(-size);
        if(/hips.*\.position$/i.test(track.name))value[1]+=.024;
        track.times=new Float32Array([0,1]);
        track.values=new Float32Array([...value,...value]);
      }
      prepared.push(idle);
    }
  }
  return prepared;
}
