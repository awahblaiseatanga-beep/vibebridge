import React from 'react';
import { Stack } from 'expo-router';
import { useAppTheme } from '@/theme';

export default function PlayerLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background.base,
        },
        animation: 'slide_from_bottom',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="immersive" options={{ animation: 'fade' }} />
    </Stack>
  );
}
