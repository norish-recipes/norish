import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 16,
  },
  copyBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  settingsButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonDefault: {
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  settingsButtonIos: {
    backgroundColor: 'rgba(127,127,127,0.18)',
  },
  settingsButtonPressed: {
    opacity: 0.7,
  },
  glassWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  glassBlur: {
    ...StyleSheet.absoluteFillObject,
  },
});
