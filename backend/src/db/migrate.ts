import fs from 'node:fs/promises';
import path from 'node:path';
import { pool, inTransaction } from './pool';

async function migrate() {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const dir = path.resolve(process.cwd(), 'migrations');
  const files = (await fs.readdir(dir)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of files) {
    const { rowCount } = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    if (rowCount) continue;
    const sql = await fs.readFile(path.join(dir, name), 'utf8');
    await inTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
    });
    process.stdout.write(`Applied ${name}\n`);
  }
}

migrate().then(() => pool.end()).catch(async (error) => { console.error(error); await pool.end(); process.exitCode = 1; });
