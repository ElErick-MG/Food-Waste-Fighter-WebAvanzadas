import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createDatabase, checkDatabase } from './config/database.js';
import { attachRealtime } from './modules/chat/chat.socket.js';

let database;
try {
  const config = parseEnv(process.env);
  database = createDatabase(config.DATABASE_URL);
  await checkDatabase(database);
  const app = createApp({ config, database, checkDatabase: () => checkDatabase(database) });
  const server = createServer(app);
  const realtime = attachRealtime(server, { app, database, config });
  server.on('error', async () => {
    console.error('HTTP server failed. Check HOST/PORT and port availability.');
    await database.$disconnect();
    process.exitCode = 1;
  });
  server.listen(config.PORT, config.HOST, () => {
    console.log(`Food Waste Fighter listening on ${config.HOST}:${config.PORT}`);
    console.log(`Public origin: ${new URL(config.APP_ORIGIN).origin}; trusted proxy: ${config.trustProxy === 1 ? 'enabled' : 'disabled'}`);
  });
  let stopping = false;
  function shutdown() {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10000).unref();
    realtime.close(async () => {
      await database.$disconnect();
      clearTimeout(timeout);
    });
    server.closeIdleConnections();
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch {
  console.error('Startup failed. Validate .env and MySQL availability; no HTTP listener started.');
  if (database) await database.$disconnect();
  process.exitCode = 1;
}
