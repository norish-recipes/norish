import React from "react";
import { Pressable, Text } from "react-native";

interface AuthFooterLinkProps {
  /** The plain half of the sentence. */
  lead: string;
  /** The accented half, which is the link. */
  link: string;
  className?: string;
  onPress: () => void;
}

/** A sentence that is one link to the other form. */
export function AuthFooterLink({ lead, link, className, onPress }: AuthFooterLinkProps) {
  return (
    // Hit slop extends the 20pt text line to a 44pt target.
    <Pressable
      accessibilityRole="link"
      className={className}
      hitSlop={{ top: 12, bottom: 12 }}
      onPress={onPress}
    >
      <Text className="text-muted text-center text-[15px] leading-5 font-normal">
        {lead} <Text className="text-accent font-semibold">{link}</Text>
      </Text>
    </Pressable>
  );
}
