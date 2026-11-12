import { createInventoryRepository } from './inventory.repository.js';
import { BusinessError, missingRecord } from '../business.js';

export function createInventoryService(database) {
  const repository = createInventoryRepository(database);
  async function find(companyId, id) {
    const item = await repository.find(companyId, id);
    if (!item) throw missingRecord();
    return item;
  }
  async function validateCategory(companyId, categoryId) {
    if (!await repository.category(companyId, categoryId)) throw new BusinessError('Selecciona una categoría de tu empresa.');
  }
  return {
    ...repository, find,
    async save(companyId, input, id = null) {
      if (id) await find(companyId, id);
      await validateCategory(companyId, input.categoryId);
      const { receivedDate, expiresDate, ...fields } = input;
      const data = { ...fields, receivedDate: new Date(`${receivedDate}T00:00:00.000Z`), expiresDate: new Date(`${expiresDate}T00:00:00.000Z`) };
      try {
        if (id) {
          const result = await repository.update(companyId, id, data);
          if (!result.count) throw missingRecord();
          return { id };
        }
        const inventory = await repository.inventory(companyId);
        if (!inventory) throw new BusinessError('Tu empresa aún no tiene un inventario.', 409);
        return await repository.create({ ...data, companyId, inventoryId: inventory.id });
      } catch (error) {
        if (['P2003', 'P2025'].includes(error.code)) throw new BusinessError('La categoría cambió. Recarga el formulario y selecciona una categoría disponible.', 409);
        throw error;
      }
    },
    async remove(companyId, id) {
      if (!(await repository.delete(companyId, id)).count) throw missingRecord();
    },
  };
}
