
clevertap.onUserLogin.push({
    "Site": {
        "Email": "piyushjaunpuria007@gmail.com",
        "Phone": "+918303751454"
    }
});
var CookieDate = new Date;
CookieDate.setFullYear(CookieDate.getFullYear() +10);
document.cookie = 'obctapinfo3=1; expires=' + CookieDate.toUTCString() + ';domain=.oliveboard.in;path=/;';

clevertap.event.push("Exam Viewed", 
    {
        "Exam Category": "Bank Insurance", 
        "Exam Name": "SBI PO Prelims"
    });
