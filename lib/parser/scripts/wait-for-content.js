(function waitForContent() {
  return new Promise(function (resolve) {
    var maxWait = 5000;
    var checkInterval = 200;
    var elapsed = 0;

    function checkContent() {
      // Check for JSON-LD (most reliable for recipe sites)
      var jsonLd = document.querySelector('script[type="application/ld+json"]');
      if (jsonLd && jsonLd.textContent && jsonLd.textContent.length > 50) {
        resolve(true);
        return;
      }

      // Check for microdata schema
      var schemaItem = document.querySelector('[itemtype*="schema.org"]');
      if (schemaItem && schemaItem.textContent && schemaItem.textContent.trim().length > 100) {
        resolve(true);
        return;
      }

      // Basic check: page has meaningful content loaded
      var main = document.querySelector("main, article, [role='main'], .content, #content");
      if (main && main.textContent && main.textContent.trim().length > 200) {
        resolve(true);
        return;
      }

      elapsed += checkInterval;
      if (elapsed >= maxWait) {
        resolve(false);
        return;
      }

      setTimeout(checkContent, checkInterval);
    }

    checkContent();
  });
})();
