const { withAndroidManifest } = require("expo/config-plugins");

const SERVICE_NAME = "com.kanbi.focus.dream.KanbiDreamService";
const META_NAME = "android.service.dream";
const META_RESOURCE = "@xml/kanbi_dream_info";
const PERMISSION = "android.permission.BIND_DREAM_SERVICE";
const ACTION = "android.service.dreams.DreamService";
const CATEGORY = "android.intent.category.DEFAULT";

/**
 * Forces MainActivity to show over the keyguard + turn the screen on, and
 * registers KanbiDreamService so the OS can pick it as a screen-saver
 * (Settings → Display → Screen saver). Combined with the runtime helpers,
 * this is what lets the app behave like an iPhone StandBy.
 */
const withKanbiDream = (config) => {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (!app) return config;

    if (Array.isArray(app.activity)) {
      const main = app.activity.find(
        (a) =>
          a.$["android:name"] === ".MainActivity" ||
          a.$["android:name"]?.endsWith(".MainActivity"),
      );
      if (main) {
        main.$["android:showWhenLocked"] = "true";
        main.$["android:turnScreenOn"] = "true";
      }
    }

    app.service = app.service ?? [];
    const exists = app.service.find((s) => s.$["android:name"] === SERVICE_NAME);
    if (!exists) {
      app.service.push({
        $: {
          "android:name": SERVICE_NAME,
          "android:exported": "true",
          "android:permission": PERMISSION,
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": ACTION } }],
            category: [{ $: { "android:name": CATEGORY } }],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": META_NAME,
              "android:resource": META_RESOURCE,
            },
          },
        ],
      });
    }

    return config;
  });
};

module.exports = withKanbiDream;
