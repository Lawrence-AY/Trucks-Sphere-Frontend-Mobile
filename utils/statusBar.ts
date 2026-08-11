import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Expo Go owns its iOS host Info.plist and does not enable controller-based
 * status-bar appearance. Avoid requesting per-screen status-bar changes in
 * that host app; standalone and development builds retain those changes.
 */
export const canControlStatusBarAppearance =
  Platform.OS !== 'ios' || Constants.appOwnership !== 'expo';
