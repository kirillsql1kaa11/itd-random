const PLAYER_ID_KEY = 'itd_player_id';

let memoryPlayerId = '';

export function getPlayerId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const saved = localStorage.getItem(PLAYER_ID_KEY);
    if (saved) return saved;
    const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(PLAYER_ID_KEY, generated);
    return generated;
  } catch {
    if (!memoryPlayerId) {
      memoryPlayerId = `p_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }
    return memoryPlayerId;
  }
}
