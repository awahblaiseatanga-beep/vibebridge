import React from 'react';
import { Stack } from 'expo-router';
import { theme } from '@/theme';

export default function LearnLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.colors.background.base,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="library" />
      <Stack.Screen name="select" />
      <Stack.Screen name="teacher" />
      <Stack.Screen name="practice" />
      <Stack.Screen name="results" />
    </Stack>
  );
}
