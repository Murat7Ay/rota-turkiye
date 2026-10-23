// Harita modülünü (MapLibre) yüklemeden gün renklerine erişmek için ayrı tutulur.
export const DAY_COLORS_CSS = ["#C2410C", "#0E7490", "#7C3AED", "#15803D", "#B45309", "#BE185D", "#1D4ED8"];
export const dayColorCss = (i: number) => DAY_COLORS_CSS[i % DAY_COLORS_CSS.length]!;
