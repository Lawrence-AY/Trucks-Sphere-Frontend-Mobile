import { useState, useEffect, useRef, useCallback } from 'react';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  address: string;
  loading: boolean;
  error: string | null;
}

export const useLocation = () => {
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    address: '',
    loading: false,
    error: null,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const getCurrentLocation = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const loc = await import('../services/geolocation').then(
        (m) => m.getCurrentLocation()
      );
      if (!mountedRef.current) return;
      const address = await import('../services/geolocation').then((m) =>
        m.reverseGeocode(loc.latitude, loc.longitude)
      );
      if (!mountedRef.current) return;
      setState({
        latitude: loc.latitude,
        longitude: loc.longitude,
        address,
        loading: false,
        error: null,
      });
      return { ...loc, address };
    } catch (err: any) {
      if (!mountedRef.current) return;
      // IP fallback
      try {
        const resp = await fetch('https://ipapi.co/json/');
        const data = await resp.json();
        const addr = `${data.city || ''}, ${data.region || ''}, ${data.country_name || ''}`.replace(/^, /, '');
        setState({
          latitude: data.latitude,
          longitude: data.longitude,
          address: addr || 'Unknown location',
          loading: false,
          error: null,
        });
        return { latitude: data.latitude, longitude: data.longitude, address: addr };
      } catch {
        setState({
          latitude: null,
          longitude: null,
          address: 'Location unavailable',
          loading: false,
          error: 'Could not get location',
        });
      }
    }
  }, []);

  return { ...state, getCurrentLocation };
};
