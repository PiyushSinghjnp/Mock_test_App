#!/usr/bin/env node
'use strict';

// Consistent SQLite snapshot using SQLite's online backup API (includes committed
// WAL contents). The source database and its WAL/SHM files are never modified.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync, backup } = require('node:sqlite');

async function main() {
  const root = path.resolve(__dirname, '..');
  const source = path.resolve(process.argv[2] || path.join(root, 'database.sqlite'));
  const destDir = path.resolve(process.argv[3] || path.join(root, 'backups'));
  if (!fs.existsSync(source)) throw new Error(`SQLite source not found: ${source}`);
  fs.mkdirSync(destDir, { recursive: true });
  const destination = path.join(destDir, `database-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(db, destination);
  } finally {
    db.close();
  }
  const snapshot = new DatabaseSync(destination, { readOnly: true });
  try {
    const integrity = snapshot.prepare('PRAGMA integrity_check').all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
      throw new Error(`Backup integrity check failed: ${JSON.stringify(integrity)}`);
    }
    const tables = snapshot.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    const indexes = snapshot.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name").all();
    const inventory = {
      createdAt: new Date().toISOString(),
      source: path.basename(source),
      backup: path.basename(destination),
      integrity: 'ok',
      tables: tables.map(({ name, sql }) => ({
        name,
        sql,
        columns: snapshot.prepare(`PRAGMA table_info("${name.replace(/"/g, '""')}")`).all(),
        foreignKeys: snapshot.prepare(`PRAGMA foreign_key_list("${name.replace(/"/g, '""')}")`).all(),
        rowCount: snapshot.prepare(`SELECT COUNT(*) AS count FROM "${name.replace(/"/g, '""')}"`).get().count
      })),
      indexes,
      sqliteSequences: snapshot.prepare('SELECT name, seq FROM sqlite_sequence ORDER BY name').all(),
      // Record which accounts exist without disclosing credential material.
      candidates: snapshot.prepare('SELECT id, username, name, target_exam, CASE WHEN password_hash IS NULL OR password_hash = \'\' THEN 0 ELSE 1 END AS has_password FROM users ORDER BY id').all()
    };
    const inventoryPath = destination.replace(/\.sqlite$/, '.inventory.json');
    fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify({ backup: destination, inventory: inventoryPath, integrity: 'ok', tables: inventory.tables.map(({ name, rowCount }) => ({ name, rowCount })) }, null, 2));
  } finally {
    snapshot.close();
  }
}

main().catch(error => {
  console.error(`SQLite backup failed: ${error.message}`);
  process.exitCode = 1;
});
