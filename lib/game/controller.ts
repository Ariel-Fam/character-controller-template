import type { Move } from './animations';
export const PAD_BUTTONS=[0,1,2,3,12,15,13,14];
const LABELS=['A / ×','B / ○','X / □','Y / △','D-pad ↑','D-pad →','D-pad ↓','D-pad ←'];
export function controllerMoveIndex(button:number,bank:number){
  const slot=PAD_BUTTONS.indexOf(button);
  return slot<0?-1:bank===0?slot-1:bank===1?7+slot:15+slot;
}
export function controllerBinding(index:number){
  return index<7?LABELS[index+1]:index<15?`L1 + ${LABELS[index-7]}`:`R1 + ${LABELS[index-15]}`;
}
export function controllerMove(moves:Move[],button:number,bank:number){return moves[controllerMoveIndex(button,bank)];}
export function stick(value:number){const a=Math.abs(value);return a<.18?0:Math.sign(value)*Math.min(1,(a-.18)/.82);}
