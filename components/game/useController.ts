'use client';
import { useEffect, useState, useRef } from 'react';
import { focusMenuControl, menuControls } from '@/lib/game/menu-controls';
import { controllerMove, stick } from '@/lib/game/controller';
import { characterDefinition, type CharacterId } from '@/lib/game/characters';
export default function useController({playing,paused,flying,character}:{playing:boolean;paused:boolean;flying:boolean;character:CharacterId}){
  const [name,setName]=useState('');
  const [input, setInput] = useState<"keyboard" | "controller">("keyboard");
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => { if (event.isTrusted) setInput("keyboard"); };
    const pointer = () => setInput("keyboard");
    window.addEventListener("keydown", keyboard);
    window.addEventListener("pointerdown", pointer);
    return () => { window.removeEventListener("keydown", keyboard); window.removeEventListener("pointerdown", pointer); };
  }, []);
  const previousButtons=useRef<boolean[]>([]);
  useEffect(()=>{
    let frame=0,lastTime=0,connected='',held=new Set<string>(),menuAt=0;
    const key=(code:string,down:boolean)=>window.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,bubbles:true,cancelable:true}));
    const move=(x:number,z:number)=>window.dispatchEvent(new CustomEvent('parkour:gamepad-move',{detail:{x,z}}));
    const release=()=>{held.forEach(code=>key(code,false));held.clear();move(0,0);};
    const poll=(time:number)=>{
      frame=requestAnimationFrame(poll);
      const dt=Math.min((time-lastTime)/1000,.05);lastTime=time;
      const pad=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected&&p.mapping==='standard');
      if(!pad){if(connected){release();if(playing&&!paused)key('Escape',true);connected='';setName('');setInput('keyboard');}previousButtons.current=[];return;}
      if(connected!==pad.id){connected=pad.id;setName(pad.id);}
      const pressed=pad.buttons.map(b=>b.pressed||b.value>.5),edge=(i:number)=>pressed[i]&&!previousButtons.current[i];
      if(document.hidden||!document.hasFocus()){release();previousButtons.current=pressed;return;}
      if(pressed.some(Boolean) || pad.axes.some(axis => Math.abs(axis) > .25)) setInput("controller");
      if(playing&&edge(8)){key('Tab',true);key('Tab',false);previousButtons.current=pressed;release();return;}
      if(playing&&edge(10)){key('Digit1',true);key('Digit1',false);previousButtons.current=pressed;release();return;}
      if(playing&&edge(9)){key('Escape',true);key('Escape',false);previousButtons.current=pressed;release();return;}
      if(playing&&!paused){
        const bank=pressed[5]?2:pressed[4]?1:0,next=new Set<string>();
        move(stick(pad.axes[0]??0),stick(pad.axes[1]??0));
        window.dispatchEvent(new CustomEvent('parkour:gamepad-camera',{detail:{x:stick(pad.axes[2]??0)*dt,y:stick(pad.axes[3]??0)*dt}}));
        for(const [index,code] of [[7,'ShiftLeft'],[6,'Digit4']] as const)if(edge(index)){key(code,true);key(code,false);}
        if(flying&&!bank){if(pressed[0])next.add('KeyR');if(pressed[1])next.add('KeyF');}
        else {
          if(!bank&&edge(0)){key('Space',true);key('Space',false);}
          const moves=characterDefinition(character).moves;
          for(let i=0;i<pressed.length;i++)if(edge(i)){
            const action=controllerMove(moves,i,bank);if(!action)continue;
            const code=/\d/.test(action.key)?`Digit${action.key}`:`Key${action.key}`;key(code,true);key(code,false);
          }
        }
        for(const code of held)if(!next.has(code))key(code,false);
        for(const code of next)if(!held.has(code))key(code,true);
        held=next;
      }else{
        release();
        const direction=(pressed[13]||pressed[15]||pad.axes[1]>.5||pad.axes[0]>.5?1:0)-(pressed[12]||pressed[14]||pad.axes[1]<-.5||pad.axes[0]<-.5?1:0);
        const scope=document.querySelector('dialog[open]')??document.querySelector('.pause-panel')??document;
        const controls=menuControls(scope);
        if(direction&&time-menuAt>220&&controls.length){
          menuAt=time;focusMenuControl(scope,direction);
        }
        if(edge(0)){const focused=controls.includes(document.activeElement as HTMLElement)?document.activeElement as HTMLElement:controls.find(el=>el.classList.contains('primary'))??controls[0];focused?.click();}
        if(edge(1)){
          const back=controls.find(el=>/^(back|main menu|continue exploring|resume run)/i.test(el.textContent?.trim()??'')||el.getAttribute('aria-label')==='Close character picker');back?.click();
        }
      }
      previousButtons.current=pressed;
    };
    frame=requestAnimationFrame(poll);window.addEventListener('blur',release);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('blur',release);release();};
  },[playing,paused,flying,character]);
  return { name, input };
}
