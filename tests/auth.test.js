'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const testHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
}

test('hashPassword produces salted scrypt hash that verifies correctly', () => {
  const password = 'mySecretPassword!2026';
  const hashed = hashPassword(password);

  assert.ok(hashed.includes(':'));
  const [salt, hash] = hashed.split(':');
  assert.equal(salt.length, 32); // 16 bytes hex
  assert.equal(hash.length, 128); // 64 bytes hex

  assert.equal(verifyPassword(password, hashed), true);
  assert.equal(verifyPassword('wrongPassword', hashed), false);
  assert.equal(verifyPassword('', hashed), false);
});

test('hashPassword produces different salts for the same password', () => {
  const password = 'identicalPassword';
  const hash1 = hashPassword(password);
  const hash2 = hashPassword(password);

  assert.notEqual(hash1, hash2);
  assert.equal(verifyPassword(password, hash1), true);
  assert.equal(verifyPassword(password, hash2), true);
});

test('database users table supports password_hash column and login verification', () => {
  const testDb = new DatabaseSync(':memory:');
  testDb.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      avatar TEXT,
      roll_no TEXT,
      target_exam TEXT,
      password_hash TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const userPassword = 'password123';
  const hashed = hashPassword(userPassword);

  testDb.prepare(`
    INSERT INTO users (id, username, name, email, avatar, roll_no, target_exam, password_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('user-rahul', 'rahul', 'Rahul Sharma', 'rahul@oliveboard.test', 'R', 'OB-2026-9041', 'sbi-po', hashed, new Date().toISOString());

  // Test successful lookup & verification
  const candidate = testDb.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get('rahul');
  assert.ok(candidate);
  assert.equal(candidate.name, 'Rahul Sharma');
  assert.equal(verifyPassword(userPassword, candidate.password_hash), true);
  assert.equal(verifyPassword('incorrectPwd', candidate.password_hash), false);

  // Test user not found
  const notFound = testDb.prepare('SELECT * FROM users WHERE LOWER(username) = ?').get('nonexistent');
  assert.equal(notFound, undefined);
});

