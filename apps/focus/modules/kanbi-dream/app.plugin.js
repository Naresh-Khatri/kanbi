const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Forces MainActivity to show over the keyguard and turn the screen on
 * when launched. Combined with KanbiDream's runtime helpers and (in PR2)
 * a DreamService, this is what lets the app behave like an iPhone StandBy.
 */
const withKanbiDream = (config) => {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (!app?.activity) return config;

    const main = app.activity.find(
      (a) =>
        a.$["android:name"] === ".MainActivity" ||
        a.$["android:name"]?.endsWith(".MainActivity"),
    );
    if (!main) return config;

    main.$["android:showWhenLocked"] = "true";
    main.$["android:turnScreenOn"] = "true";

    return config;
  });
};

module.exports = withKanbiDream;
