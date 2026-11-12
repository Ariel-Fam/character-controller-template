"use client";
import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { DEFAULT_SETTINGS, INITIAL_TELEMETRY } from "@/lib/game/types";
import { characterDefinition } from "@/lib/game/characters";
import { controllerBinding } from "@/lib/game/controller";
import CharacterSwitchDialog from "./CharacterSwitchDialog";
import useController from "./useController";

const World = dynamic(() => import("./BlueWorld"), { ssr: false, loading: () => <div className="loading">Opening blue playground…</div> });
class Boundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="error-panel"><h1>Unable to load the playground</h1><p>Check that WebGL is available and the character files are present.</p><button onClick={() => location.reload()}>Reload</button></div> : this.props.children; }
}
const unlock = () => { if (document.pointerLockElement) document.exitPointerLock(); };
export default function Game() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [stats, setStats] = useState(INITIAL_TELEMETRY);
  const [paused, setPaused] = useState(false);
  const [picker, setPicker] = useState(false);
  const [help, setHelp] = useState(false);
  const [reset, setReset] = useState(0);
  const { name: pad, input: activeInput } = useController({playing: true, paused: paused || picker || help, flying: !!stats.flying, character: settings.character});
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "Digit1") { event.preventDefault(); unlock(); setHelp(false); setPicker(v => !v); }
      if (event.code === "Tab" && !picker) { event.preventDefault(); unlock(); setHelp(v => !v); }
      if (event.code === "Escape") {
        event.preventDefault(); unlock();
        if (picker) setPicker(false);
        else if (help) setHelp(false);
        else setPaused(v => !v);
      }
    };
    const blur = () => { setPaused(true); unlock(); };
    const hidden = () => { if (document.hidden) blur(); };
    window.addEventListener("keydown", key);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", hidden); };
  }, [picker, help]);
  const transform = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", {code: "Digit4"}));
    window.dispatchEvent(new KeyboardEvent("keyup", {code: "Digit4"}));
  };
  return <main className="playground">
    <Boundary><World settings={settings} paused={paused || picker || help} resetToken={reset} onUpdate={setStats} /></Boundary>
    <header><div><small>CHARACTER TEMPLATE / 01</small><h1>Blue playground</h1><p>{pad ? "Controller connected" : "Keyboard + mouse · Connect a controller to play"}</p></div>
      <button onClick={() => {unlock(); setPaused(true);}}>Pause · {activeInput === "controller" ? "Start" : "Esc"}</button></header>
    <footer><div className="status" role="status"><small>{stats.flying ? `GOKU MODE / ${characterDefinition(settings.character).name}` : characterDefinition(settings.character).name}</small><strong>{stats.motion} <span>{stats.speed.toFixed(1)} m/s</span></strong><p>{stats.flying ? `Gear ${stats.flightGear}/4 · ${stats.altitude} ft · ${activeInput === "controller" ? "A / B · × / ○ altitude" : "R / F altitude"}` : activeInput === "controller" ? "Left stick move · A / × jump · R2 sprint" : "WASD move · Space jump · Shift sprint"}</p></div>
      <nav aria-label="Game controls">
        <button disabled={paused || picker || help} onClick={transform}>{activeInput === "controller" ? "L2 / LT" : "4"} · {stats.flying ? "Land" : "Goku mode"}</button>
        <button onClick={() => {unlock(); setPicker(true);}}>{activeInput === "controller" ? "L3" : "1"} · Characters</button>
        <button onClick={() => {unlock(); setHelp(true);}}>{activeInput === "controller" ? "Select / View" : "Tab"} · Controls</button>
      </nav>
    </footer>
    {stats.flying && <p className="flight-note">Descend with F / B / ○ to 3 ft, then press 4 / L2 to return.</p>}
    {paused && !picker && !help && <div className="shade"><section className="pause-panel"><small>TAKE A BREATHER</small><h2>Paused</h2><button className="primary" onClick={() => setPaused(false)}>Resume run</button><button onClick={() => {setReset(v => v + 1); setPaused(false);}}>Reset to spawn</button><button onClick={() => setSettings(s => ({...s, sfxMuted: !s.sfxMuted}))}>Sound: {settings.sfxMuted ? "off" : "on"}</button></section></div>}
    {help && !picker && <div className="shade"><section className="pause-panel controls"><button onClick={() => setHelp(false)}>Back to playground</button><h2>Make your move</h2>
      <p>WASD / left stick: move · Mouse drag / right stick: camera · Scroll: zoom</p>
      <p>Space / A / ×: jump, press again to double jump · Shift / R2: toggle sprint or cycle flight gear</p>
      <p>4 / L2: Goku transformation · R / F or A / B (× / ○) in flight: rise / descend. Land at 3 ft with 4 / L2. On foot, R resets.</p>
      <p>1 / L3: switch character · Esc / Start: pause · Tab / Select: controls</p>
      <p>Menus: D-pad up/down or left stick, A / × selects, B / ○ goes back. Connect a standard controller and press a button to activate it.</p>
      <div className="moves">{characterDefinition(settings.character).moves.map((move, i) => <div key={move.key}><b>{move.key} · {move.name}</b><span>{controllerBinding(i)}</span><small>{move.hint}</small></div>)}</div>
    </section></div>}
    {picker && <CharacterSwitchDialog input={activeInput} flying={!!stats.flying} selected={settings.character} onClose={() => setPicker(false)} onSelect={character => {setSettings(s => ({...s, character})); setPicker(false);}} />}
  </main>;
}
