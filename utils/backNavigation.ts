type NavigationState = {
  key?: string;
  type?: string;
  index?: number;
  history?: unknown[];
  routes: { key?: string; state?: NavigationState }[];
};

/** Target the innermost active navigator with history, before its parent. */
export function getBackTarget(state?: NavigationState): string | undefined {
  if (!state) return undefined;
  const child = state.routes[state.index ?? 0]?.state;
  const childTarget = getBackTarget(child);
  if (childTarget) return childTarget;
  if (state.type === 'stack' && (state.index ?? 0) > 0) return state.key;
  if (state.type === 'tab' && (state.history?.length ?? 0) > 1) return state.key;
  return undefined;
}
