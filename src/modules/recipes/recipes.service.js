import { missingRecord, PAGE_SIZE } from '../business.js';
import { Prisma } from '../../generated/prisma/index.js';

// Retain the original case-insensitive name overlap as a suggestion, not a
// guarantee of stock sufficiency, unit conversion, food safety or nutrition.
export function ingredientMatches(ingredient, food) {
  const a = ingredient.trim().toLocaleLowerCase('es');
  const b = food.trim().toLocaleLowerCase('es');
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}
export function createRecipesService(database) {
  return {
    async list(companyId, page) {
      const [total, recipes] = await database.$transaction([
        database.recipe.count({ where: { companyId } }),
        database.recipe.findMany({ where: { companyId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      ]);
      return { total, recipes };
    },
    async detail(companyId, id, today) {
      const recipe = await database.recipe.findFirst({ where: { companyId, id }, include: { ingredients: { orderBy: [{ name: 'asc' }, { id: 'asc' }] } } });
      if (!recipe) throw missingRecord();
      const foods = await database.foodItem.findMany({ where: { companyId, quantity: { gt: 0 }, expiresDate: { gte: today } }, select: { name: true } });
      return { recipe, ingredients: recipe.ingredients.map(ingredient => ({ ...ingredient, available: foods.some(food => ingredientMatches(ingredient.name, food.name)) })) };
    },
    async suggested(companyId, soonFoods) {
      if (!soonFoods.length) return [];
      // Rank in SQL and fetch only the best two. LOCATE retains bidirectional
      // literal substring matching (including names containing % or _). Every
      // value is parameterized; neither table nor column names come from input.
      const overlaps = soonFoods.map(food => Prisma.sql`(LOCATE(LOWER(i.name), LOWER(${food.name})) > 0 OR LOCATE(LOWER(${food.name}), LOWER(i.name)) > 0)`);
      const ranked = await database.$queryRaw(Prisma.sql`
        SELECT r.id FROM Recipe r JOIN RecipeIngredient i ON i.recipeId = r.id AND i.companyId = r.companyId
        WHERE r.companyId = ${companyId} AND (${Prisma.join(overlaps, ' OR ')})
        GROUP BY r.id, r.name ORDER BY COUNT(DISTINCT i.id) DESC, r.name ASC, r.id ASC LIMIT 2
      `);
      const candidates = await database.recipe.findMany({ where: { companyId, id: { in: ranked.map(row => row.id) } }, include: { ingredients: { select: { name: true } } } });
      return ranked.map(row => candidates.find(recipe => recipe.id === row.id)).filter(Boolean).map(recipe => ({ ...recipe,
        matches: recipe.ingredients.filter(ingredient => soonFoods.some(food => ingredientMatches(ingredient.name, food.name))).map(ingredient => ingredient.name),
      })).filter(recipe => recipe.matches.length);
    },
  };
}
