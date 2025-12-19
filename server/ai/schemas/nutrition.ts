export const nutritionEstimationSchema = {
  name: "nutrition_estimation",
  schema: {
    type: "object",
    properties: {
      calories: {
        type: "number",
        description:
          "Estimated calories per serving in kcal should be equal to fat * 9 + carbs * 4 + protein * 4",
      },
      fat: {
        type: "number",
        description: "Estimated fat per serving in grams",
      },
      carbs: {
        type: "number",
        description: "Estimated carbohydrates per serving in grams",
      },
      protein: {
        type: "number",
        description: "Estimated protein per serving in grams",
      },
    },
    required: ["calories", "fat", "carbs", "protein"],
    additionalProperties: false,
  },
  strict: true,
} as const;
