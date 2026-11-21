/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "share",
  name: "NorishShare",
  displayName: config.name,
  bundleIdentifier: ".share",
  // The app's own minimum, so every phone that runs Norish can share to it.
  deploymentTarget: "16.4",
  // The App Group is also the keychain access group the session is read from.
  entitlements: {
    "com.apple.security.application-groups":
      config.ios.entitlements["com.apple.security.application-groups"],
  },
});
