import 'dotenv/config';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { cpus, totalmem } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { createDatabase } from '../src/config/database.js';
import { createInventoryRepository } from '../src/modules/inventory/inventory.repository.js';
import { businessToday, addDays } from '../src/modules/expiration/expiration.js';
import { isolatedDatabaseUrl } from './lib/test-database.js';

const database = createDatabase(isolatedDatabaseUrl());
const rows = 1000, samples = 30, warmup = 5;
const today = businessToday('America/Guayaquil');
let companyId;
try {
  const company = await database.company.create({ data: {
    name: `perf-${randomUUID()}`,
    inventory: { create: { name: 'Inventario ficticio de medición' } },
    categories: { create: { name: 'Categoría ficticia' } },
  }, include: { inventory: true, categories: true } });
  companyId = company.id;
  await database.foodItem.createMany({ data: Array.from({ length: rows }, (_, i) => ({
    companyId, inventoryId: company.inventory.id, categoryId: company.categories[0].id,
    name: `Alimento ${String(i).padStart(4, '0')}`, quantity: '2.125', minimumStock: '1', unit: 'kg',
    receivedDate: today, expiresDate: addDays(today, i % 30),
  })) });
  const repository = createInventoryRepository(database);
  const cases = [];
  for (const [name, filters, expected] of [
    ['page-1', { page: 1, q: '', status: '', categoryId: '' }, 1000],
    ['page-50', { page: 50, q: '', status: '', categoryId: '' }, 1000],
    ['substring-search', { page: 1, q: 'Alimento 00', status: '', categoryId: '' }, 100],
  ]) {
    const durations = [];
    for (let i = 0; i < warmup + samples; i++) {
      const start = performance.now();
      const result = await repository.list(companyId, filters, today);
      const elapsed = performance.now() - start;
      assert.equal(result.total, expected);
      assert.equal(result.items.length, 10);
      if (i >= warmup) durations.push(elapsed);
    }
    durations.sort((a, b) => a - b);
    const quantile = q => Number(durations[Math.ceil(q * durations.length) - 1].toFixed(3));
    cases.push({ name, samples, recordsReturned: 10, totalMatches: expected, minMs: quantile(1 / samples), p50Ms: quantile(0.5), p95Ms: quantile(0.95), maxMs: quantile(1) });
  }
  // Parameterized representative SQL for plan evidence; these are not asserted
  // to be Prisma's complete generated transaction (count + list + categories).
  const orderedPlan = await database.$queryRaw`EXPLAIN SELECT id FROM FoodItem WHERE companyId = ${companyId} ORDER BY expiresDate ASC, id ASC LIMIT 10`;
  const searchPlan = await database.$queryRaw`EXPLAIN SELECT id FROM FoodItem WHERE companyId = ${companyId} AND name LIKE ${'%Alimento 00%'} ORDER BY expiresDate ASC, id ASC LIMIT 10`;
  const version = await database.$queryRaw`SELECT VERSION() AS version`;
  const indexes = await database.$queryRaw`SHOW INDEX FROM FoodItem`;
  const report = {
    measuredAt: new Date().toISOString(), sourceRevision: process.env.VERIFICATION_REVISION || 'working-tree',
    environment: { node: process.version, mysql: version[0].version, cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryGiB: Number((totalmem() / 1024 ** 3).toFixed(2)) },
    methodology: { records: rows, samples, warmup, concurrency: 1, operation: 'Real inventory repository transaction: count + paginated list/category relation', includes: 'Node/Prisma/adapter/SQL round trip; warm database; no HTTP/browser/network proxy latency', timeZone: 'America/Guayaquil' },
    cases, representativePlans: { ordered: orderedPlan, substring: searchPlan },
    indexes: indexes.map(row => ({ name: row.Key_name, sequence: row.Seq_in_index, column: row.Column_name })),
    limitations: ['Local isolated MySQL, synthetic 1000-row company, serial warm queries; no production throughput claim.', 'Leading-wildcard substring search is not a B-tree prefix lookup; an available index does not prove every query uses it.', 'Plans describe representative parameterized SQL; latency measures the actual application repository.'],
  };
  await mkdir('work', { recursive: true });
  await writeFile('work/query-performance.json', JSON.stringify(report, (_, value) => typeof value === 'bigint' ? Number(value) : value, 2) + '\n');
  console.log(JSON.stringify({ result: 'PASS', records: rows, cases, report: 'work/query-performance.json' }));
} finally {
  if (companyId) {
    await database.foodItem.deleteMany({ where: { companyId } });
    await database.company.delete({ where: { id: companyId } });
  }
  await database.$disconnect();
}
