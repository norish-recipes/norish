import { Text, VStack } from "@expo/ui/swift-ui";
import { font, foregroundStyle, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity } from "expo-widgets";

type TimerActivityProps = {
  timerLabel: string;
  remainingSeconds: number;
  status: string;
  timerCount: number;
};

function formatTime(totalSeconds: number): string {
  "widget";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const TimerActivity = (props: TimerActivityProps) => {
  "widget";

  const timeDisplay = formatTime(props.remainingSeconds);
  const isCompleted = props.status === "completed";
  const statusColor = isCompleted ? "#FF3B30" : "#007AFF";
  const statusText = isCompleted
    ? "Timer Complete!"
    : props.timerCount > 1
      ? `${props.timerCount} timers active`
      : "Timer Running";

  return {
    // Banner: Full expanded Lock Screen view
    banner: (
      <VStack modifiers={[padding({ all: 16 })]}>
        <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(statusColor)]}>
          {statusText}
        </Text>
        <Text
          modifiers={[
            font({ weight: "bold", size: 32, design: "monospaced" }),
            foregroundStyle("#FFFFFF"),
          ]}
        >
          {timeDisplay}
        </Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle("#EBEBF5")]}>{props.timerLabel}</Text>
      </VStack>
    ),

    // Compact leading: left side of Dynamic Island pill
    compactLeading: (
      <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(statusColor)]}>
        🍳
      </Text>
    ),

    // Compact trailing: right side of Dynamic Island pill
    compactTrailing: (
      <Text
        modifiers={[
          font({ size: 13, weight: "bold", design: "monospaced" }),
          foregroundStyle("#FFFFFF"),
        ]}
      >
        {timeDisplay}
      </Text>
    ),

    // Minimal: smallest representation in Dynamic Island
    minimal: (
      <Text
        modifiers={[
          font({ size: 11, weight: "bold", design: "monospaced" }),
          foregroundStyle("#FFFFFF"),
        ]}
      >
        {timeDisplay}
      </Text>
    ),

    // Expanded leading
    expandedLeading: (
      <VStack modifiers={[padding({ leading: 16, top: 12, bottom: 12 })]}>
        <Text modifiers={[font({ size: 28 })]}>🍳</Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle("#EBEBF5")]}>Norish</Text>
      </VStack>
    ),

    // Expanded trailing
    expandedTrailing: (
      <VStack modifiers={[padding({ trailing: 16, top: 12, bottom: 12 })]}>
        <Text
          modifiers={[
            font({ weight: "bold", size: 28, design: "monospaced" }),
            foregroundStyle("#FFFFFF"),
          ]}
        >
          {timeDisplay}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(statusColor)]}>{statusText}</Text>
      </VStack>
    ),

    // Expanded bottom
    expandedBottom: (
      <VStack modifiers={[padding({ horizontal: 16, bottom: 12 })]}>
        <Text modifiers={[font({ size: 13 }), foregroundStyle("#EBEBF5")]}>{props.timerLabel}</Text>
      </VStack>
    ),
  };
};

export default createLiveActivity("TimerActivity", TimerActivity);
