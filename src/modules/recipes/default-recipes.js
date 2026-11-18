import { createHash } from 'node:crypto';

const recipes = [
  {
    key: 'arroz-salteado',
    name: 'Arroz salteado con verduras',
    description: 'Una forma de aprovechar arroz cocido y verduras del inventario.',
    preparation: 'Corta la zanahoria y la cebolla en cubos pequeños.\nSaltea las verduras en aceite hasta que estén tiernas.\nAgrega el arroz cocido y mezcla hasta calentarlo por completo.',
    ingredients: [
      { name: 'Arroz cocido', quantity: '0.400', unit: 'kg' },
      { name: 'Zanahoria', quantity: '0.150', unit: 'kg' },
      { name: 'Cebolla', quantity: '0.080', unit: 'kg' },
      { name: 'Aceite', quantity: '20', unit: 'ml' },
    ],
  },
  {
    key: 'crema-zanahoria',
    name: 'Crema de zanahoria',
    description: 'Sopa de zanahoria y papa para aprovechar verduras disponibles.',
    preparation: 'Lava y corta la zanahoria y la papa.\nCocina ambas en el caldo hasta que estén tiernas.\nTritura hasta obtener una crema y sirve caliente.',
    ingredients: [
      { name: 'Zanahoria', quantity: '0.500', unit: 'kg' },
      { name: 'Papa', quantity: '0.200', unit: 'kg' },
      { name: 'Caldo de verduras', quantity: '0.750', unit: 'l' },
    ],
  },
  {
    key: 'ensalada-garbanzos',
    name: 'Ensalada de garbanzos y tomate',
    description: 'Ensalada fría para aprovechar garbanzos cocidos y tomates.',
    preparation: 'Escurre los garbanzos cocidos.\nLava y corta el tomate y el pepino.\nMezcla los ingredientes y aliña con jugo de limón.',
    ingredients: [
      { name: 'Garbanzo cocido', quantity: '0.400', unit: 'kg' },
      { name: 'Tomate', quantity: '0.250', unit: 'kg' },
      { name: 'Pepino', quantity: '0.150', unit: 'kg' },
      { name: 'Limón', quantity: '1', unit: 'unidad' },
    ],
  },
  {
    key: 'tortilla-papa',
    name: 'Tortilla de papa y cebolla',
    description: 'Tortilla de sartén para aprovechar papas, cebolla y huevos.',
    preparation: 'Corta la papa y la cebolla en láminas finas.\nCocínalas en aceite hasta que estén tiernas y mézclalas con los huevos batidos.\nVierte la mezcla en la sartén y cocina por ambos lados hasta que el huevo esté completamente cuajado.',
    ingredients: [
      { name: 'Papa', quantity: '0.400', unit: 'kg' },
      { name: 'Cebolla', quantity: '0.100', unit: 'kg' },
      { name: 'Huevo', quantity: '4', unit: 'unidad' },
      { name: 'Aceite', quantity: '30', unit: 'ml' },
    ],
  },
  {
    key: 'pasta-tomate',
    name: 'Pasta con tomate y albahaca',
    description: 'Pasta con una salsa sencilla de tomate fresco.',
    preparation: 'Hierve la pasta según las instrucciones del empaque.\nSofríe el ajo, agrega el tomate picado y cocina hasta que espese.\nMezcla la pasta con la salsa y añade la albahaca picada.',
    ingredients: [
      { name: 'Pasta', quantity: '0.250', unit: 'kg' },
      { name: 'Tomate', quantity: '0.400', unit: 'kg' },
      { name: 'Ajo', quantity: '10', unit: 'g' },
      { name: 'Albahaca', quantity: '10', unit: 'g' },
      { name: 'Aceite', quantity: '15', unit: 'ml' },
    ],
  },
  {
    key: 'batido-banano',
    name: 'Batido de banano y yogur',
    description: 'Batido frío para aprovechar bananos maduros y yogur.',
    preparation: 'Pela los bananos y córtalos en trozos.\nLicúa con el yogur y la leche hasta que quede cremoso.\nSirve de inmediato.',
    ingredients: [
      { name: 'Banano', quantity: '2', unit: 'unidad' },
      { name: 'Yogur', quantity: '0.200', unit: 'kg' },
      { name: 'Leche', quantity: '150', unit: 'ml' },
    ],
  },
];

export async function loadDefaultRecipes(tx, companyId) {
  for (const { key, ingredients, ...recipe } of recipes) {
    // Stable IDs keep repeated loads idempotent and scope each copy to its company.
    const id = createHash('sha256').update(`default-recipe:${companyId}:${key}`).digest('hex').slice(0, 30);
    await tx.recipe.upsert({
      where: { id_companyId: { id, companyId } },
      update: {},
      create: { id, companyId, ...recipe, ingredients: { create: ingredients } },
    });
  }
}
