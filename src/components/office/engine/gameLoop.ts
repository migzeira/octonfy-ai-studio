/**
 * gameLoop.ts — Adapted from pablodelucca/pixel-agents
 * Minimal requestAnimationFrame game loop with capped delta time.
 */

const MAX_DT = 0.1; // cap at 100ms to avoid huge jumps on tab switch

export interface GameLoopCallbacks {
  update: (dt: number) => void;
  render: (ctx: CanvasRenderingContext2D) => void;
}

/**
 * Starts the game loop on a canvas element.
 * Returns a cleanup function that stops the loop.
 */
export function startGameLoop(
  canvas: HTMLCanvasElement,
  callbacks: GameLoopCallbacks,
): () => void {
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  let lastTime = 0;
  let rafId = 0;
  let stopped = false;

  const frame = (time: number) => {
    if (stopped) return;
    const dt =
      lastTime === 0 ? 0 : Math.min((time - lastTime) / 1000, MAX_DT);
    lastTime = time;

    callbacks.update(dt);

    ctx.imageSmoothingEnabled = false;
    callbacks.render(ctx);

    rafId = requestAnimationFrame(frame);
  };

  rafId = requestAnimationFrame(frame);

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
  };
}
