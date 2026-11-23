import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useAppTheme } from '@/theme';

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'surface' | 'secondary' | 'elevated' | 'highlight';
  radius?: 'default' | 'large' | 'hero';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'surface',
  radius = 'default',
}) => {
  const { colors, isDark } = useAppTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case 'elevated':
        return colors.background.elevated;
      case 'secondary':
        return colors.background.secondary;
      case 'highlight':
        return colors.background.highlight;
      case 'surface':
      default:
        return colors.background.surface;
    }
  };

  const getBorderRadius = () => {
    switch (radius) {
      case 'hero':
        return 24;
      case 'large':
        return 20;
      case 'default':
      default:
        return 16;
    }
  };

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: colors.border.subtle,
          borderRadius: getBorderRadius(),
          shadowColor: isDark ? '#000000' : '#202638',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
