import React, { useState } from "react";
import { RollingText } from "@/components/rolling-text";

import { valueMagnitude } from "@norish/shared/lib/rolling-slots";

/** A figure that changes under the reader, such as an amount, a serving count or a macro: it rolls
 * up when the number grew and down when it shrank. */
export function AnimatedNumber({ value, className }: { value: string; className?: string }) {
  const [previous, setPrevious] = useState(value);
  const [rising, setRising] = useState(true);

  if (value !== previous) {
    setPrevious(value);
    setRising(valueMagnitude(value) >= valueMagnitude(previous));
  }

  return <RollingText className={className} rising={rising} value={value} />;
}
