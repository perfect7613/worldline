/** A local-clock art direction, not an astronomical sunrise prediction. */
export type DayPhase = "Night" | "Sunrise" | "Morning" | "Afternoon" | "Sunset";

const STOPS = [
  { hour: 0, tint: 0x849ac3, sky: 0x101e32 },
  { hour: 5, tint: 0x849ac3, sky: 0x101e32 },
  { hour: 6.5, tint: 0xffd3ad, sky: 0x926b75 },
  { hour: 9, tint: 0xfff7e8, sky: 0x648e8b },
  { hour: 14, tint: 0xffffff, sky: 0x719797 },
  { hour: 16, tint: 0xfff2d4, sky: 0x798c82 },
  { hour: 18, tint: 0xffb78d, sky: 0x98615f },
  { hour: 19.5, tint: 0xa0a6d0, sky: 0x303752 },
  { hour: 21, tint: 0x849ac3, sky: 0x101e32 },
  { hour: 24, tint: 0x849ac3, sky: 0x101e32 },
];

export function blendColor(a: number, b: number, amount: number): number {
  const t = Math.max(0, Math.min(1, amount));
  return [16, 8, 0].reduce((color, shift) => color | Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift, 0);
}

export function daylightAt(date: Date) {
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const phase: DayPhase = hour < 5 || hour >= 20 ? "Night" : hour < 8 ? "Sunrise" : hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Sunset";
  const index = STOPS.findIndex((stop, i) => i > 0 && hour <= stop.hour);
  const left = STOPS[Math.max(0, index - 1)];
  const right = STOPS[Math.max(1, index)];
  const progress = (hour - left.hour) / (right.hour - left.hour);
  const eased = progress * progress * (3 - 2 * progress);
  return { phase, tint: blendColor(left.tint, right.tint, eased), sky: blendColor(left.sky, right.sky, eased) };
}
