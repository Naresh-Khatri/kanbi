import { requireNativeModule } from "expo";

interface KanbiDreamNativeModule {
  setShowWhenLocked(value: boolean): void;
  setTurnScreenOn(value: boolean): void;
  isKeyguardLocked(): boolean;
  dismissKeyguard(): Promise<boolean>;
}

export default requireNativeModule<KanbiDreamNativeModule>("KanbiDream");
