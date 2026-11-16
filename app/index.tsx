import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/theme';
import { APP_CONFIG, SENSORY_CHANNELS } from '@/constants';
import { Card, SensoryBadge } from '@/components/common';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Text style={styles.brandIconText}>VB</Text>
            </View>
            <View>
              <Text style={styles.brandTitle}>{APP_CONFIG.name}</Text>
              <Text style={styles.versionBadge}>v{APP_CONFIG.version} • Foundation Milestone</Text>
            </View>
          </View>
          <Text style={styles.tagline}>{APP_CONFIG.tagline}</Text>
        </View>

        {/* Accessibility & Sensory Mission Card */}
        <Card style={styles.card} variant="elevated">
          <Text style={styles.cardTitle}>Three Synchronized Senses</Text>
          <Text style={styles.cardDescription}>
            Designed for Deaf and hard-of-hearing music lovers to experience
            every beat, rhythm, and lyric in harmony.
          </Text>

          <View style={styles.badgeRow}>
            <SensoryBadge
              channel="read"
              label={SENSORY_CHANNELS.READ.label}
              sublabel="Synchronized Lyrics"
            />
            <SensoryBadge
              channel="see"
              label={SENSORY_CHANNELS.SEE.label}
              sublabel="Rhythm Visuals"
            />
            <SensoryBadge
              channel="feel"
              label={SENSORY_CHANNELS.FEEL.label}
              sublabel="Tactile Haptics"
            />
          </View>
        </Card>

        {/* Music Player Placeholder */}
        <Card style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionHeader}>Now Playing</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>Ready for Milestone 2</Text>
            </View>
          </View>
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderIcon}>🎵</Text>
            <Text style={styles.placeholderTitle}>No Track Loaded</Text>
            <Text style={styles.placeholderSubtitle}>
              Audio playback engine with real-time multi-sensory sync will be connected in Milestone 2.
            </Text>
          </View>
        </Card>

        {/* Music Library Placeholder */}
        <Card style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionHeader}>Music Library</Text>
            <Text style={styles.counterText}>0 Tracks</Text>
          </View>
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderIcon}>📂</Text>
            <Text style={styles.placeholderTitle}>Local Library Empty</Text>
            <Text style={styles.placeholderSubtitle}>
              Device file import, ID3 metadata indexing, and offline track storage will be integrated here.
            </Text>
          </View>
        </Card>

        {/* Target Platform Notice */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Distribution Target: {APP_CONFIG.targetPlatform}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.base,
  },
  scrollContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  header: {
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  brandIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.highlight,
    borderWidth: 1,
    borderColor: theme.colors.sensory.read,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.sensory.read,
  },
  brandTitle: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.heavy,
    color: theme.colors.text.primary,
    letterSpacing: -0.5,
  },
  versionBadge: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.medium,
  },
  tagline: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    lineHeight: theme.typography.sizes.sm * theme.typography.lineHeights.normal,
    marginTop: theme.spacing.xs,
  },
  card: {
    gap: theme.spacing.sm,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  cardDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    lineHeight: theme.typography.sizes.sm * theme.typography.lineHeights.normal,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.xs,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeader: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  statusPill: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    backgroundColor: theme.colors.background.highlight,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.bright,
  },
  statusPillText: {
    fontSize: theme.typography.sizes.xs - 2,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.semibold,
  },
  counterText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.weights.semibold,
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background.elevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderStyle: 'dashed',
    gap: theme.spacing.xs,
  },
  placeholderIcon: {
    fontSize: 28,
    marginBottom: theme.spacing.xs,
  },
  placeholderTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
  },
  placeholderSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: theme.typography.sizes.xs * theme.typography.lineHeights.normal,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  footerText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.muted,
  },
});
