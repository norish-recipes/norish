/**
 * Dummy recipe data for development of the recipe detail page.
 * Replace with real backend data once wired up.
 *
 * The data now exercises:
 * - markdown-like formatting: **bold**, *italic*, [links](url)
 * - # headings in ingredients and steps
 * - timer patterns (e.g. "30 minutes", "6–7 minutes")
 * - step images (one step can have multiple images)
 * - recipe cross-links via [name](id:some-recipe-id) syntax
 */

export interface DummyIngredient {
  name: string;
  amount: string;
  unit: string;
}

export interface DummyNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ---------------------------------------------------------------------------
// Media types – a recipe header can contain images and/or a single video
// ---------------------------------------------------------------------------

export type MediaItemImage = {
  type: 'image';
  uri: string;
};

export type MediaItemVideo = {
  type: 'video';
  uri: string;
  /** Optional poster / thumbnail shown before the video plays */
  posterUri?: string;
};

export type MediaItem = MediaItemImage | MediaItemVideo;

// ---------------------------------------------------------------------------
// Step images – each step can reference zero or more images
// ---------------------------------------------------------------------------

export interface StepImage {
  image: string;
}

// ---------------------------------------------------------------------------
// Step type – text + optional images
// ---------------------------------------------------------------------------

export interface DummyStep {
  /** The instruction text (may contain markdown formatting) */
  text: string;
  /** Optional images attached to this step */
  images?: StepImage[];
}

export interface DummyRecipe {
  id: string;
  name: string;
  /** Description with markdown support */
  description: string;
  /** @deprecated – use `media` instead for multi-media support */
  imageUrl: string;
  /** Ordered list of images / video for the hero header */
  media: MediaItem[];
  source: string;
  sourceInitials: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  totalMinutes: number;
  tags: string[];
  ingredients: DummyIngredient[];
  /** Steps – now objects with text + optional images */
  steps: DummyStep[];
  nutrition: DummyNutrition;
  rating: number;
  liked: boolean;
}

export const DUMMY_RECIPE: DummyRecipe = {
  id: 'demo-1',
  name: 'Lemon Herb Grilled Chicken',
  description:
    'Juicy **grilled chicken** marinated in *fresh lemon juice*, garlic, and a medley of Mediterranean herbs. Served with roasted vegetables for a wholesome, vibrant dinner.\n\nPairs beautifully with our [Classic Greek Salad](id:demo-greek-salad) or a simple [Tzatziki Sauce](https://example.com/tzatziki-recipe).',
  imageUrl:
    'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&q=80',
  media: [
    {
      type: 'video',
      uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      posterUri:
        'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&q=80',
    },
    {
      type: 'image',
      uri: 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=800&q=80',
    },
    {
      type: 'image',
      uri: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&q=80',
    },
    {
      type: 'image',
      uri: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&q=80',
    },
  ],
  source: 'Chef Maria Santos',
  sourceInitials: 'MS',
  servings: 4,
  prepMinutes: 15,
  cookMinutes: 25,
  totalMinutes: 40,
  tags: ['Mediterranean', 'High Protein', 'Gluten Free', 'Summer', 'Easy'],
  ingredients: [
    // ── Heading group: Chicken ───────────────────────────────────────────
    { name: '# Chicken', amount: '', unit: '' },
    { name: 'Boneless **chicken thighs**', amount: '800', unit: 'g' },
    { name: 'Sea salt', amount: '', unit: 'to taste' },
    { name: 'Black pepper', amount: '', unit: 'to taste' },

    // ── Heading group: Marinade ──────────────────────────────────────────
    { name: '# Marinade', amount: '', unit: '' },
    { name: '*Fresh* lemon juice', amount: '3', unit: 'tbsp' },
    { name: 'Extra virgin olive oil', amount: '2', unit: 'tbsp' },
    { name: 'Garlic, *finely* minced', amount: '4', unit: 'cloves' },
    { name: 'Fresh rosemary', amount: '2', unit: 'sprigs' },
    { name: 'Fresh thyme', amount: '3', unit: 'sprigs' },
    { name: 'Dried oregano', amount: '1', unit: 'tsp' },
    { name: 'Lemon zest', amount: '1', unit: 'lemon' },

    // ── Heading group: Serving ───────────────────────────────────────────
    { name: '# Serving', amount: '', unit: '' },
    { name: '[Roasted vegetables](id:demo-roasted-veg) or salad', amount: '', unit: '' },
    { name: 'Fresh herbs for **garnish**', amount: '', unit: '' },
  ],
  steps: [
    // Step with heading
    {
      text: '# Prepare the Marinade',
    },
    {
      text: 'Combine **lemon juice**, olive oil, *minced garlic*, chopped rosemary, thyme leaves, oregano, salt, pepper, and lemon zest in a large bowl. Whisk until well combined.',
      images: [
        {
          image:
            'https://images.unsplash.com/photo-1615486511484-92e172cc4fe0?w=400&q=80',
        },
      ],
    },
    {
      text: 'Add the chicken thighs to the marinade and toss until evenly coated. Cover and refrigerate for at least 30 minutes, or up to 4 hours for best results.',
      images: [
        {
          image:
            'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80',
        },
        {
          image:
            'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&q=80',
        },
      ],
    },
    // Step with heading
    {
      text: '# Grill',
    },
    {
      text: 'Preheat your grill or grill pan to *medium-high heat*. Lightly oil the grates to prevent sticking. Allow **5 minutes** for the grill to reach temperature.',
    },
    {
      text: 'Remove chicken from the marinade and let excess drip off. Place on the grill and cook for **6–7 minutes** per side, until internal temperature reaches 74°C (165°F).',
      images: [
        {
          image:
            'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400&q=80',
        },
        {
          image:
            'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&q=80',
        },
        {
          image:
            'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80',
        },
      ],
    },
    // Step with heading
    {
      text: '# Serve',
    },
    {
      text: 'Let the chicken rest for **5 minutes** on a cutting board before slicing. This allows the juices to redistribute for ***maximum tenderness***.',
    },
    {
      text: 'Serve with [roasted seasonal vegetables](id:demo-roasted-veg) and a squeeze of *fresh lemon*. Garnish with fresh herbs. Pairs well with our [Classic Greek Salad](id:demo-greek-salad).',
      images: [
        {
          image:
            'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400&q=80',
        },
      ],
    },
  ],
  nutrition: {
    calories: 320,
    protein: 38,
    carbs: 4,
    fat: 18,
  },
  rating: 4,
  liked: true,
};
