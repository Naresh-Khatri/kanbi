// Custom entry: register the DreamService root with AppRegistry, then
// hand off to expo-router so the normal Activity boot still works. Both
// components live in the same JS bundle, so the DreamService can mount
// "KanbiDream" without spinning up a second runtime.
import { AppRegistry } from "react-native";

import { DreamRoot } from "@/dream/dream-root";

AppRegistry.registerComponent("KanbiDream", () => DreamRoot);

require("expo-router/entry");
