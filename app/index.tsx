import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';

const LOADING_MESSAGES = [
  'Loading fleet',
  'Preparing deliveries',
  'Connecting operations',
  'Syncing data',
];

export default function IndexScreen() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [messageIndex, setMessageIndex] = useState(0);
  const truckX = useRef(new Animated.Value(-120)).current;
  const logoScale = useRef(new Animated.Value(0.86)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const smoke = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const messageTimer = setInterval(() => {
      setMessageIndex((current) => (current + 1) % LOADING_MESSAGES.length);
    }, 850);

    Animated.loop(
      Animated.sequence([
        Animated.timing(smoke, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(smoke, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    ).start();

    Animated.parallel([
      Animated.timing(truckX, {
        toValue: 42,
        duration: 2600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 1,
        duration: 2800,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.delay(1450),
        Animated.parallel([
          Animated.timing(logoOpacity, { toValue: 1, duration: 650, useNativeDriver: true }),
          Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    return () => clearInterval(messageTimer);
  }, [logoOpacity, logoScale, progress, smoke, truckX]);

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        router.replace('/(auth)/login');
        return;
      }
      const role = useAuthStore.getState().user?.role ;
      switch (role) {
        case 'management': router.replace('/management/dashboard' as any); break;
        case 'vendor': router.replace('/vendor/dashboard' as any); break;
        case 'operator_site': router.replace('/operator-site/dashboard' as any); break;
        case 'operator_quarry': router.replace('/operator-quarry/dashboard' as any); break;
        case 'admin': router.replace('/management/dashboard' as any); break;
        default: router.replace('/management/dashboard' as any);
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['8%', '100%'],
  });

  const smokeOpacity = smoke.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.55],
  });

  return (
    <View style={styles.container}>
      <View style={styles.skyGlow} />
      <View style={styles.scene}>
        <Animated.View style={[styles.smoke, { opacity: smokeOpacity, transform: [{ translateX: truckX }] }]} />
        <Animated.View style={[styles.truck, { transform: [{ translateX: truckX }] }]}>
          <View style={styles.truckCab}>
            <View style={styles.windshield} />
            <View style={styles.headlight} />
          </View>
          <View style={styles.trailer}>
            <View style={styles.containerLine} />
            <View style={styles.containerLine} />
          </View>
          <View style={styles.wheelRow}>
            <View style={styles.wheel} />
            <View style={styles.wheel} />
            <View style={styles.wheel} />
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.brand, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={styles.logoMark}>
          <Text style={styles.logoLetters}>TS</Text>
        </View>
        <Text style={styles.brandName}>
          TRUCK<Text style={styles.brandAccent}>SPHERE</Text>
        </Text>
        <Text style={styles.tagline}>Moving. Delivering. Connecting.</Text>
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.loadingText}>{LOADING_MESSAGES[messageIndex]}</Text>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#06111F',
    paddingHorizontal: 28,
  },
  skyGlow: {
    position: 'absolute',
    top: -120,
    left: -80,
    right: -80,
    height: 360,
    backgroundColor: '#0D2742',
    opacity: 0.75,
    borderBottomLeftRadius: 280,
    borderBottomRightRadius: 280,
  },
  scene: {
    flex: 1,
    justifyContent: 'center',
  },
  smoke: {
    position: 'absolute',
    width: 120,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#BFD7F2',
    left: 22,
    top: '52%',
  },
  truck: {
    width: 245,
    height: 116,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  truckCab: {
    width: 82,
    height: 80,
    borderRadius: 14,
    backgroundColor: '#0B5EA8',
    borderWidth: 1,
    borderColor: '#3ED9D6',
    padding: 10,
  },
  windshield: {
    width: 44,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#A7D7FF',
    opacity: 0.55,
  },
  headlight: {
    position: 'absolute',
    right: -4,
    bottom: 18,
    width: 20,
    height: 8,
    borderRadius: 8,
    backgroundColor: '#E7F7FF',
  },
  trailer: {
    width: 150,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#10243A',
    borderWidth: 1,
    borderColor: '#244967',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  containerLine: {
    height: 2,
    borderRadius: 2,
    backgroundColor: '#2F6386',
    marginBottom: 13,
  },
  wheelRow: {
    position: 'absolute',
    bottom: 0,
    left: 36,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wheel: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#050A12',
    borderWidth: 5,
    borderColor: '#46627C',
  },
  brand: {
    position: 'absolute',
    left: 28,
    right: 28,
    top: '58%',
    alignItems: 'center',
  },
  logoMark: {
    width: 74,
    height: 74,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#2EE9D4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  logoLetters: {
    color: '#2EA8FF',
    fontSize: 28,
    fontWeight: '900',
  },
  brandName: {
    color: '#F8FAFC',
    fontSize: 27,
    fontWeight: '900',
  },
  brandAccent: {
    color: '#2EA8FF',
  },
  tagline: {
    color: '#B7C7D8',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  footer: {
    paddingBottom: 54,
  },
  loadingText: {
    color: '#D8E7F6',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#178BFF',
  },
});
