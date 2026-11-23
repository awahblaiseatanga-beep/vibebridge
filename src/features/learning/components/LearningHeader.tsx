/**
 * LearningHeader
 *
 * Consistent header for VibeBridge Tactile Drum Academy screens.
 * Provides accessible back-navigation, step progress indicator, and title.
 */

import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/theme';

interface LearningHeaderProps {
  title: string;
  subtitle?: string;
  step?: number;      // 1 to 4
  totalSteps?: number; // default 4
  showBack?: boolean;
  onBackPress?: () => void;
  rightAction?: {
    label: string;
    onPress: () => void;
  };
}

export const LearningHeader: React.FC<LearningHeaderProps> = ({
  title,
  subtitle,
  step,
  totalSteps = 4,
  showBack = true,
  onBackPress,
  rightAction,
}) => {
  const router = useRouter();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityLabel="Go back to previous screen"
            accessibilityRole="button"
          >
            <Text style={styles.backButtonIcon}>←</Text>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}

        {step !== undefined && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepText}>
              Step {step} of {totalSteps}
            </Text>
            <View style={styles.stepDots}>
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    idx + 1 === step && styles.dotActive,
                    idx + 1 < step && styles.dotCompleted,
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {rightAction ? (
          <TouchableOpacity
            style={styles.rightButton}
            onPress={rightAction.onPress}
            accessibilityRole="button"
          >
            <Text style={styles.rightButtonText}>{rightAction.label}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.background.surface,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    gap: 4,
  },
  backButtonIcon: {
    fontSize: 16,
    color: theme.colors.sensory.read,
    fontWeight: '700',
  },
  backButtonText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weights.semibold,
  },
  stepContainer: {
    alignItems: 'center',
    gap: 4,
  },
  stepText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepDots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.border.bright,
  },
  dotActive: {
    width: 18,
    backgroundColor: theme.colors.sensory.feel,
  },
  dotCompleted: {
    backgroundColor: theme.colors.sensory.see,
  },
  rightButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.background.surface,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  rightButtonText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.medium,
  },
  placeholder: {
    width: 60,
  },
  titleContainer: {
    marginTop: theme.spacing.xs,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    lineHeight: theme.typography.sizes.sm * theme.typography.lineHeights.normal,
    marginTop: 2,
  },
});
