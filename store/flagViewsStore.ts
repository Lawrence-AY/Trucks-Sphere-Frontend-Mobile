import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { isDeliveryFlagged, flagViewKey } from '../utils/siteFlags';
export const useFlagViewsStore = create(persist<{ viewed: Record<string, boolean>; markViewed: (userId: string, job: any) => void }>((set) => ({
 viewed: {},
 markViewed: (userId, job) => { if (userId && isDeliveryFlagged(job)) set((state) => ({ viewed: { ...state.viewed, [flagViewKey(userId, job)]: true } })); },
}), { name: 'flag-views', storage: createJSONStorage(() => ({
 getItem: (key) => Platform.OS === 'web' ? (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)) : SecureStore.getItemAsync(key),
 setItem: (key, value) => Platform.OS === 'web' ? localStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
 removeItem: (key) => Platform.OS === 'web' ? localStorage.removeItem(key) : SecureStore.deleteItemAsync(key),
})) }));

export { flagViewKey } from '../utils/siteFlags';

export default null;
