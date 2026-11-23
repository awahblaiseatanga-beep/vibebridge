import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';

export interface BottomNavigationProps {
  activeTab?: 'academy' | 'progress' | 'settings';
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab }) => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  const currentTab = activeTab || (
    pathname.includes('progress')
      ? 'progress'
      : pathname.includes('settings')
      ? 'settings'
      : 'academy'
  );

  const tabs = [
    {
      id: 'academy' as const,
      label: 'Academy',
      icon: '🏫',
      route: '/learn',
    },
    {
      id: 'progress' as const,
      label: 'Progress',
      icon: '📊',
      route: '/progress',
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: '⚙️',
      route: '/settings',
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(17, 23, 34, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderTopColor: colors.border.subtle,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <View style={styles.tabsRow}>
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabButton}
              activeOpacity={0.7}
              onPress={() => {
                router.push(tab.route as any);
              }}
              accessibilityRole="tab"
              accessibilityLabel={`${tab.label} tab`}
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.tabIcon,
                  { opacity: isActive ? 1 : 0.6 },
                ]}
              >
                {tab.icon}
              </Text>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? colors.accent.primary : colors.text.secondary,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 52,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 4,
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
