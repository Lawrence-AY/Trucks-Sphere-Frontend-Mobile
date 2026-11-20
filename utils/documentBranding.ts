import { Image } from 'react-native';

// Official Spades Atlas letterhead supplied for TruckSphere-generated documents.
// Expo web's static renderer exposes the asset directly and does not provide
// Image.resolveAssetSource, while native Expo does.
const asset = require('../assets/spades-atlas-logo.png');
export const SPADES_ATLAS_LOGO = typeof asset === 'string'
  ? asset
  : (typeof Image.resolveAssetSource === 'function' ? Image.resolveAssetSource(asset).uri : asset?.uri || '');
