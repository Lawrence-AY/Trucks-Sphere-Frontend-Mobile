import React, { ReactNode } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Card as PaperCard } from 'react-native-paper';
import { useTheme } from '../../hooks/useTheme';
import { Spacing } from '../../constants/theme';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: keyof typeof Spacing | number;
}

// PaperCard clones direct children with layout props. Flatten fragments first:
// React.Fragment accepts only children/key, so those injected props cause errors.
function flattenCardChildren(children: ReactNode, parentKey = ''): ReactNode[] {
  return React.Children.toArray(children).flatMap((child) =>
    React.isValidElement<{ children?: ReactNode }>(child) && child.type === React.Fragment
      ? flattenCardChildren(child.props.children, `${parentKey}${child.key}/`)
      : [React.isValidElement(child) ? React.cloneElement(child, { key: `${parentKey}${child.key}` }) : child]
  );
}

export function Card({
  children,
  style,
  variant = 'default',
  padding = 'md',
}: CardProps) {
  const colors = useTheme();
  const content = flattenCardChildren(children);
  const paddingValue = typeof padding === 'number' ? padding : Spacing[padding];
  const sharedProps = {
    style: [styles.card, variant === 'default' && { borderColor: colors.border, borderWidth: 1 }, style],
    contentStyle: { padding: paddingValue },
  };

  if (variant === 'elevated') {
    return <PaperCard mode="elevated" elevation={1} {...sharedProps}>{content}</PaperCard>;
  }

  if (variant === 'outlined') {
    return <PaperCard mode="outlined" {...sharedProps}>{content}</PaperCard>;
  }

  return <PaperCard mode="contained" {...sharedProps}>{content}</PaperCard>;
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.sm,
    minWidth: 0,
  },
});
