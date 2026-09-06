/**
 * Tiny local click — Claude City's Kenney 8-bit sample is not bundled here.
 * Sound stays opt-in via prefers-reduced-motion and a session flag.
 */

let context: AudioContext | null = null;

function audioAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return window.sessionStorage.getItem("worldline-sfx") !== "off";
}

export function playUiClickSound(): void {
  if (!audioAllowed()) return;
  try {
    context ??= new AudioContext();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "square";
    osc.frequency.value = 680;
    gain.gain.setValueAtTime(0.05, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + 0.07);
  } catch {
    /* AudioContext can be blocked; the click is decorative. */
  }
}
