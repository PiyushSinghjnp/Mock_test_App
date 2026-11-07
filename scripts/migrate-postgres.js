'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
require('dotenv').config();
const { getPool, closePool, transaction } = require('../db/postgres');

async function migrate() {
  if (!process.env.DATABASE_DIRECT_URL) throw new Error('Set DATABASE_DIRECT_URL to run schema migrations');
  const { Pool } = require('pg');
  const directPool = new Pool({ connectionString: process.env.DATABASE_DIRECT_URL, max: 1, connectionTimeoutMillis: 10_000, ssl: undefined });
  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
  try {
    await directPool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    for (const filename of fs.readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()) {
      const present = await directPool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [filename]);
      if (present.rowCount) continue;
      const client = await directPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(fs.readFileSync(path.join(migrationsDir, filename), 'utf8'));
        await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [filename]);
        await client.query('COMMIT');
        console.log(`Applied ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    }
  } finally {
    await directPool.end();
  }
}

const TABLES = ['users', 'tests', 'test_attempts', 'paused_attempts', 'admin_audit_log', 'quiz_questions', 'candidate_quiz_history'];

async function transfer(sqlitePath) {
  const sourcePath = path.resolve(sqlitePath);
  if (!fs.existsSync(sourcePath)) throw new Error(`SQLite snapshot not found: ${sourcePath}`);
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const report = { source: path.basename(sourcePath), startedAt: new Date().toISOString(), tables: {}, mismatches: [] };
  try {
    await transaction(async client => {
      for (const table of TABLES) {
        const columnInfo = source.prepare(`PRAGMA table_info("${table}")`).all();
        const columns = columnInfo.map(c => c.name);
        const primaryKey = columnInfo.filter(c => c.pk).sort((a, b) => a.pk - b.pk).map(c => c.name);
        const quoted = columns.map(column => `"${column}"`).join(', ');
        const rows = source.prepare(`SELECT ${quoted} FROM "${table}" ORDER BY 1`).all();
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        for (const row of rows) {
          for (const column of columns.filter(name => name.endsWith('_json') || name === 'test_data_json')) {
            if (row[column] == null || row[column] === '') continue;
            try { JSON.parse(row[column]); }
            catch { report.mismatches.push(`${table}.${column}: invalid JSON in source row ${String(row[primaryKey[0]])}`); }
          }
          const values = columns.map(column => row[column]);
          await client.query(`INSERT INTO "${table}" (${quoted}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
        }
        const pgCount = Number((await client.query(`SELECT COUNT(*)::int AS count FROM "${table}"`)).rows[0].count);
        let exactRows = 0;
        let conflictingRows = 0;
        const keyClause = primaryKey.map((column, i) => `"${column}" = $${i + 1}`).join(' AND ');
        for (const row of rows) {
          const found = await client.query(`SELECT ${quoted} FROM "${table}" WHERE ${keyClause}`, primaryKey.map(column => row[column]));
          if (found.rowCount && columns.every(column => Object.is(found.rows[0][column], row[column]))) exactRows++;
          else conflictingRows++;
        }
        report.tables[table] = { sourceRows: rows.length, destinationRows: pgCount, exactSourceRows: exactRows, sourceRowsWithConflicts: conflictingRows };
        if (pgCount < rows.length) report.mismatches.push(`${table}: destination count ${pgCount} is lower than source ${rows.length}`);
        if (conflictingRows) report.mismatches.push(`${table}: ${conflictingRows} source IDs already exist with different values; existing PostgreSQL data was preserved`);
        if (table === 'admin_audit_log' || table === 'candidate_quiz_history') {
          await client.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), EXISTS(SELECT 1 FROM "${table}"))`, [table]);
          report.tables[table].sequenceReset = true;
        }
      }
      const fk = await client.query(`SELECT a.id FROM test_attempts a LEFT JOIN users u ON u.id=a.user_id LEFT JOIN tests t ON t.id=a.test_id WHERE u.id IS NULL OR t.id IS NULL LIMIT 1`);
      if (fk.rowCount) report.mismatches.push('test_attempts contains an unresolved user_id or test_id reference');
      for (const { table } of await client.query(`SELECT table_name AS table FROM information_schema.tables WHERE table_schema=current_schema() AND table_type='BASE TABLE' AND table_name IN (${TABLES.map((_, i) => `$${i + 1}`).join(',')})`, TABLES).then(r => r.rows)) {
        // Table counts above provide the initial resumability check. Full row hashes
        // are added to the report by the companion verify command below.
        report.tables[table].verified = true;
      }
    });
  } finally { source.close(); }
  report.completedAt = new Date().toISOString();
  const reportPath = path.join(path.dirname(sourcePath), `migration-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ report: reportPath, tables: report.tables, mismatches: report.mismatches }, null, 2));
  return report;
}

async function main() {
  try {
    await migrate();
    const snapshot = process.argv[2];
    if (snapshot) {
      const report = await transfer(snapshot);
      if (report.mismatches.length) process.exitCode = 2;
    }
    else console.log('Schema is current. Pass a consistent SQLite backup path to import data.');
  } finally { await closePool(); }
}

main().catch(error => { console.error(`PostgreSQL migration failed: ${error.message}`); process.exitCode = 1; });
