import { View } from "react-native";

interface PomodoroRingProps {
  progress: number;
  color: string;
  children: React.ReactNode;
}

/**
 * Ring of 12 segments that fade in as `progress` (0..1) advances.
 * No SVG/Skia required — keeps the bundle small.
 */
export function PomodoroRing({ progress, color, children }: PomodoroRingProps) {
  const segments = 12;
  const filled = Math.round(progress * segments);

  return (
    <View className="relative h-56 w-56 items-center justify-center">
      {Array.from({ length: segments }).map((_, i) => {
        const angle = (i / segments) * 2 * Math.PI - Math.PI / 2;
        const radius = 96;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const active = i < filled;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              width: 10,
              height: 10,
              borderRadius: 5,
              transform: [{ translateX: x }, { translateY: y }],
              backgroundColor: active ? color : "#1f2937",
              opacity: active ? 1 : 0.6,
            }}
          />
        );
      })}
      <View className="items-center justify-center">{children}</View>
    </View>
  );
}
