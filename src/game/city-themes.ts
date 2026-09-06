import { TERRAIN_COLORS, PROP_COLORS } from "./claude-city/math/palette";
import type { ScenarioMode } from "./world-data";

export const CITY_THEMES = {
  founder: { city: "Bengaluru", landmark: "Vidhana Soudha", background: 0x314c43, photo: "/landmarks/vidhana-soudha.jpg" },
  policy: { city: "New Delhi", landmark: "Parliament of India", background: 0x665f4b, photo: "/landmarks/parliament-new-delhi.jpg" },
} as const;

/** Texture bakers consume these colors synchronously; each mode has its own atlas. */
export function applyCityPalette(mode: ScenarioMode) {
  const bangalore = mode === "founder";
  Object.assign(TERRAIN_COLORS, bangalore ? {
    grass: [0x7eaa79,0x77a171,0x88b381], grassShade:0x547b51,
    field:0x96b87f, park:0x729766, ground:0x8aa378, pavement:0xd8d6be,
    road:0x687775, roadShade:0x53645e, roadLine:0xe4dfbd, shadow:0x2c4a36,
  } : {
    grass:[0xa1ad72,0x96a568,0xacb67d], grassShade:0x737d4b,
    field:0xb1b984, park:0x8c9a62, ground:0xb8b289, pavement:0xe4c7a5,
    road:0x897d6d, roadShade:0x726759, roadLine:0xf3ddad, shadow:0x4e5737,
  });
  Object.assign(PROP_COLORS, bangalore ? {
    trunk:0x7c6e50, leaf:0x447754, leafLight:0x779e65, pine:0x63885b, bush:0x6b945c,
  } : {
    trunk:0x8a7151, leaf:0x6d8250, leafLight:0x95a46c, pine:0x7f9558, bush:0x8e9f64,
  });
}
