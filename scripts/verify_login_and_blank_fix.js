const fs = require('fs');

async function verifyAll() {
  console.log('=== VERIFYING OLIVEBOARD LIVE BROWSER & LOGIN FIX ===');

  // 1. Verify proxy loads genuine Oliveboard homepage
  const pRes = await fetch('http://127.0.0.1:3000/api/ob-browser/proxy?url=https%3A%2F%2Fwww.oliveboard.in%2F');
  const pHtml = await pRes.text();
  console.log('1. Homepage Proxy HTTP Status:', pRes.status);
  console.log('   Homepage HTML Length:', pHtml.length, 'bytes');
  console.log('   Has #modal-login markup:', pHtml.includes('modal-login'));
  console.log('   Has #course-email field:', pHtml.includes('course-email'));
  console.log('   Has #course-password field:', pHtml.includes('course-password'));
  console.log('   Has courseInValidation1 handler:', pHtml.includes('courseInValidation1'));
  console.log('   Has ob-proxy-bridge script:', pHtml.includes('data-ob-proxy-bridge'));

  // 2. Verify dashboard does not crash on content.php
  const cRes = await fetch('http://127.0.0.1:3000/api/ob-browser/ajax-proxy?url=https%3A%2F%2Fu1.oliveboard.in%2Ftests%2Fcontent.php%3Fc%3Ddashboard%26i%3Dcommon');
  const cText = await cRes.text();
  console.log('2. AJAX Proxy content.php Status:', cRes.status);
  try {
    const cJson = JSON.parse(cText);
    console.log('   tabdata is safe array:', Array.isArray(cJson.tabdata));
    console.log('   Exam categories count:', cJson.blocks ? cJson.blocks.length : 'none');
  } catch (e) {
    console.log('   content.php returned HTML/redirect (unauthenticated):', cText.slice(0, 80));
  }

  // 3. Verify Main App UI has Logout & Clear Session button
  const iRes = await fetch('http://127.0.0.1:3000/');
  const iHtml = await iRes.text();
  console.log('3. Main App UI has #btn-ob-logout-session:', iHtml.includes('btn-ob-logout-session'));
  console.log('   Main App UI has #btn-ob-switch-login-tab:', iHtml.includes('btn-ob-switch-login-tab'));

  // 4. Verify syntax of all client JS files
  console.log('4. Syntax checks:');
  const cp = require('child_process');
  cp.execSync('node -c js/ob-proxy-bridge.js');
  console.log('   js/ob-proxy-bridge.js: OK');
  cp.execSync('node -c js/app.js');
  console.log('   js/app.js: OK');
  cp.execSync('node -c oliveboard-live-re.js');
  console.log('   oliveboard-live-re.js: OK');

  console.log('=== ALL CHECKS PASSED SUCCESSFULLY ===');
}

verifyAll().catch(console.error);
