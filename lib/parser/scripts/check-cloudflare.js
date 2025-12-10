(function checkCloudflareChallenge() {
  return (
    document.title.includes("Just a moment") ||
    (document.body && document.body.textContent && document.body.textContent.includes("Checking your browser")) ||
    document.querySelector("#challenge-running") !== null
  );
})();
