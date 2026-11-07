'use strict';

const { Pool } = require('pg');
const { AsyncLocalStorage } = require('node:async_hooks');
const { performance } = require('node:perf_hooks');

let pool;
const requestMetrics = new AsyncLocalStorage();

function trackQuery(original) {
  return function trackedQuery(...args) {
    const metrics = requestMetrics.getStore();
    if (!metrics) return original.apply(this, args);
    const started = performance.now();
    return Promise.resolve(original.apply(this, args)).finally(() => {
      metrics.queryCount++;
      metrics.queryMs += performance.now() - started;
    });
  };
}

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for PostgreSQL access');
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      query_timeout: 15_000,
      statement_timeout: 15_000,
      // pg verifies TLS certificates by default. Neon URLs negotiate TLS.
      ssl: process.env.PGSSLMODE === 'disable' ? false : undefined,
      allowExitOnIdle: true
    });
    pool.query = trackQuery(pool.query);
    pool.on('error', error => console.error('[postgres] idle client error:', error.message));
  }
  return pool;
}

async function query(text, values) {
  return getPool().query(text, values);
}

async function transaction(work) {
  const metrics = requestMetrics.getStore();
  const acquireStarted = performance.now();
  const client = await getPool().connect();
  if (metrics) metrics.poolWaitMs += performance.now() - acquireStarted;
  const originalQuery = client.query;
  client.query = trackQuery(originalQuery);
  const transactionStarted = performance.now();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rollbackError) {
      console.error('[postgres] rollback failed:', rollbackError.message);
    }
    throw error;
  } finally {
    if (metrics) metrics.transactionMs += performance.now() - transactionStarted;
    client.query = originalQuery;
    client.release();
  }
}

async function closePool() {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}

module.exports = { getPool, query, transaction, closePool, requestMetrics };
