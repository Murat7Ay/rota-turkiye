// Kısa dokunsal geri bildirim (Android Chrome). iOS Safari desteklemez; sessizce geçilir.
export function haptic(pattern: number | number[] = 12) {
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate?.(pattern);
  } catch {
    /* desteklenmiyor */
  }
}
