
document.addEventListener("DOMContentLoaded", function() {
  document.querySelectorAll("img").forEach(function(img) {
    img.setAttribute("data-no-lens", "true");
    img.setAttribute("referrerpolicy", "no-referrer"); // prevents referrer leaking to Google     
  });
});
