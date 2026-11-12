"use client";
import { CHARACTERS, type CharacterId } from "@/lib/game/characters";
export default function CharacterPicker({
  selected,
  onSelect,
}: {
  selected: CharacterId;
  onSelect: (id: CharacterId) => void;
}) {
  return (
    <div className="character-picker">
      {CHARACTERS.map((c, i) => (
        <button
          className={`character-card ${selected === c.id ? "selected" : ""}`}
          aria-pressed={selected === c.id}
          key={c.id}
          onClick={() => onSelect(c.id)}
        >
          <span className="character-emblem">{i ? "✧" : "↗"}</span>
          <strong>{c.name}</strong>
          <span>{c.description}</span>
          <small>{selected === c.id ? "SELECTED" : "SELECT CHARACTER"}</small>
        </button>
      ))}
      <p>
        Press <kbd>4</kbd> or L2 to become Goku and fly. Return to
        your selected character at the base hover height.
      </p>
    </div>
  );
}
