import { playUiClickSound } from "@/components/lib/play-ui-click";

export function useUiClick(): () => void {
  return playUiClickSound;
}
