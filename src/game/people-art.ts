import { RESIDENTS, type ResidentFixture } from "@/game/world-data";

/** Cabbit townfolk: original OGA-BY 3.0 sheets, see /people/credits.txt. */
export interface PeopleArtEntry {
  id: string;
  sheet: string;
  frameWidth: number;
  frameHeight: number;
}

const PEOPLE_ART: PeopleArtEntry[] = RESIDENTS.map((resident, index) => ({
  id: resident.id,
  sheet: `/people/person-${String(index + 1).padStart(2, "0")}.png`,
  frameWidth: 24,
  frameHeight: 32,
}));
export function fallbackPeopleArt(): PeopleArtEntry[] { return PEOPLE_ART; }
export function artForResident(resident: ResidentFixture, catalog: PeopleArtEntry[]): PeopleArtEntry {
  return catalog.find((entry) => entry.id === resident.id) ?? PEOPLE_ART[0];
}
export async function loadPeopleArt(): Promise<PeopleArtEntry[]> { return PEOPLE_ART; }
export function personSheetUrl(id: string): string {
  return (PEOPLE_ART.find((entry) => entry.id === id) ?? PEOPLE_ART[0]).sheet;
}
