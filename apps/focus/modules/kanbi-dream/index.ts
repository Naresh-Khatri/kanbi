import { Platform } from "react-native";
import KanbiDreamModule from "./src/KanbiDreamModule";

const isAndroid = Platform.OS === "android";

/**
 * Tell the current Activity to remain visible over the keyguard. With
 * `android:showWhenLocked="true"` set on MainActivity by the config plugin,
 * this is mostly belt-and-suspenders for when the manifest flag is missing
 * (e.g. running in Expo Go-like contexts during development).
 */
export function setShowWhenLocked(value: boolean): void {
  if (!isAndroid) return;
  KanbiDreamModule.setShowWhenLocked(value);
}

/** Wake the screen the next time this Activity is brought forward. */
export function setTurnScreenOn(value: boolean): void {
  if (!isAndroid) return;
  KanbiDreamModule.setTurnScreenOn(value);
}

/** True if the device currently has a (possibly secure) lock screen up. */
export function isKeyguardLocked(): boolean {
  if (!isAndroid) return false;
  return KanbiDreamModule.isKeyguardLocked();
}

/**
 * Ask the system to dismiss the keyguard. On a secured device this prompts
 * the user for credentials; resolves with whether the dismissal succeeded.
 */
export async function dismissKeyguard(): Promise<boolean> {
  if (!isAndroid) return false;
  return KanbiDreamModule.dismissKeyguard();
}

export default {
  setShowWhenLocked,
  setTurnScreenOn,
  isKeyguardLocked,
  dismissKeyguard,
};
