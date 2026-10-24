const fs = require('fs');
const path = require('path');
const https = require('https');

const imgDir = path.join(__dirname, '..', 'img');
if (!fs.existsSync(imgDir)) {
  fs.mkdirSync(imgDir, { recursive: true });
}
const logoDir = path.join(imgDir, 'logo');
if (!fs.existsSync(logoDir)) {
  fs.mkdirSync(logoDir, { recursive: true });
}

const assets = [
  'duration.svg',
  'mentorship.svg',
  'expert.svg',
  'calendar.svg',
  'videos.svg',
  'Tests.svg',
  'numq.svg',
  'rightarr.svg',
  'lf-arr.svg',
  'brief24.svg',
  'ic-search2.svg',
  'courses.svg',
  'marks.svg',
  'logout.svg',
  'playoutline.svg',
  'gk.svg',
  'ic-search.svg',
  'bm24.svg',
  'red-wallet.svg',
  'bm.svg',
  'ic-carlf.svg',
  'social.svg',
  'backbutton.svg',
  'brief.svg',
  'cls.svg',
  'Tests_active.svg',
  'ic-carrt.svg',
  'lockoutline.svg',
  'red-rightarr.svg',
  'ic-report.svg',
  'newlogout.svg',
  'ic-moveup.svg',
  'hd-clock.svg',
  'dw-arr.svg',
  '003_banker.svg',
  'resourcelist.svg',
  'dashboard.svg',
  'logo/tlogo-28.png'
];

async function download(file) {
  return new Promise((resolve) => {
    const dest = path.join(imgDir, file);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      return resolve(true);
    }
    const url = `https://u1.oliveboard.in/tests/img/${file}`;
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }, (res) => {
      if (res.statusCode !== 200) {
        console.log(`Failed ${file}: HTTP ${res.statusCode}`);
        return resolve(false);
      }
      const fileStream = fs.createWriteStream(dest);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Downloaded: ${file}`);
        resolve(true);
      });
    }).on('error', (err) => {
      console.log(`Error ${file}: ${err.message}`);
      resolve(false);
    });
  });
}

(async () => {
  for (const asset of assets) {
    await download(asset);
  }
  console.log('All downloads completed!');
})();
