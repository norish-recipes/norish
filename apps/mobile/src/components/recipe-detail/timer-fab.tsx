import type { Timer } from "@/stores/timers";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { requestNotificationPermissions, useTimerStore } from "@/stores/timers";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassView } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { useThemeColor } from "heroui-native";

import { formatTimerMs } from "@norish/shared/lib/helpers";

// Wrap GlassView for Animated so glass blur updates during morph
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

// ─── Smart increment helper ─────────────────────────────────────────────────

function getSmartIncrement(originalDurationMs: number): number {
  const minutes = originalDurationMs / 1000 / 60;
  if (minutes < 5) return 10 * 1000; // 10s
  if (minutes < 20) return 60 * 1000; // 1m
  return 5 * 60 * 1000; // 5m
}

// ─── Timer Ticker ────────────────────────────────────────────────────────────

function TimerTicker() {
  const tick = useTimerStore((s) => s.tick);
  const timers = useTimerStore((s) => s.timers);
  const hasRunning = timers.some((t) => t.status === "running");

  useEffect(() => {
    if (!hasRunning) return;
    const interval = setInterval(() => tick(), 1000);
    return () => clearInterval(interval);
  }, [tick, hasRunning]);

  return null;
}

// ─── Timer Row ───────────────────────────────────────────────────────────────

