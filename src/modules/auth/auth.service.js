import { createHash, randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from './passwords.js';
import { deliverResetMail } from './reset-mail.js';

export const hashToken = value => createHash('sha256').update(value).digest('hex');
export class AuthError extends Error {}
export function createAuthService(database, config, sendResetMail = deliverResetMail) {
  return {
    async register({ name, email, password, companyName }) {
      const passwordHash = await hashPassword(password);
      return database.$transaction(async tx => {
        const company = await tx.company.create({ data: {
          name: companyName,
          inventory: { create: { name: 'Inventario principal' } },
          rooms: { create: { name: 'General' } },
        } });
        return tx.user.create({ data: { name, email, passwordHash, companyId: company.id, role: 'ADMIN' } });
      });
    },
    async login({ email, password }) {
      const user = await database.user.findUnique({ where: { email } });
      const valid = await verifyPassword(user?.passwordHash, password);
      if (!user || !valid) throw new AuthError('El correo o la contraseña no son correctos.');
      return user;
    },
    async addEmployee(companyId, { name, email, password }) {
      return database.user.create({ data: { name, email, passwordHash: await hashPassword(password), companyId, role: 'EMPLOYEE' } });
    },
    async requestReset(email) {
      const user = await database.user.findUnique({ where: { email } });
      if (!user) return;
      const token = randomBytes(32).toString('hex');
      await database.passwordResetToken.upsert({
        where: { userId: user.id },
        create: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
        update: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000), consumedAt: null },
      });
      const link = new URL('/auth/reset', config.APP_ORIGIN);
      link.searchParams.set('token', token);
      await sendResetMail({ email, link: link.href });
    },
    async resetPassword({ token, password }) {
      const passwordHash = await hashPassword(password);
      await database.$transaction(async tx => {
        const where = { tokenHash: hashToken(token), consumedAt: null, expiresAt: { gt: new Date() } };
        const record = await tx.passwordResetToken.findFirst({ where });
        if (!record) throw new AuthError('El enlace no es válido o ha caducado.');
        // A conditional UPDATE locks the row: concurrent submissions cannot both consume it.
        const consumed = await tx.passwordResetToken.updateMany({ where, data: { consumedAt: new Date() } });
        if (consumed.count !== 1) throw new AuthError('El enlace no es válido o ha caducado.');
        await tx.user.update({ where: { id: record.userId }, data: { passwordHash, sessionVersion: { increment: 1 } } });
        await tx.session.deleteMany({ where: { userId: record.userId } });
      });
    },
  };
}
