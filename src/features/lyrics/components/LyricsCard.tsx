/**
 * LyricsCard Component (READ Pillar)
 *
 * Real-time synchronized lyrics card displaying:
 * - Active lyric line (primary readable element, bold Sky Cyan highlight, WCAG AAA contrast).
 * - Previous lyric line (secondary reduced emphasis).
 * - Upcoming lyric lines (secondary subdued preview).
 * - Explicit instrumental gap / transition indicators.
 * - Prominent demonstration transparency label when displaying demo lyrics.
 * - Graceful fallback when tracks have no lyrics metadata.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '@/theme';
import { Card } from '@/components/common';
import { useLyrics } from '../useLyrics';

export const LyricsCard: React.FC = () => {
  const {
    hasLyrics,
    isDemonstration,
    demonstrationLabel,
    status,
    activeSegment,
    previousSegment,
    upcomingSegments,
    activeIndex,
    totalSegmentsCount,
  } = useLyrics();

  return (
    <Card style={styles.card} variant="elevated">
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <View style={styles.titleWithBadge}>
            <Text style={styles.sectionTitle}>Synchronized Lyrics</Text>
            <View style={styles.readPillarBadge}>
              <Text style={styles.readPillarBadgeText}>READ</Text>
            </View>
          </View>
          {isDemonstration && (
            <View style={styles.demoBanner}>
              <Text style={styles.demoBannerText}>
                {demonstrationLabel || 'Demo Lyrics · Synchronized to 120 BPM Stem'}
              </Text>
            </View>
          )}
        </View>

        {hasLyrics && (
          <View style={styles.counterBadge}>
            <Text style={styles.counterBadgeText}>
              {status === 'active' && activeIndex >= 0
                ? `${activeIndex + 1} / ${totalSegmentsCount}`
                : status === 'before_lyrics'
                ? 'INTRO'
                : status === 'after_lyrics'
                ? 'OUTRO'
                : 'REST'}
            </Text>
          </View>
        )}
      </View>

      {/* Main Lyrics Viewport */}
      {!hasLyrics ? (
        // Empty / No-Lyrics State
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📄</Text>
          <Text style={styles.emptyTitle}>No Lyrics for This Track</Text>
          <Text style={styles.emptySubtitle}>
            Instrumental audio playback, SEE visual rhythms, and FEEL tactile haptics remain fully active.
          </Text>
        </View>
      ) : (
        <View style={styles.lyricsViewport}>
          {/* Previous Line (Reduced Emphasis) */}
          <View style={styles.previousLineContainer}>
            {previousSegment ? (
              <Text style={styles.previousLineText} numberOfLines={1}>
                {previousSegment.text}
              </Text>
            ) : (
              <Text style={styles.linePlaceholderText}>—</Text>
            )}
          </View>

          {/* Active Line (Primary Readable Element) */}
          <View
            style={[
              styles.activeLineContainer,
              status === 'active' && styles.activeLineContainerHighlight,
              status === 'instrumental_gap' && styles.gapLineContainer,
            ]}
          >
            {status === 'active' && activeSegment ? (
              <View style={styles.activeTextWrapper}>
                {activeSegment.speaker && (
                  <View style={styles.speakerBadge}>
                    <Text style={styles.speakerText}>{activeSegment.speaker}</Text>
                  </View>
                )}
                <Text style={styles.activeLineText}>{activeSegment.text}</Text>
                {activeSegment.translation && (
                  <Text style={styles.translationText}>{activeSegment.translation}</Text>
                )}
              </View>
            ) : status === 'instrumental_gap' ? (
              <View style={styles.transitionWrapper}>
                <Text style={styles.transitionIcon}>♫</Text>
                <Text style={styles.transitionText}>Instrumental Break</Text>
                <Text style={styles.transitionIcon}>♫</Text>
              </View>
            ) : status === 'before_lyrics' ? (
              <View style={styles.transitionWrapper}>
                <Text style={styles.transitionIcon}>♫</Text>
                <Text style={styles.transitionText}>Intro — Lyrics start shortly</Text>
                <Text style={styles.transitionIcon}>♫</Text>
              </View>
            ) : (
              <View style={styles.transitionWrapper}>
                <Text style={styles.transitionIcon}>♫</Text>
                <Text style={styles.transitionText}>Track Resolution</Text>
                <Text style={styles.transitionIcon}>♫</Text>
              </View>
            )}
          </View>

          {/* Upcoming Lines (Secondary Subdued Preview) */}
          <View style={styles.upcomingLinesContainer}>
            {upcomingSegments.length > 0 ? (
              <>
                <Text style={styles.upcomingLineTextPrimary} numberOfLines={1}>
                  {upcomingSegments[0].text}
                </Text>
                {upcomingSegments.length > 1 && (
                  <Text style={styles.upcomingLineTextSecondary} numberOfLines={1}>
                    {upcomingSegments[1].text}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.linePlaceholderText}>
                {status === 'after_lyrics' ? 'End of lyrics' : '—'}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Footer Info */}
      <View style={styles.footerRow}>
        <Text style={styles.footerNote}>
          Master Clock Sync • Zero Latency Drift
        </Text>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.surface,
    borderColor: theme.colors.border.subtle,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  titleContainer: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
  },
  readPillarBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  readPillarBadgeText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.sensory.read,
    letterSpacing: 0.5,
  },
  demoBanner: {
    marginTop: theme.spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.background.highlight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  demoBannerText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.sensory.read,
  },
  counterBadge: {
    backgroundColor: theme.colors.background.elevated,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
  },
  counterBadgeText: {
    fontSize: 11,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.secondary,
  },
  lyricsViewport: {
    marginVertical: theme.spacing.xs,
  },
  previousLineContainer: {
    minHeight: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  previousLineText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.muted,
    opacity: 0.45,
    textAlign: 'center',
    fontWeight: theme.typography.weights.regular,
  },
  activeLineContainer: {
    minHeight: 64,
    backgroundColor: theme.colors.background.elevated,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border.medium,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: theme.spacing.xxs,
  },
  activeLineContainerHighlight: {
    borderColor: theme.colors.sensory.read,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  gapLineContainer: {
    borderColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.background.base,
    borderStyle: 'dashed',
  },
  activeTextWrapper: {
    alignItems: 'center',
  },
  speakerBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.xs,
    marginBottom: 4,
  },
  speakerText: {
    fontSize: 10,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.sensory.read,
    textTransform: 'uppercase',
  },
  activeLineText: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.sensory.read,
    textAlign: 'center',
    lineHeight: 28,
  },
  translationText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  transitionWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  transitionIcon: {
    fontSize: 14,
    color: theme.colors.text.muted,
  },
  transitionText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text.muted,
    fontStyle: 'italic',
    fontWeight: theme.typography.weights.medium,
  },
  upcomingLinesContainer: {
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    gap: 3,
  },
  upcomingLineTextPrimary: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    opacity: 0.7,
    textAlign: 'center',
    fontWeight: theme.typography.weights.regular,
  },
  upcomingLineTextSecondary: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.muted,
    opacity: 0.4,
    textAlign: 'center',
  },
  linePlaceholderText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.muted,
    opacity: 0.3,
    textAlign: 'center',
  },
  emptyContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: theme.spacing.xs,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.muted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: theme.spacing.md,
  },
  footerRow: {
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.subtle,
    paddingTop: theme.spacing.xs,
    alignItems: 'center',
  },
  footerNote: {
    fontSize: 10,
    color: theme.colors.text.muted,
  },
});
