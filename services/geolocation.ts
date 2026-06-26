import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export async function requestLocationPermissions(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<GeoLocation> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) {
    throw new Error('Location permission denied');
  }

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
  };
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string> {
  try {
    const addresses = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (addresses && addresses.length > 0) {
      const addr = addresses[0];
      const parts = [
        addr.name,
        addr.street,
        addr.district,
        addr.city,
        addr.region,
        addr.country,
      ].filter(Boolean);
      return parts.join(', ');
    }
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch {
    // Fallback: return lat/lng as string
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

export async function getAddressFromLocation(): Promise<{
  latitude: number;
  longitude: number;
  address: string;
}> {
  const loc = await getCurrentLocation();
  const address = await reverseGeocode(loc.latitude, loc.longitude);
  return { ...loc, address };
}

// IP-based geolocation fallback
export async function getLocationFromIP(): Promise<{
  latitude: number;
  longitude: number;
  address: string;
}> {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    const address = [data.city, data.region, data.country_name]
      .filter(Boolean)
      .join(', ');
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      address: address || 'Unknown',
    };
  } catch {
    // Fallback to Kisumu, Kenya coordinates
    return {
      latitude: -0.0917,
      longitude: 34.768,
      address: 'Kisumu, Kenya (Fallback)',
    };
  }
}
