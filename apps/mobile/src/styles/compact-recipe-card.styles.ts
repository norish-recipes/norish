import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  card: {
    width: 144,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageContainer: {
    width: 144,
    height: 104,
  },
  imageFill: {
    ...StyleSheet.absoluteFill,
  },
  body: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
});
