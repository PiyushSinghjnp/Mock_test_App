const http = require('http');

function fetchUrl(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function verify() {
  console.log('--- Verifying Unaltered Test Content & Prevention of Duplication ---');

  // 1. Check Test 1 engine
  const t1 = await fetchUrl('/api/ob-browser/proxy?url=https%3A%2F%2Fu1.oliveboard.in%2Fexams%2Ftests%2Fpart.php%3Fc%3Dsbipopre19%26testid%3D1');
  console.log(`Test 1 status: ${t1.status}, length: ${t1.data.length}`);
  const hasDatasetInjection1 = t1.data.includes('__OB_FULL_DATASET__');
  const hasDecodeB64 = t1.data.includes('decodeB64');
  const hasQuestionOverwritingLoop = t1.data.includes('qBox.innerHTML = qData.questionHTML');
  console.log(`Test 1 has __OB_FULL_DATASET__: ${hasDatasetInjection1} (expected false)`);
  console.log(`Test 1 has decodeB64: ${hasDecodeB64} (expected false)`);
  console.log(`Test 1 has question overwriting loop: ${hasQuestionOverwritingLoop} (expected false)`);

  // 2. Check Test 2 engine
  const t2 = await fetchUrl('/api/ob-browser/proxy?url=https%3A%2F%2Fu1.oliveboard.in%2Fexams%2Ftests%2Fpart.php%3Fc%3Dsbipopre19%26testid%3D2');
  console.log(`Test 2 status: ${t2.status}, length: ${t2.data.length}`);
  const hasDatasetInjection2 = t2.data.includes('__OB_FULL_DATASET__');
  console.log(`Test 2 has __OB_FULL_DATASET__: ${hasDatasetInjection2} (expected false)`);

  // 3. Check Test 5 engine
  const t5 = await fetchUrl('/api/ob-browser/proxy?url=https%3A%2F%2Fu1.oliveboard.in%2Fexams%2Ftests%2Fpart.php%3Fc%3Dsbipopre19%26testid%3D5');
  console.log(`Test 5 status: ${t5.status}, length: ${t5.data.length}`);
  const hasDatasetInjection5 = t5.data.includes('__OB_FULL_DATASET__');
  console.log(`Test 5 has __OB_FULL_DATASET__: ${hasDatasetInjection5} (expected false)`);

  // 4. Check Solution App
  const sol = await fetchUrl('/api/ob-browser/proxy?url=https%3A%2F%2Fu1.oliveboard.in%2Fexams%2Fsolution%2Findex3.php%3Fc%3Dsbipopre19%26testid%3D1');
  console.log(`Solution App status: ${sol.status}, length: ${sol.data.length}`);
  const solHasDataset = sol.data.includes('__OB_FULL_DATASET__');
  const solHasDatasetOverwrite = sol.data.includes('dataset[idx]');
  console.log(`Solution App has __OB_FULL_DATASET__: ${solHasDataset} (expected false)`);
  console.log(`Solution App has dataset[idx] overwrite: ${solHasDatasetOverwrite} (expected false)`);

  if (!hasDatasetInjection1 && !hasDecodeB64 && !hasQuestionOverwritingLoop && !hasDatasetInjection2 && !hasDatasetInjection5 && !solHasDataset && !solHasDatasetOverwrite) {
    console.log('SUCCESS: All synthetic DOM alterations and cross-mock question copying have been completely removed!');
    process.exit(0);
  } else {
    console.error('FAILURE: Detected remaining synthetic DOM alterations or dataset injections!');
    process.exit(1);
  }
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
