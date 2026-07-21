import { Colors } from '../constants/theme';
import { useColorScheme } from 'react-native';

export const useTheme = () => {
  // Use the platform preference until an in-app theme selector is introduced.
  // Keeping this in one hook makes every shared component behave consistently
  // on mobile, tablet, and web.
  const scheme = useColorScheme();
  return scheme === 'dark' ? Colors.dark : Colors.light;
};
