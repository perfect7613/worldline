"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { HudButton } from "@/components/hud/HudButton";

interface Props {
  children: ReactNode;
}

interface State {
  message: string | null;
}

export class GameErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: Error): State {
    return { message: error.message || "The city view failed." };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Worldline city error", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.message) {
      return (
        <div className="game-fallback" role="alert">
          <p className="hud-label">City renderer</p>
          <p>
            The isometric world could not start. Phaser is set to AUTO and will
            use Canvas if WebGL is unavailable. Reload after enabling hardware
            acceleration, or hide panels and try again.
          </p>
          <p className="muted">{this.state.message}</p>
          <HudButton
            onClick={() => {
              this.setState({ message: null });
              window.location.reload();
            }}
          >
            Reload
          </HudButton>
        </div>
      );
    }
    return this.props.children;
  }
}
