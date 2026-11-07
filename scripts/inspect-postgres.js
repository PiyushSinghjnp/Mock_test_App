'use strict';

// Read-only inventory of the configured Neon database; never prints connection
// strings or candidate data. Useful before a migration on an existing branch.
require('dotenv').config();
const { Pool } = require('pg');
const EXPECTED_TABLES = ['users', 'tests', 'test_attempts', 'paused_attempts', 'admin_audit_log', 'quiz_questions', 'candidate_quiz_history'];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing from the project environment.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000, query_timeout: 10_000, ssl: undefined });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      const tables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_type='BASE TABLE' ORDER BY table_name`);
      const tableNames = tables.rows.map(row => row.table_name);
      const counts = {};
      for (const table of EXPECTED_TABLES) {
        if (!tableNames.includes(table)) continue;
        counts[table] = Number((await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`)).rows[0].count);
      }
      const columns = await client.query(`SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema=current_schema() AND table_name = ANY($1::text[]) ORDER BY table_name, ordinal_position`, [EXPECTED_TABLES]);
      const migrations = tableNames.includes('schema_migrations')
        ? (await client.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(row => row.version)
        : [];
      await client.query('COMMIT');
      const summary = process.argv.includes('--summary');
      console.log(JSON.stringify({
        connection: 'ok',
        schema: 'current_schema',
        tables: tableNames,
        counts,
        migrations,
        ...(summary ? {} : { columns: columns.rows })
      }, null, 2));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  } finally { await pool.end(); }
}

main().catch(error => {
  const code = /^[A-Z0-9]+$/.test(error.code || '') ? error.code : 'inspection-error';
  console.error(`Read-only PostgreSQL inspection failed (${code}).`);
  process.exitCode = 1;
});
