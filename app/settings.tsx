import React from 'react';
import { StyleSheet, Text, View, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';
import { Card, BottomNavigation } from '@/components/common';
import { useHaptics } from '@/features/haptics';

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useAppTheme();
  const { enabled: hapticsEnabled, toggleEnabled: toggleHaptics } = useHaptics();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background.base }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            Application preferences and hardware calibration.
          </Text>
        </View>

        {/* Theme Settings (Verified Design Tokens) */}
        <Card variant="surface" style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]}>Appearance</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Dark Theme</Text>
              <Text style={[styles.settingSub, { color: colors.text.secondary }]}>
                Tactile Resonance Dark Foundation (#111722)
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border.subtle, true: colors.accent.primary }}
              thumbColor={colors.background.elevated}
            />
          </View>
        </Card>

        {/* Haptics Settings */}
        <Card variant="surface" style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]}>Haptics & Vibration</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>Phone Haptics</Text>
              <Text style={[styles.settingSub, { color: colors.text.secondary }]}>
                Tactile vibration motor actuation during reference learning
              </Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={toggleHaptics}
              trackColor={{ false: colors.border.subtle, true: colors.accent.primary }}
              thumbColor={colors.background.elevated}
            />
          </View>
        </Card>

        {/* Pending Settings Notice (Honest State) */}
        <Card variant="secondary" style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Text style={styles.noticeIcon}>ℹ️</Text>
            <View style={styles.noticeTextCol}>
              <Text style={[styles.noticeTitle, { color: colors.text.primary }]}>
                Settings Design In Progress
              </Text>
              <Text style={[styles.noticeDesc, { color: colors.text.secondary }]}>
                Comprehensive Bluetooth device pairing, audio latency profiles, and profile synchronization will be implemented following design approval.
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      <BottomNavigation activeTab="settings" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 96,
    gap: 16,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  card: {
    padding: 18,
    gap: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  noticeCard: {
    padding: 16,
  },
  noticeHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  noticeIcon: {
    fontSize: 20,
  },
  noticeTextCol: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  noticeDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 18,
  },
});
