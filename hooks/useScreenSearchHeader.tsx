import { useLayoutEffect, type ComponentProps, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useNavigation } from 'expo-router';
import { ScreenSearchHeader } from '../components/ManagementSearchHeader';
import { BackButton } from '../components/ui/BackButton';

type HeaderProps = {
  options: {
    headerTintColor?: string;
    headerLeft?: (props: { tintColor?: string; canGoBack: boolean }) => ReactNode;
    headerRight?: (props: { tintColor?: string; canGoBack: boolean }) => ReactNode;
  };
  back?: { title?: string };
};

/** Use the same search row in tab and stack navigators, retaining their actions. */
export function useScreenSearchHeader(props: ComponentProps<typeof ScreenSearchHeader>) {
  const navigation = useNavigation();
  const { title, search, onChangeSearch, placeholder, icon, hideSearch } = props;
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: Platform.OS !== 'web',
      header: ({ options, back }: HeaderProps) => {
        const actionProps = { tintColor: options.headerTintColor, canGoBack: navigation.canGoBack() };
        return <ScreenSearchHeader
          title={title} search={search} onChangeSearch={onChangeSearch}
          placeholder={placeholder} icon={icon} hideSearch={hideSearch}
          left={options.headerLeft?.(actionProps) ?? (back ? <BackButton onPress={() => navigation.goBack()} /> : undefined)}
          right={options.headerRight?.(actionProps)}
        />;
      },
    });
  }, [navigation, title, search, onChangeSearch, placeholder, icon, hideSearch]);
  // Conditional list screens must restore their normal header when opening a form.
  useLayoutEffect(() => () => navigation.setOptions({ header: undefined }), [navigation]);
  return Platform.OS === 'web' ? <ScreenSearchHeader {...props} /> : null;
}
