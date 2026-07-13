import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/theme';
import { getStatusColor, formatStatus } from '../utils/helpers';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  showDot = true,
}) => {
  const statusColor = getStatusColor(status);
  const label = formatStatus(status);

  const sizeConfig = {
    sm: { padding: Spacing.xs + 2, fontSize: 11, dotSize: 6 },
    md: { padding: Spacing.sm, fontSize: 12, dotSize: 7 },
    lg: { padding: Spacing.md, fontSize: 13, dotSize: 8 },
  };

  const config = sizeConfig[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: statusColor + '18',
          paddingHorizontal: config.padding,
          paddingVertical: config.padding * 0.6,
        },
      ]}
    >
      {showDot && (
        <View
          style={[
            styles.dot,
            {
              width: config.dotSize,
              height: config.dotSize,
              borderRadius: config.dotSize / 2,
              backgroundColor: statusColor,
            },
          ]}
        />
      )}
      <Text
        style={[
          styles.label,
          {
            color: statusColor,
            fontSize: config.fontSize,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    marginRight: Spacing.xs,
  },
  label: {
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});

export default StatusBadge;
