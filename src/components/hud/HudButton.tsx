/**
 * Provenance: Claude City (claude-clan)
 * Source: https://github.com/mittal-parth/claude-clan/blob/17fde7cb7d78849ad02993f2b65fd47b6e4f420f/apps/web/src/components/hud/HudButton.tsx
 * Commit: 17fde7cb7d78849ad02993f2b65fd47b6e4f420f
 * Imports adapted to local cn / click helpers.
 */
import { type VariantProps, cva } from "class-variance-authority";
import type { ButtonHTMLAttributes, MouseEvent } from "react";

import { useUiClick } from "@/components/lib/use-ui-click";
import { cn } from "@/components/lib/cn";

export const hudButtonVariants = cva(
  "hud-button retro inline-flex items-center justify-center gap-1-5 whitespace-nowrap select-none",
  {
    variants: {
      variant: {
        primary: "hud-button--primary",
        outline: "hud-button--outline",
        danger: "hud-button--danger",
        ghost: "hud-button--ghost",
      },
      size: {
        sm: "hud-button--sm",
        md: "hud-button--md",
        auto: "hud-button--auto",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface HudButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof hudButtonVariants> {
  sound?: boolean;
}

export function HudButton({
  className,
  disabled,
  onClick,
  size,
  sound = true,
  type = "button",
  variant,
  ...props
}: HudButtonProps) {
  const playClick = useUiClick();

  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    if (!disabled && sound) {
      playClick();
    }
    onClick?.(event);
  }

  return (
    <button
      {...props}
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={cn(hudButtonVariants({ variant, size }), className)}
    />
  );
}

export default HudButton;
