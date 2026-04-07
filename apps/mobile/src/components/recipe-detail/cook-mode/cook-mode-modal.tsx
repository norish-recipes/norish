import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import Reanimated, {
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassView } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecipeIngredientsDto } from "@norish/shared/contracts";

import type { MappedStep } from "../../../lib/recipes/map-recipe-to-steps";
import { TimerFAB } from "../timer-fab";
import { CookModeIngredients } from "./cook-mode-ingredients";
import { CookModeSteps } from "./cook-mode-steps";

const KEEP_AWAKE_TAG = "cook-mode";
const TAB_SLIDE_DISTANCE = 50;
const TAB_ANIM_DURATION = 250;

// ─── Types ──────────────────────────────────────────────────────────────────

type CookModeModalProps = {
  visible: boolean;
  onClose: () => void;
  steps: MappedStep[];
  ingredients: RecipeIngredientsDto[];
  recipeId: string;
  recipeName: string;
  baseServings: number;
  servings: number;
  onServingsChange: (s: number) => void;
};

type TabKey = "steps" | "ingredients";

// ─── Component ──────────────────────────────────────────────────────────────

export function CookModeModal({
  visible,
  onClose,
  steps,
  ingredients,
  recipeId,
  recipeName,
  baseServings,
  servings,
  onServingsChange,
}: CookModeModalProps) {
  const intl = useIntl();
  const insets = useSafeAreaInsets();
  const [foregroundColor, mutedColor, accentColor, backgroundColor] = useThemeColor([
    "foreground",
    "muted",
    "accent",
    "background",
  ] as const);

  const [activeTab, setActiveTab] = useState<TabKey>("steps");
  const [currentStep, setCurrentStep] = useState(0);

  // Track tab direction: 1 = going to ingredients (right), -1 = going to steps (left)
  const tabDirectionRef = useRef<1 | -1>(1);

  const TABS = [
    {
      key: "steps" as TabKey,
      label: intl.formatMessage({ id: "recipes.cookMode.steps" }),
      icon: "list-outline",
    },
    {
      key: "ingredients" as TabKey,
      label: intl.formatMessage({ id: "recipes.cookMode.ingredients" }),
      icon: "nutrition-outline",
    },
  ];

  // Tab indicator animation
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  // Entrance animation
  const entranceAnim = useRef(new Animated.Value(0)).current;

  // ── Keep screen awake ─────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    } else {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    }
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [visible]);

  // ── Entrance animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      entranceAnim.setValue(0);
      Animated.spring(entranceAnim, {
        toValue: 1,
        damping: 20,
        stiffness: 200,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, entranceAnim]);

  // ── Tab switching ─────────────────────────────────────────────────────────
  const switchTab = useCallback(
    (tab: TabKey) => {
      const index = TABS.findIndex((t) => t.key === tab);
      tabDirectionRef.current = tab === "ingredients" ? 1 : -1;
      setActiveTab(tab);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.spring(indicatorAnim, {
        toValue: index,
        damping: 18,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    },
    [indicatorAnim, TABS]
  );

  const handleClose = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  }, [onClose]);

  const handleSwipeLeft = useCallback(() => switchTab("ingredients"), [switchTab]);
  const handleSwipeRight = useCallback(() => switchTab("steps"), [switchTab]);

  // ── Tab bar sizing ────────────────────────────────────────────────────────
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const tabWidth = tabBarWidth > 0 ? (tabBarWidth - 8) / TABS.length : 0;

  const indicatorTranslateX = indicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, tabWidth],
  });
  const contentTranslateY = entranceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <View className="flex-1" style={{ backgroundColor, paddingTop: insets.top }}>
        {/* ── Header ───────────────────────────────────────────────────── */}
        <Animated.View
          className="gap-4 px-6 pt-2"
          style={{
            opacity: entranceAnim,
            transform: [{ translateY: contentTranslateY }],
          }}
        >
          {/* Recipe name + close */}
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 flex-row items-center gap-2">
              <Text
                className="flex-1 text-lg font-semibold"
                style={{ color: foregroundColor, letterSpacing: -0.2 }}
                numberOfLines={1}
              >
                {recipeName}
              </Text>
            </View>

            {/* Liquid glass close button — GlassView needs explicit style, not className */}
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              style={({ pressed }) => [pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] }]}
            >
              <GlassView style={styles.glassCloseBtn}>
                <Ionicons name="close" size={18} color={foregroundColor} />
              </GlassView>
            </Pressable>
          </View>

          {/* ── Tab bar ─────────────────────────────────────────────────── */}
          <View
            className="relative flex-row overflow-hidden rounded-[14px] p-1"
            style={{ backgroundColor: `${mutedColor}12` }}
            onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}
          >
            {tabWidth > 0 && (
              <Animated.View
                className="absolute top-1 bottom-1 left-1 rounded-[10px]"
                style={{
                  width: tabWidth,
                  backgroundColor: `${accentColor}18`,
                  transform: [{ translateX: indicatorTranslateX }],
                }}
              />
            )}

            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => switchTab(tab.key)}
                  className="z-[1] flex-1 flex-row items-center justify-center gap-1.5 py-2.5"
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={16}
                    color={isActive ? accentColor : `${mutedColor}80`}
                  />
                  <Text
                    className="text-sm"
                    style={{
                      color: isActive ? accentColor : `${mutedColor}80`,
                      fontWeight: isActive ? "600" : "400",
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Content ──────────────────────────────────────────────────── */}
        <Animated.View
          className="flex-1"
          style={{
            opacity: entranceAnim,
            transform: [{ translateY: contentTranslateY }],
            overflow: "hidden",
          }}
        >
          {activeTab === "steps" ? (
            <Reanimated.View
              key="tab-steps"
              entering={
                tabDirectionRef.current === -1
                  ? SlideInLeft.duration(TAB_ANIM_DURATION).withInitialValues({
                      transform: [{ translateX: -TAB_SLIDE_DISTANCE }],
                    })
                  : undefined
              }
              exiting={SlideOutLeft.duration(TAB_ANIM_DURATION)}
              className="flex-1"
            >
              <CookModeSteps
                steps={steps}
                recipeId={recipeId}
                recipeName={recipeName}
                currentStep={currentStep}
                onStepChange={setCurrentStep}
                onSwipeLeft={handleSwipeLeft}
              />
            </Reanimated.View>
          ) : (
            <Reanimated.View
              key="tab-ingredients"
              entering={
                tabDirectionRef.current === 1
                  ? SlideInRight.duration(TAB_ANIM_DURATION).withInitialValues({
                      transform: [{ translateX: TAB_SLIDE_DISTANCE }],
                    })
                  : undefined
              }
              exiting={SlideOutRight.duration(TAB_ANIM_DURATION)}
              className="flex-1"
            >
              <CookModeIngredients
                ingredients={ingredients}
                baseServings={baseServings}
                servings={servings}
                onServingsChange={onServingsChange}
                onSwipeRight={handleSwipeRight}
              />
            </Reanimated.View>
          )}
        </Animated.View>

        {/* Floating timer FAB */}
        <TimerFAB />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  glassCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
});
