/**
 * Legacy hook — the new OfficeCanvas handles all animation internally.
 * Kept as a stub so existing imports don't break.
 */

export function usePixelAgentAnimations() {
  return { agentPositions: new Map<string, { x: number; y: number; frame?: number }>() };
}

export const useAgentAnimations = usePixelAgentAnimations;
