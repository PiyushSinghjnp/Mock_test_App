const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { publicUser } = require('../server-postgres');

const projectRoot = path.resolve(__dirname, '..');

test('primary UI scripts use module loading and no javascript URLs remain', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');

  assert.doesNotMatch(html, /javascript:void\s*\(\s*0\s*\)/i);
  assert.match(html, /<script\s+type="module"[^>]+exam-patterns-2026\.js/);
  assert.match(html, /<script\s+type="module"[^>]+data\.js/);
  assert.match(html, /<script\s+type="module"[^>]+data-manager\.js/);
  assert.match(html, /<script\s+type="module"[^>]+app\.js/);
});

test('registration does not assign a single exam and exam categories remain switchable', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(projectRoot, 'js/app.js'), 'utf8');
  const dataManager = fs.readFileSync(path.join(projectRoot, 'js/data-manager.js'), 'utf8');
  const server = fs.readFileSync(path.join(projectRoot, 'server-postgres.js'), 'utf8');

  assert.doesNotMatch(html, /id="register-target-exam"|id="new-user-exam"/);
  assert.match(html, /id="exam-switcher-modal"/);
  assert.match(app, /selectExam\(examId\)/);
  assert.match(dataManager, /async register\(username, password, name\)/);
  assert.match(server, /WHERE \(\$1::text IS NULL OR \$1='all' OR t\.exam_id=\$1\)/);
  assert.doesNotMatch(server, /requireAssignedExam/);
});

test('public user serialization omits password, session, CSRF, and admin fields', () => {
  const candidate = publicUser({
    id: 'candidate-1',
    username: 'candidate',
    name: 'Synthetic Candidate',
    password_hash: 'must-not-leak',
    is_admin: true,
    session_hash: 'must-not-leak',
    csrf_hash: 'must-not-leak'
  });

  assert.deepEqual(candidate, {
    id: 'candidate-1',
    username: 'candidate',
    name: 'Synthetic Candidate'
  });
});
