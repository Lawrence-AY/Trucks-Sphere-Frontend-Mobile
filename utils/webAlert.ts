import { Platform } from 'react-native';

export const showConfirm = (title: string, message: string): Promise<boolean> => {
  if (Platform.OS === 'web') {
    const result = window.confirm(`${title}\n\n${message}`);
    return Promise.resolve(result);
  }
  const { Alert } = require('react-native');
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
      { text: 'OK', onPress: () => resolve(true) },
    ]);
  });
};

export const showAlert = (title: string, message: string): Promise<void> => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return Promise.resolve();
  }
  const { Alert } = require('react-native');
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }]);
  });
};