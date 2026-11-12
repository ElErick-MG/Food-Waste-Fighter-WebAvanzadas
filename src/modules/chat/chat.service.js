import { z } from 'zod';
import { identifier, missingRecord } from '../business.js';

export const messageSchema = z.strictObject({
  roomId: identifier,
  content: z.string().trim().min(1).max(2000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)),
});
export const historySchema = z.strictObject({ roomId: identifier, before: identifier.optional() });
const select = { id: true, roomId: true, content: true, createdAt: true, sender: { select: { id: true, name: true } } };
export const publicMessage = row => ({ ...row, createdAt: row.createdAt.toISOString() });
export function createChatService(database) {
  async function general(companyId) {
    const room = await database.chatRoom.findUnique({ where: { companyId_name: { companyId, name: 'General' } }, select: { id: true, name: true } });
    if (!room) throw missingRecord();
    return room;
  }
  async function authorize(companyId, roomId) {
    const room = await general(companyId);
    if (room.id !== roomId) throw missingRecord();
    return room;
  }
  return {
    general,
    async history(companyId, { roomId, before }) {
      await authorize(companyId, roomId);
      const where = { companyId, roomId };
      if (before) {
        const cursor = await database.chatMessage.findFirst({ where: { ...where, id: before }, select: { createdAt: true, id: true } });
        if (!cursor) throw missingRecord();
        where.OR = [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }];
      }
      const rows = await database.chatMessage.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 51, select });
      return { messages: rows.slice(0, 50).reverse().map(publicMessage), hasMore: rows.length > 50 };
    },
    async send(user, { roomId, content }) {
      await authorize(user.companyId, roomId);
      return publicMessage(await database.chatMessage.create({ data: { companyId: user.companyId, userId: user.id, roomId, content }, select }));
    },
  };
}
