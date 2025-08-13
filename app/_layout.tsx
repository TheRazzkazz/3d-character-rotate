// app/_layout.tsx
import 'react-native-reanimated'; // keep this at the very top (side-effect import)

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { GLView } from 'expo-gl';
import { useColorScheme } from '@/hooks/useColorScheme';

// 1) Hide the noisy RN console message
LogBox.ignoreLogs([/EXGL: gl\.pixelStorei\(\) doesn't support this parameter yet!/]);

const origCreateContextAsync = GLView.prototype.createContextAsync;
GLView.prototype.createContextAsync = async function (...args) {
  const gl = await origCreateContextAsync.apply(this, args);
  const origPixelStorei = gl.pixelStorei.bind(gl);
  gl.pixelStorei = (pname: number, param: any) => {
    if (pname === 0x9243 || pname === 0x9241) return; // unsupported enums
    return origPixelStorei(pname, param);
  };
  return gl;
};


export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // In dev, this prevents a flash while fonts load.
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
