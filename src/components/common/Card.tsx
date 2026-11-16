import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { theme } from '@/theme';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  variant?: 'surface' | 'elevated' | 'highlight';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'surface',
}) => {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'elevated':
        return theme.colors.background.elevated;
      case 'highlight':
        return theme.colors.background.highlight;
      case 'surface':
      default:
        return theme.colors.background.surface;
    }
  };

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: getBackgroundColor() },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    padding: theme.spacing.md,
  },
});
