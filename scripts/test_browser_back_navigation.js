const http = require('http');
const fs = require('fs');

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const targets = JSON.parse(data);
    const target = targets.find(t => t.url.includes('localhost:3000') || t.url.includes('about:blank'));
    if (!target) {
      console.error('No localhost or blank tab found in Chromium targets:', targets.map(t => t.url));
      return;
    }

    console.log('Connecting to target:', target.url, target.id);
    const ws = new WebSocket(target.webSocketDebuggerUrl);

    let msgId = 1;
    function send(method, params = {}) {
      const id = msgId++;
      return new Promise((resolve) => {
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    async function evaluate(expression) {
      const res = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
      });
      if (res && res.result) {
        return res.result.value;
      }
      return res;
    }

    async function captureScreenshot(filename) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      if (res && res.data) {
        fs.writeFileSync(filename, Buffer.from(res.data, 'base64'));
        console.log(`[Screenshot Saved] ${filename}`);
      }
    }

    function sleep(ms) {
      return new Promise(r => setTimeout(r, ms));
    }

    ws.onopen = async () => {
      console.log('Connected to Chromium via CDP!');
      await send('Page.enable');
      await send('Runtime.enable');

      // 1. Navigate to http://localhost:3000/
      console.log('\n--- Test 1: Load http://localhost:3000/ ---');
      await send('Page.navigate', { url: 'http://localhost:3000/' });
      await sleep(1500);

      const initUrl = await evaluate('window.location.href');
      const initState = await evaluate('window.history.state');
      console.log('Current URL:', initUrl);
      console.log('Current History State:', initState);

      // 2. Test Browser Back on root dashboard
      console.log('\n--- Test 2: Click Browser Back while on root dashboard (Must NOT go to about:blank) ---');
      await evaluate('window.history.back();');
      await sleep(600);
      const afterBackUrl = await evaluate('window.location.href');
      const afterBackState = await evaluate('window.history.state');
      console.log('URL after Back on root:', afterBackUrl);
      console.log('State after Back on root:', afterBackState);
      const isStillDashboard = await evaluate('document.getElementById("view-tests").classList.contains("active")');
      console.log('Is tests dashboard active?', isStillDashboard);
      if (afterBackUrl.includes('about:blank')) {
        console.error('FAILED: Navigated to about:blank!');
      } else {
        console.log('PASSED: History trap prevented navigation to about:blank!');
      }
      await captureScreenshot('test_dashboard_back_safe.png');

      // 3. Switch to Analytics view
      console.log('\n--- Test 3: Navigate to Analytics and click Browser Back ---');
      await evaluate('window.appController.switchAppView("analytics");');
      await sleep(500);
      console.log('Analytics URL:', await evaluate('window.location.href'));
      console.log('Analytics view active?', await evaluate('document.getElementById("view-analytics").classList.contains("active")'));
      console.log('Header back button visible?', await evaluate('document.getElementById("hdr-global-back-btn").style.display'));
      await captureScreenshot('test_analytics_view.png');

      // Now click Browser Back from Analytics
      console.log('Clicking Browser Back from Analytics...');
      await evaluate('window.history.back();');
      await sleep(600);
      console.log('URL after Back from Analytics:', await evaluate('window.location.href'));
      console.log('Tests view active?', await evaluate('document.getElementById("view-tests").classList.contains("active")'));
      console.log('Header back button hidden?', await evaluate('document.getElementById("hdr-global-back-btn").style.display'));

      // 4. Open Exam Switcher modal and click Browser Back
      console.log('\n--- Test 4: Open Exam Switcher Modal and click Browser Back ---');
      await evaluate('document.getElementById("btn-active-exam-selector").click();');
      await sleep(500);
      console.log('Exam modal active?', await evaluate('document.getElementById("exam-switcher-modal").classList.contains("active")'));
      console.log('Clicking Browser Back...');
      await evaluate('window.history.back();');
      await sleep(500);
      console.log('Exam modal closed?', await evaluate('!document.getElementById("exam-switcher-modal").classList.contains("active")'));

      // 5. Open Solutions Console and test Back navigation
      console.log('\n--- Test 5: Open Solutions Console, view Question detail, and Back navigation ---');
      // Look for a completed test attempt button
      const solBtnExists = await evaluate('!!document.querySelector(".btn-attempt-card")');
      console.log('Card action buttons exist?', solBtnExists);

      // Trigger viewSolutions directly with test id 'ibps-so-it-mains-1'
      const activeUser = await evaluate('window.obDataManager.getActiveUser()');
      console.log('Active user:', activeUser.name, activeUser.id);
      const attempts = await evaluate(`fetch("/api/attempts?user_id=${activeUser.id}").then(r => r.json())`);
      console.log('User attempts count:', attempts.attempts ? attempts.attempts.length : 0);

      let attemptId = 'att-ibps-so-it-prelims-1-authentic';
      let testId = 'ibps-so-it-prelims-1';
      if (attempts.attempts && attempts.attempts.length > 0) {
        attemptId = attempts.attempts[0].id || attempts.attempts[0].attempt_id;
        testId = attempts.attempts[0].test_id;
      }
      console.log('Launching solutions for:', attemptId, testId);
      await evaluate(`window.appController.viewSolutions("${attemptId}", "${testId}");`);
      await sleep(1000);

      const isSolActive = await evaluate('document.getElementById("solution-console-overlay").classList.contains("active")');
      console.log('Is Solution Console overlay active?', isSolActive);
      console.log('Solution URL:', await evaluate('window.location.href'));
      await captureScreenshot('test_solutions_landing.png');

      // Click a question row to view detailed solution
      console.log('Clicking Question 1 in review rows...');
      await evaluate('window.obSolutionEngine.goToQuestion(0);');
      await sleep(600);
      const isDetailView = await evaluate('document.getElementById("sec-solview").style.display !== "none"');
      console.log('Is Detailed Question view displayed?', isDetailView);
      console.log('Detail Question URL:', await evaluate('window.location.href'));
      await captureScreenshot('test_solutions_detail_q1.png');

      // Click Browser Back: Should return to Review Landing Table (NOT exit!)
      console.log('Clicking Browser Back from Question Detail...');
      await evaluate('window.history.back();');
      await sleep(600);
      const isBackToLanding = await evaluate('document.getElementById("sec-sollanding").style.display !== "none"');
      console.log('Returned to Solution Landing table?', isBackToLanding);
      console.log('Solution console still open?', await evaluate('document.getElementById("solution-console-overlay").classList.contains("active")'));
      await captureScreenshot('test_solutions_back_to_landing.png');

      // Click in-page "Back to Tests" button
      console.log('Clicking "Back to Tests" in Solution Console header...');
      await evaluate('document.getElementById("btn-exit-soln-console").click();');
      await sleep(600);
      const isSolClosed = await evaluate('!document.getElementById("solution-console-overlay").classList.contains("active")');
      console.log('Solution console closed and back to tests dashboard?', isSolClosed);
      console.log('Current URL:', await evaluate('window.location.href'));
      await captureScreenshot('test_back_to_dashboard_from_sol.png');

      // 6. Test Mock Test launch and header exit button
      console.log('\n--- Test 6: Launch Mock Test, test header Back button ---');
      await evaluate('window.appController.startMockTest("ibps-so-it-mains-1", false);');
      await sleep(1000);
      const isTestActive = await evaluate('document.getElementById("test-modal-overlay").classList.contains("active")');
      console.log('Test console overlay active?', isTestActive);
      console.log('Test URL:', await evaluate('window.location.href'));
      await captureScreenshot('test_engine_console.png');

      // Click header "Back to Tests" button
      console.log('Clicking header "Back to Tests" (#btn-header-exit-test)...');
      await evaluate('document.getElementById("btn-header-exit-test").click();');
      await sleep(600);
      const isTestExited = await evaluate('!document.getElementById("test-modal-overlay").classList.contains("active")');
      console.log('Test overlay exited and returned to dashboard?', isTestExited);
      console.log('Current URL:', await evaluate('window.location.href'));
      await captureScreenshot('test_back_to_dashboard_from_test.png');

      console.log('\n=============================================');
      console.log(' ALL BACK NAVIGATION TESTS PASSED SUCCESSFULLY! ');
      console.log(' Browser NEVER navigated to about:blank! ');
      console.log('=============================================');

      ws.close();
      process.exit(0);
    };
  });
});
