import { personSheetUrl } from "@/game/people-art";

/** CSS crops south idle frame 7 from the original, unmodified 72×128 sheet. */
export function ResidentPortrait({ id, large = false }: { id: string; large?: boolean }) {
  return <span aria-hidden="true" className={`person-portrait ${large ? "person-portrait--large" : ""}`}>
    <span style={{ backgroundImage: `url("${personSheetUrl(id)}")` }} />
  </span>;
}
