import type { ScenarioMode } from "@/game/world-data";

const tracks = [
  { id: "founder", title: "Product & GTM", portrait: 1 },
  { id: "policy", title: "Public policy", portrait: 9 },
] as const;

/** Original implementation inspired by 21st.dev's profile-selection pattern. */
export function PixelTrackSelector({ value, onChange }: { value: ScenarioMode; onChange: (mode: ScenarioMode) => void }) {
  return <div className="entry-track-picker" role="group" aria-label="Choose your exploration">
    {tracks.map(track => <button key={track.id} type="button" className={`entry-track ${value === track.id ? "is-active" : ""}`} aria-pressed={value === track.id} onClick={() => onChange(track.id)}>
      <span className="entry-track-avatar" aria-hidden="true"><span className="entry-person" style={{ backgroundImage: `url(/people/person-${String(track.portrait).padStart(2, "0")}.png)` }} /></span>
      <span className="entry-track-label"><strong>{track.title}</strong></span>
      <span className="entry-track-check" aria-hidden="true">{value === track.id ? "✓" : "+"}</span>
    </button>)}
  </div>;
}
