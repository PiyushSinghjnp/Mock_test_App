const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');

test('primary UI scripts use module loading and no javascript URLs remain', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');

  assert.doesNotMatch(html, /javascript:void\s*\(\s*0\s*\)/i);
  assert.match(html, /<script\s+type="module"[^>]+exam-patterns-2026\.js/);
  assert.match(html, /<script\s+type="module"[^>]+data\.js/);
  assert.match(html, /<script\s+type="module"[^>]+data-manager\.js/);
  assert.match(html, /<script\s+type="module"[^>]+app\.js/);
});

test('users API never exposes password hashes', async (t) => {
  const port = String(32000 + (process.pid % 1000));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: port, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => child.kill());

  let output = '';
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server did not start. Output: ${output}`)), 15000);
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      if (output.includes(`running at http://0.0.0.0:${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('exit', code => {
      if (code && !output.includes(`running at http://0.0.0.0:${port}`)) {
        clearTimeout(timeout);
        reject(new Error(`Server exited with ${code}. Output: ${output}`));
      }
    });
  });

  await ready;
  const response = await fetch(`http://127.0.0.1:${port}/api/users`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.ok(Array.isArray(payload.users));
  for (const user of payload.users) {
    assert.equal(Object.prototype.hasOwnProperty.call(user, 'password_hash'), false);
  }

  const testResponse = await fetch(`http://127.0.0.1:${port}/api/tests/sbi-po-pre-01`);
  assert.equal(testResponse.status, 200);
  const testPayload = await testResponse.json();
  const questions = (testPayload.test.sections || []).flatMap(section => section.questions || []);
  assert.equal(questions.length, 100);
  const renderedText = questions
    .flatMap(question => [question.questionHTML, question.explanationHTML, ...(question.options || []).map(option => option.text)])
    .join(' ');
  assert.doesNotMatch(renderedText, /�|ï¿½|N742XWIE4QW5IEIUGM2RETLD0IDYFOB4/);
  assert.doesNotMatch(renderedText, /[\x00-\x08\x0B\x0C\x0E-\x1F]/);
});
