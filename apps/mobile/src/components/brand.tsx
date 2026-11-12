import type { ComponentProps } from "react";
import React from "react";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";
import LogoCream from "@/assets/brand/logo-cream.svg";
import Logo from "@/assets/brand/logo.svg";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { useIntl } from "react-intl";

// The native splash draws the logo at this width too (app.json's imageWidth); the viewBox is 2370 x 639.
const LOGO_WIDTH = 168;
const LOGO_HEIGHT = (LOGO_WIDTH * 639) / 2370;
// The splash centres logo and slogan as one group (gap-3, the slogan's 20pt line); the
// splash PNGs carry that 32pt as transparent rows under the logo, so iOS centres it the same.
export const BRAND_HEIGHT = LOGO_HEIGHT + 12 + 20;
// The form screens' boards (Login, Register) draw it smaller, under their prefix line.
const COMPACT_LOGO_WIDTH = 144;

interface BrandProps {
  /** A line above the logo, such as "Sign in to". */
  prefix?: string;
  /** Whether the slogan shows under the logo. */
  slogan?: boolean;
  sloganStyle?: ComponentProps<typeof Animated.View>["style"];
  /** The form screens' smaller logo instead of the splash's. */
  compact?: boolean;
}

/** The logo, in the scheme's colour, with the slogan under it. */
export function Brand({ prefix, slogan = true, sloganStyle, compact = false }: BrandProps) {
  const intl = useIntl();
  const Mark = useResolvedColorScheme() === "dark" ? LogoCream : Logo;
  const width = compact ? COMPACT_LOGO_WIDTH : LOGO_WIDTH;

  return (
    <View className="items-center gap-3">
      {prefix ? <Text className="text-muted text-[17px] font-normal">{prefix}</Text> : null}
      <Mark
        accessible
        accessibilityLabel="Norish"
        height={(width * LOGO_HEIGHT) / LOGO_WIDTH}
        width={width}
      />
      {slogan ? (
        <Animated.View style={sloganStyle}>
          <Text className="text-muted text-base leading-5 font-normal">
            {intl.formatMessage({ id: "auth.login.subtitle" })}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
