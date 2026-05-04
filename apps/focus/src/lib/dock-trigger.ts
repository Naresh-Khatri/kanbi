import { useEffect, useState } from "react";
import * as Battery from "expo-battery";

/**
 * Watches battery state to detect when the phone is plugged in, which we use
 * as the "is docked" signal. The lock-screen + landscape orientation parts
 * are handled by Expo's launch config (`orientation: "landscape"`) and by
 * keep-awake; we just need to know if the user is actively charging so we
 * can ramp polling/keep-awake up or down.
 */
export function useChargingState() {
  const [isCharging, setIsCharging] = useState(false);

  useEffect(() => {
    let mounted = true;
    Battery.getBatteryStateAsync().then((state) => {
      if (!mounted) return;
      setIsCharging(
        state === Battery.BatteryState.CHARGING ||
          state === Battery.BatteryState.FULL,
      );
    });
    const sub = Battery.addBatteryStateListener(({ batteryState }) => {
      setIsCharging(
        batteryState === Battery.BatteryState.CHARGING ||
          batteryState === Battery.BatteryState.FULL,
      );
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return isCharging;
}
