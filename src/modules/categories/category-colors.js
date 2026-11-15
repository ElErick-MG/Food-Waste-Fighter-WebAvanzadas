// Palette for category shelves (front-end redesign). Colors are decoration only:
// the name always identifies the category, so color is never the sole signal.
export const CATEGORY_COLORS = ['#4A7FD6', '#2F9E5B', '#D2513F', '#E09B2D', '#8A6FC7', '#2BA3A3'];

/** Default color for the n-th category of a company (0-based), cycling the palette. */
export const defaultCategoryColor = index => CATEGORY_COLORS[Math.abs(index) % CATEGORY_COLORS.length];
