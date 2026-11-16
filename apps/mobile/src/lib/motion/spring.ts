import type { ComplexAnimationBuilder, LinearTransition } from "react-native-reanimated";

// Critically damped: a settle lands without overshooting, for the pager, the digits and the capsule.
export const SPRING = { damping: 30, stiffness: 260, mass: 1 };

/** Sets a springified layout animation to the app's spring. */
export function sprung<T extends ComplexAnimationBuilder | LinearTransition>(builder: T): T {
  builder.damping(SPRING.damping);
  builder.stiffness(SPRING.stiffness);
  builder.mass(SPRING.mass);

  return builder;
}
