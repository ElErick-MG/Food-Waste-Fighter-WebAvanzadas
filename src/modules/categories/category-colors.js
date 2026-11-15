// Palette for category shelves (front-end redesign). Colors are decoration only:
// the name always identifies the category, so color is never the sole signal.
export const CATEGORY_PALETTE = [
  { hex: '#4A7FD6', name: 'Azul' },
  { hex: '#2F9E5B', name: 'Verde' },
  { hex: '#D2513F', name: 'Rojo' },
  { hex: '#E09B2D', name: 'Ámbar' },
  { hex: '#8A6FC7', name: 'Violeta' },
  { hex: '#2BA3A3', name: 'Turquesa' },
];
export const CATEGORY_COLORS = CATEGORY_PALETTE.map(color => color.hex);

/** Default color for the n-th category of a company (0-based), cycling the palette. */
export const defaultCategoryColor = index => CATEGORY_COLORS[Math.abs(index) % CATEGORY_COLORS.length];
