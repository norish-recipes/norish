import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  imageContainer: {
    width: '100%',
    aspectRatio: 16 / 11,
  },
  imageFill: {
    ...StyleSheet.absoluteFillObject,
  },
  heartPill: {
    overflow: 'hidden',
    borderRadius: 999,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  categories: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  categoriesRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  highlightItem: {
    gap: 1,
  },
  highlightLabel: {
    fontSize: 10,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '500',
  },
  highlightValue: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  highlightDivider: {
    width: 1,
    height: 28,
    borderRadius: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
