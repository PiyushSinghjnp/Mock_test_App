
         var clevertap = {event:[], profile:[], account:[], onUserLogin:[], notifications:[], privacy:[]};
         clevertap.account.push({"id": "65R-6K5-785Z"});
         clevertap.privacy.push({optOut: false}); //set the flag to true, if the user of the device opts out of sharing their data
         clevertap.privacy.push({useIP: false}); //set the flag to true, if the user agrees to share their IP data
         (function () {
             var wzrk = document.createElement('script');
             wzrk.type = 'text/javascript';
             wzrk.async = true;
             wzrk.src = ('https:' == document.location.protocol ? 'https://d2r1yp2w7bby2u.cloudfront.net' : 'http://static.clevertap.com') + '/js/a.js';
             var s = document.getElementsByTagName('script')[0];
             s.parentNode.insertBefore(wzrk, s);
             })();
         