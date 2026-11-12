import { PAGE_SIZE } from '../business.js';
import { expirationWhere } from '../expiration/expiration.js';

export function createInventoryRepository(database) {
  const food = database.foodItem;
  return {
    categories: companyId => database.category.findMany({ where: { companyId }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    category: (companyId, id) => database.category.findFirst({ where: { companyId, id } }),
    inventory: companyId => database.inventory.findUnique({ where: { companyId } }),
    find: (companyId, id) => food.findFirst({ where: { companyId, id }, include: { category: true } }),
    async list(companyId, filters, today) {
      const where = {
        companyId, ...expirationWhere(filters.status, today),
        ...(filters.q && { OR: [{ name: { contains: filters.q } }, { category: { name: { contains: filters.q } } }] }),
        ...(filters.categoryId && { categoryId: filters.categoryId }),
        ...(filters.status === 'low' && { quantity: { lte: food.fields.minimumStock } }),
      };
      const [total, items] = await database.$transaction([
        food.count({ where }),
        food.findMany({ where, skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { category: true }, orderBy: [{ expiresDate: 'asc' }, { id: 'asc' }] }),
      ]);
      return { total, items };
    },
    create: data => food.create({ data }),
    update: (companyId, id, data) => food.updateMany({ where: { companyId, id }, data }),
    delete: (companyId, id) => food.deleteMany({ where: { companyId, id } }),
  };
}
