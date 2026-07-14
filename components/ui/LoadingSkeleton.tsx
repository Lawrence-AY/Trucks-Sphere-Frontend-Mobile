import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Spacing, Radius } from '../../constants/theme';

interface LoadingSkeletonProps {
  lines?: number;
  lineHeight?: number;
  variant?: 'card' | 'list' | 'detail';
}

export function LoadingSkeleton({
  lines = 3,
  lineHeight = 16,
  variant = 'list',
}: LoadingSkeletonProps) {
  const colors = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  if (variant === 'card') {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Animated.View
          style={[
            styles.block,
            { height: 180, opacity, backgroundColor: colors.inputBg },
          ]}
        />
        <View style={styles.cardBody}>
          {Array.from({ length: lines }).map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.line,
                {
                  height: lineHeight,
                  opacity,
                  backgroundColor: colors.inputBg,
                  width: i === lines - 1 ? '60%' : '100%',
                },
              ]}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {Array.from({ length: lines }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.line,
            {
              height: lineHeight,
              opacity,
              backgroundColor: colors.inputBg,
              width: i === lines - 1 ? '40%' : '100%',
              marginBottom: Spacing.sm,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  cardBody: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  block: {
    borderRadius: Radius.md,
  },
  line: {
    borderRadius: 4,
  },
});
