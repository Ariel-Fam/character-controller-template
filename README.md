# Blue Character Template

A standalone Next.js App Router playground using the original full-body animated runner, the Goku flight model and aura, and all four selectable characters. The scene is a flat blue floor with a blue background, lighting, shadows, and no mall or course assets.

## Run

Requires Node.js 20.9 or newer.

```sh
cd character-template
npm ci
npm run dev
```

Open http://localhost:3001. For production, run `npm run build` then `npm start`.
This folder can be copied into its own repository; it does not import files from the parent project.

## Controls

| Action | Keyboard / mouse | Standard controller |
| --- | --- | --- |
| Move | WASD | Left stick |
| Orbit camera | Drag mouse, or click to lock | Right stick |
| Zoom | Mouse wheel | — |
| Jump / double jump | Space | A / × |
| Toggle sprint / cycle four flight gears | Shift | R2 / RT |
| Transform into Goku / land | 4 | L2 / LT |
| Rise / descend in flight | R / F | A / ×, B / ○ |
| Switch character | 1 | L3 |
| Pause | Esc | Start |
| Show controls and animation bindings | Tab | Select / View |
| Reset on foot | R | Pause → Reset to spawn |

Transformation replaces the entire character with the supplied Goku model, adds its animated aura and transformation sound, and enables flight. Descend to the base hover height (3 ft) and press 4 / L2 again to return to your selected character. Keyboard A/D retain the original two-foot flight sidestep behavior. Animation bindings are unchanged; open Controls to see each character's moves and L1/R1 controller banks.

The character picker includes **Original Runner, InterGalactron, CyberRoid, and CubeHelix**. Press **1** or **L3** to open it. Use arrow keys and Enter/Space, or the D-pad/left stick and A / ×. Esc, B / ○, or the opening shortcut closes it. Hints automatically follow your most recently used input. Switching while flying selects the character you return to when you land; Goku flight stays active.

Connect a standard-mapped gamepad and press a button to expose it to the browser. Use localhost or HTTPS. Menus support D-pad up/down or left stick, A / × to select and B / ○ to go back. Losing window focus or disconnecting the controller pauses the game.

## Customize

- `components/game/BlueWorld.tsx`: floor, colors, lighting, spawn, world bounds.
- `components/game/Game.tsx`: UI, pause and character selection.
- `components/game/Player.tsx`: existing movement, collision, camera and flight mechanics.
- `components/game/FlightAvatar.tsx`: Goku model and aura.
- `lib/game/characters.ts`: models and animation bindings.
- `components/game/useController.ts`: controller mapping.
- `public/model/` and `public/sfx/`: copied character assets and effects.

The world has a 520 m floor and resets the character near its boundaries. Vault/wall/rope animations keep their original bindings but require suitable obstacles if you add them.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

The template includes supplied character assets; no new asset license is granted by this template. Choose appropriate code and asset licensing before public distribution. To make a GitHub template, push this folder as its own repository and enable **Template repository** in its GitHub settings.
