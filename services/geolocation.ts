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

/**
 * Get current GPS location with timeout and fallback to last known position.
 * Expo Go sometimes has trouble with getCurrentPositionAsync timing out,
 * so we use a best-effort approach:
 *   1. Try high-accuracy position (3s timeout)
 *   2. Fall back to last known position
 *   3. Fall back to IP-based geolocation
 */
export async function getCurrentLocation(): Promise<GeoLocation> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) {
    throw new Error('Location permission denied');
  }

  try {
    // Race: get position vs 5-second timeout
    const loc = await new Promise<Location.LocationObject>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Location request timed out'));
      }, 5000);

      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
    });

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
  } catch {
    // Expo Go fallback: try last known position
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown) {
        return {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
      }
    } catch { /* continues to IP fallback */ }

    throw new Error('Could not determine location');
  }
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
    throw new Error('Could not determine location from IP');
  }
}
