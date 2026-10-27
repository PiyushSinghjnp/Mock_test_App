async function test() {
  const exams = [
    { code: 'rbigradeb', name: 'RBI Grade B Phase 1' },
    { code: 'sbiclerkpre2020', name: 'SBI Clerk Prelims' },
    { code: 'ssccgl', name: 'SSC CGL Tier 1' },
    { code: 'ibpsprelim', name: 'IBPS PO Prelims' },
    { code: 'rrbntpc', name: 'RRB NTPC CBT 1' },
    { code: 'licap', name: 'LIC AAO Prelims' },
    { code: 'epfsp', name: 'EPFO SSA' }
  ];

  for (const ex of exams) {
    const dashRes = await fetch(`http://localhost:3000/api/ob-browser/proxy?url=https%3A%2F%2Fu1.oliveboard.in%2Ftests%2F%3Fc%3D${encodeURIComponent(ex.code)}%26i%3Dbanking`);
    const dashHtml = await dashRes.text();
    const titleMatch = (dashHtml.match(/<title>([^<]+)<\/title>/i) || [])[1];
    const catLabelMatch = (dashHtml.match(/<span class="exam-category-current-label">([^<]+)<\/span>/i) || [])[1];
    const sbiPoFound = /SBI PO 2026 Prelims Mock Tests/i.test(dashHtml);

    const testRes = await fetch(`http://localhost:3000/api/ob-browser/proxy?url=https%3A%2F%2Fu1.oliveboard.in%2Fexams%2Ftests%2Fpart.php%3Fc%3D${encodeURIComponent(ex.code)}%26testid%3D1`);
    const testHtml = await testRes.text();
    const testTitle = (testHtml.match(/<title>([^<]+)<\/title>/i) || [])[1];
    const h2Title = (testHtml.match(/<div class="main-title-container"><h2>([^<]+)<\/h2>/i) || [])[1];

    console.log(`[PASS] ${ex.code.padEnd(16)} -> Dash Title: "${titleMatch}" | Label: "${catLabelMatch}" | Test H2: "${h2Title}" | SBI PO Leaked: ${sbiPoFound}`);
  }
}
test().catch(console.error);
