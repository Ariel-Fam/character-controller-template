"use client";
import { useEffect, useRef } from "react";
import { focusMenuControl } from "@/lib/game/menu-controls";
import CharacterPicker from "./CharacterPicker";
import type { CharacterId } from "@/lib/game/characters";
export default function CharacterSwitchDialog({selected,onSelect,onClose,input,flying}:{input:"keyboard"|"controller";flying:boolean;selected:CharacterId;onSelect:(id:CharacterId)=>void;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const node=dialog.current;
    const previous=document.activeElement as HTMLElement|null;
    node?.showModal();
    node?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    return()=>{node?.close();if(previous?.isConnected)previous.focus();};
  },[]);
  return <dialog ref={dialog} className="character-switch-dialog" aria-labelledby="character-switch-title" onKeyDown={event => {
    const direction = ["ArrowDown", "ArrowRight"].includes(event.code) ? 1 : ["ArrowUp", "ArrowLeft"].includes(event.code) ? -1 : 0;
    if (direction) { event.preventDefault(); focusMenuControl(event.currentTarget, direction); }
    if (event.code === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
  }} onCancel={event=>{event.preventDefault();onClose();}}>
    <div className="panel-heading">
      <div><span className="eyebrow">CHANGE YOUR STYLE</span><h2 id="character-switch-title">Choose your character</h2></div>
      <button onClick={onClose} aria-label="Close character picker">×</button>
    </div>
    <p className="character-switch-hint">{input === "controller" ? "D-pad / left stick: choose · A / ×: select · B / ○ or L3: close" : "Arrow keys: choose · Enter / Space: select · 1 / Esc: close"}
      {flying && <><br />Goku mode stays active. Your new character appears when you land with 4 / L2.</>}</p>
    <CharacterPicker selected={selected} onSelect={onSelect}/>
  </dialog>;
}
