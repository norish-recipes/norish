import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  card: {
    width: 150,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageContainer: {
    width: 150,
    height: 130,
  },
  imageFill: {
    ...StyleSheet.absoluteFillObject,
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
