import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { createDatabase } from '../src/config/database.js';
import { hashPassword } from '../src/modules/auth/passwords.js';

const database = createDatabase(process.env.DATABASE_URL);
try {
  // Initial passwords are random and discarded. Access is established through recovery.
  const passwords = await Promise.all([0, 1].map(() => hashPassword(randomBytes(32).toString('base64url'))));
  await database.$transaction(async tx => {
    await tx.company.upsert({
      where: { id: 'demo-cafeteria' }, update: {},
      create: { id: 'demo-cafeteria', name: 'Cafetería Semilla (ficticia)', description: 'Datos sintéticos para el primer bimestre.' },
    });
    for (const [index, role] of ['ADMIN', 'EMPLOYEE'].entries()) {
      const id = role === 'ADMIN' ? 'demo-admin' : 'demo-employee';
      await tx.user.upsert({ where: { id }, update: {}, create: {
        id, companyId: 'demo-cafeteria', role,
        name: role === 'ADMIN' ? 'Administración Semilla' : 'Equipo Semilla',
        email: role === 'ADMIN' ? 'admin@semilla.example' : 'equipo@semilla.example', passwordHash: passwords[index],
      } });
    }
    await tx.inventory.upsert({ where: { id: 'demo-inventory' }, update: {}, create: { id: 'demo-inventory', companyId: 'demo-cafeteria', name: 'Inventario principal' } });
    await tx.category.upsert({ where: { id: 'demo-category' }, update: {}, create: { id: 'demo-category', companyId: 'demo-cafeteria', name: 'Vegetales' } });
    const receivedDate = new Date();
    receivedDate.setUTCHours(0, 0, 0, 0);
    await tx.foodItem.upsert({ where: { id: 'demo-food' }, update: {}, create: {
      id: 'demo-food', companyId: 'demo-cafeteria', inventoryId: 'demo-inventory', categoryId: 'demo-category',
      name: 'Zanahoria', quantity: '2.500', unit: 'kg', minimumStock: '1.000', receivedDate,
      expiresDate: new Date(receivedDate.getTime() + 5 * 86400000),
    } });
    await tx.recipe.upsert({ where: { id: 'demo-recipe' }, update: {}, create: {
      id: 'demo-recipe', companyId: 'demo-cafeteria', name: 'Zanahoria al vapor',
      description: 'Receta ficticia para aprovechar vegetales frescos.', preparation: 'Lavar y cortar. Cocinar al vapor hasta que estén tiernas.',
    } });
    await tx.recipeIngredient.upsert({ where: { id: 'demo-ingredient' }, update: {}, create: {
      id: 'demo-ingredient', companyId: 'demo-cafeteria', recipeId: 'demo-recipe', name: 'Zanahoria', quantity: '0.500', unit: 'kg',
    } });
    await tx.chatRoom.upsert({ where: { id: 'demo-general' }, update: {}, create: { id: 'demo-general', companyId: 'demo-cafeteria', name: 'General' } });
    await tx.chatMessage.upsert({ where: { id: 'demo-message' }, update: {}, create: {
      id: 'demo-message', companyId: 'demo-cafeteria', roomId: 'demo-general', userId: 'demo-admin', content: 'Bienvenido al equipo de la Cafetería Semilla.',
    } });
  });
  console.log('Fictional company seed completed (idempotent; access through password recovery).');
} catch {
  console.error('Seed failed. Check database availability and applied migrations.');
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
