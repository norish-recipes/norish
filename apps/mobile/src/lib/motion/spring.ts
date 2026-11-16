// Critically damped: a settle lands without overshooting, for the pager, the digits and the capsule.
export const SPRING = { damping: 30, stiffness: 260, mass: 1 };

type SpringBuilder = {
  damping: (value: number) => unknown;
  stiffness: (value: number) => unknown;
  mass: (value: number) => unknown;
};

/** Sets a springified layout animation to the app's spring. */
export function sprung<T extends SpringBuilder>(builder: T): T {
  builder.damping(SPRING.damping);
  builder.stiffness(SPRING.stiffness);
  builder.mass(SPRING.mass);

  return builder;
}
