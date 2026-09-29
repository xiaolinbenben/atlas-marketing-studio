import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';

const databaseUrl = process.env.DATABASE_URL || '';
const filename = databaseUrl.startsWith('file:') ? databaseUrl.slice(5).split('?')[0] : '';
if (!filename) process.exit(0);

const db = new DatabaseSync(filename);
try {
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name));
  if (tables.has('User') && !tables.has('_prisma_migrations')) {
    const result = spawnSync('node', ['./node_modules/prisma/build/index.js', 'migrate', 'resolve', '--applied', '0001_init'], {
      stdio: 'inherit',
      env: { ...process.env, RUST_LOG: process.env.RUST_LOG || 'info' },
    });
    if (result.status !== 0) process.exit(result.status || 1);
  }
} finally {
  db.close();
}
