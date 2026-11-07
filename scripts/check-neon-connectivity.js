'use strict';

// Safe diagnostics only: never print connection strings, hostnames, error messages,
// query parameters, or credentials. Run from the project root with `npm run db:check`.
require('dotenv').config();
const { Pool } = require('pg');

async function check(label, connectionString) {
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000, query_timeout: 10_000, ssl: undefined });
  try {
    const result = await pool.query('SELECT 1 AS connected');
    return { endpoint: label, select1: result.rows[0]?.connected === 1 ? 'ok' : 'unexpected-result' };
  } catch (error) {
    return { endpoint: label, select1: 'failed', code: /^[A-Z0-9]+$/.test(error.code || '') ? error.code : 'connection-error' };
  } finally {
    await pool.end();
  }
}

async function main() {
  const pooled = process.env.DATABASE_URL;
  const direct = process.env.DATABASE_DIRECT_URL;
  const result = {
    loader: 'dotenv default project .env plus inherited environment',
    pooledConfigured: Boolean(pooled),
    directConfigured: Boolean(direct),
    pooledEndpoint: pooled ? (new URL(pooled).hostname.includes('-pooler.') ? 'pooled' : 'not-detected-as-pooled') : 'missing',
    directEndpoint: direct ? (!new URL(direct).hostname.includes('-pooler.') ? 'direct' : 'pooler-unexpected') : 'missing'
  };
  if (!pooled || !direct) {
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 2;
    return;
  }
  result.connectivity = [await check('pooled', pooled), await check('direct', direct)];
  console.log(JSON.stringify(result, null, 2));
  if (result.pooledEndpoint !== 'pooled' || result.directEndpoint !== 'direct' || result.connectivity.some(item => item.select1 !== 'ok')) process.exitCode = 1;
}

main().catch(() => {
  console.error('Neon connectivity diagnostic failed before connection checks. Inspect local environment variable format without printing values.');
  process.exitCode = 1;
});
