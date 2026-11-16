import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';

interface SensoryBadgeProps {
  channel: 'read' | 'see' | 'feel';
  label: string;
  sublabel?: string;
}

export const SensoryBadge: React.FC<SensoryBadgeProps> = ({
  channel,
  label,
  sublabel,
}) => {
  const accentColor = theme.colors.sensory[channel];

  return (
    <View style={[styles.badge, { borderColor: accentColor }]}>
      <View style={[styles.dot, { backgroundColor: accentColor }]} />
      <View style={styles.textContainer}>
        <Text style={[styles.label, { color: accentColor }]}>{label}</Text>
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    backgroundColor: theme.colors.background.elevated,
    marginRight: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.xs,
  },
  textContainer: {
    flexDirection: 'column',
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 0.5,
  },
  sublabel: {
    fontSize: theme.typography.sizes.xs - 2,
    color: theme.colors.text.secondary,
  },
});
