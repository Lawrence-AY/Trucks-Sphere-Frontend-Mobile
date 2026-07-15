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
      setState({
        latitude: null,
        longitude: null,
        address: '',
        loading: false,
        error: err?.message || 'Could not get location',
      });
      return null;
    }
  }, []);

  return { ...state, getCurrentLocation };
};