function TimerRow({ timer, isLast }: { timer: Timer; isLast: boolean }) {
  const pauseTimer = useTimerStore((s) => s.pauseTimer);
  const startTimer = useTimerStore((s) => s.startTimer);
  const removeTimer = useTimerStore((s) => s.removeTimer);
  const adjustTimer = useTimerStore((s) => s.adjustTimer);

  const [foregroundColor, dangerColor, mutedColor] = useThemeColor([
    "foreground",
    "danger",
    "muted",
  ] as const);

  const isCompleted = timer.status === "completed";
  const isRunning = timer.status === "running";
  const smartIncrement = getSmartIncrement(timer.originalDurationMs);

  const handlePlayPause = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isRunning) {
      pauseTimer(timer.id);
    } else {
      startTimer(timer.id);
    }
  }, [isRunning, pauseTimer, startTimer, timer.id]);

  const handleRemove = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeTimer(timer.id);
  }, [removeTimer, timer.id]);

  return (
    <View
      style={[
        styles.timerRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: `${mutedColor}30`,
        },
      ]}
    >
      {/* Timer info */}
      <View style={styles.timerInfo}>
        <Text
          numberOfLines={1}
          style={[styles.timerLabel, { color: isCompleted ? dangerColor : foregroundColor }]}
        >
          {timer.label}
        </Text>
        {timer.recipeName ? (
          <Text numberOfLines={1} style={[styles.timerRecipeName, { color: mutedColor }]}>
            {timer.recipeName}
          </Text>
        ) : null}
        <Text style={[styles.timerTime, { color: isCompleted ? dangerColor : foregroundColor }]}>
          {formatTimerMs(timer.remainingMs)}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.timerControls}>
        {/* Adjust buttons */}
        <View style={styles.adjustRow}>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              adjustTimer(timer.id, -smartIncrement);
            }}
            hitSlop={6}
            style={styles.controlButton}
          >
            <Ionicons name="remove" size={16} color={foregroundColor} />
          </Pressable>
          <Pressable
            onPress={() => {
              void Haptics.selectionAsync();
              adjustTimer(timer.id, smartIncrement);
            }}
            hitSlop={6}
            style={styles.controlButton}
          >
            <Ionicons name="add" size={16} color={foregroundColor} />
          </Pressable>
        </View>

        <View style={[styles.divider, { backgroundColor: `${mutedColor}30` }]} />

        {/* Play/Pause + Dismiss */}
        {isCompleted ? (
          <Pressable
            onPress={handleRemove}
            style={[styles.doneButton, { backgroundColor: `${dangerColor}20` }]}
          >
            <Text style={[styles.doneButtonText, { color: dangerColor }]}>Done</Text>
          </Pressable>
        ) : (
          <View style={styles.actionRow}>
            <Pressable onPress={handlePlayPause} hitSlop={6} style={styles.controlButton}>
              <Ionicons name={isRunning ? "pause" : "play"} size={16} color={foregroundColor} />
            </Pressable>
            <Pressable onPress={handleRemove} hitSlop={6} style={styles.controlButton}>
              <Ionicons name="close" size={16} color={dangerColor} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Morph dimensions ────────────────────────────────────────────────────────

const COLLAPSED_WIDTH = 180;
const COLLAPSED_HEIGHT = 56;
const COLLAPSED_RADIUS = 28;

const EXPANDED_WIDTH = 300;
const EXPANDED_HEIGHT_PER_TIMER = 72;
const EXPANDED_HEADER_HEIGHT = 50;
const EXPANDED_MAX_HEIGHT = 400;
const EXPANDED_RADIUS = 24;

// ─── Main FAB Component ─────────────────────────────────────────────────────

export function TimerFAB() {
  const timers = useTimerStore((s) => s.timers);
  const [isExpanded, setIsExpanded] = useState(false);

  const runningTimers = timers.filter((t) => t.status === "running");
  const pausedTimers = timers.filter((t) => t.status === "paused");
  const completedTimers = timers.filter((t) => t.status === "completed");
  const allActive = [...completedTimers, ...runningTimers, ...pausedTimers];

  const hasTimers = allActive.length > 0;
  const hasCompleted = completedTimers.length > 0;

  const [foregroundColor, dangerColor] = useThemeColor(["foreground", "danger"] as const);

  // Single morph animation driver (0 = collapsed, 1 = expanded)
  const morphAnim = useRef(new Animated.Value(0)).current;

  // Content cross-fade (delayed relative to morph for stagger)
  const collapsedOpacity = useRef(new Animated.Value(1)).current;
  const expandedOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const toExpanded = isExpanded;

    // Morph the container shape
    Animated.spring(morphAnim, {
      toValue: toExpanded ? 1 : 0,
      damping: 20,
      stiffness: 200,
      mass: 0.8,
      useNativeDriver: false,
    }).start();

    // Cross-fade content
    if (toExpanded) {
      // Fade out collapsed, then fade in expanded
      Animated.sequence([
        Animated.timing(collapsedOpacity, {
          toValue: 0,
          duration: 120,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(expandedOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Fade out expanded, then fade in collapsed
      Animated.sequence([
        Animated.timing(expandedOpacity, {
          toValue: 0,
          duration: 120,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(collapsedOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isExpanded, morphAnim, collapsedOpacity, expandedOpacity]);

  // Fade in/out entire FAB
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fadeAnim, {
      toValue: hasTimers ? 1 : 0,
      damping: 18,
      stiffness: 180,
      useNativeDriver: true,
    }).start();
  }, [hasTimers, fadeAnim]);

  // Reset expand when no timers
  useEffect(() => {
    if (!hasTimers) setIsExpanded(false);
  }, [hasTimers]);

  // Request notification permissions on first timer
  useEffect(() => {
    if (hasTimers) {
      void requestNotificationPermissions();
    }
  }, [hasTimers]);

  // Sort timers: completed first, then by remaining time
  const sortedTimers = [...allActive].sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return -1;
    if (b.status === "completed" && a.status !== "completed") return 1;
    return a.remainingMs - b.remainingMs;
  });

  const topTimer = sortedTimers[0];
  const timerCount = allActive.length;

  if (!hasTimers) return <TimerTicker />;

  const handleToggle = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded((prev) => !prev);
  };

  // Compute expanded height based on timer count
  const expandedHeight = Math.min(
    EXPANDED_HEADER_HEIGHT + timerCount * EXPANDED_HEIGHT_PER_TIMER,
    EXPANDED_MAX_HEIGHT
  );

  // Interpolated morph values
  const morphWidth = morphAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLLAPSED_WIDTH, EXPANDED_WIDTH],
  });

  const morphHeight = morphAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLLAPSED_HEIGHT, expandedHeight],
  });

  const morphRadius = morphAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLLAPSED_RADIUS, EXPANDED_RADIUS],
  });

  return (
    <>
      <TimerTicker />
      <Animated.View
        style={[
          styles.fabContainer,
          {
            opacity: fadeAnim,
          },
        ]}
        pointerEvents={hasTimers ? "auto" : "none"}
      >
        <Pressable onPress={handleToggle} disabled={isExpanded}>
          <AnimatedGlassView
            style={{
              width: morphWidth,
              height: morphHeight,
              borderRadius: morphRadius,
              overflow: "hidden" as const,
            }}
          >
            {/* ── Collapsed content (cross-fades out) ──────────────── */}
            <Animated.View
              style={[styles.collapsedContent, { opacity: collapsedOpacity }]}
              pointerEvents={isExpanded ? "none" : "auto"}
            >
              {/* Timer icon */}
              <Ionicons
                name="timer-outline"
                size={22}
                color={hasCompleted ? dangerColor : foregroundColor}
              />

              {/* Timer display */}
              <View style={styles.collapsedInfo}>
                <Text
                  numberOfLines={1}
                  style={[styles.collapsedLabel, { color: `${foregroundColor}99` }]}
                >
                  {timerCount === 1 ? topTimer!.label : `${timerCount} Timers`}
                </Text>
                <Text
                  style={[
                    styles.collapsedTime,
                    { color: hasCompleted ? dangerColor : foregroundColor },
                  ]}
                >
                  {formatTimerMs(topTimer!.remainingMs)}
                </Text>
              </View>

              <Ionicons name="chevron-up" size={14} color={`${foregroundColor}60`} />
            </Animated.View>

            {/* ── Expanded content (cross-fades in) ─────────────────── */}
            <Animated.View
              style={[StyleSheet.absoluteFill, { opacity: expandedOpacity }]}
              pointerEvents={isExpanded ? "auto" : "none"}
            >
              {/* Header */}
              <Pressable onPress={handleToggle} style={styles.expandedHeader}>
                <Text style={[styles.expandedHeaderTitle, { color: foregroundColor }]}>
                  {timerCount === 1 ? "1 Timer" : `${timerCount} Timers`}
                </Text>
                <Ionicons name="chevron-down" size={16} color={foregroundColor} />
              </Pressable>

              {/* Timer list */}
              <ScrollView
                style={styles.timerList}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {sortedTimers.map((timer, idx) => (
                  <TimerRow key={timer.id} timer={timer} isLast={idx === sortedTimers.length - 1} />
                ))}
              </ScrollView>
            </Animated.View>
          </AnimatedGlassView>
        </Pressable>
      </Animated.View>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fabContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 100 : 80,
    right: 16,
    zIndex: 999,
    alignItems: "flex-end",
  },

  // Collapsed content (overlaid inside the morphing container)
  collapsedContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  collapsedInfo: {
    justifyContent: "center",
    flexShrink: 1,
  },
  collapsedLabel: {
    fontSize: 11,
    fontWeight: "500",
    maxWidth: 100,
    marginBottom: 1,
  },
  collapsedTime: {
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },

  // Expanded content
  expandedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  expandedHeaderTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  timerList: {
    flex: 1,
  },

  // Timer row
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timerInfo: {
    flex: 1,
    minWidth: 0,
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  timerRecipeName: {
    fontSize: 11,
    marginBottom: 3,
  },
  timerTime: {
    fontSize: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },
  timerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  adjustRow: {
    flexDirection: "row",
    gap: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 4,
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  divider: {
    width: 1,
    height: 28,
  },
  doneButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  doneButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
