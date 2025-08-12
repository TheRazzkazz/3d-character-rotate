// app/_layout.tsx
import 'react-native-reanimated'; // keep this at the very top (side-effect import)

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/useColorScheme';

// 1) Hide the noisy RN console message
LogBox.ignoreLogs([/EXGL: gl\.pixelStorei\(\) doesn't support this parameter yet!/]);

// 2) Patch EXGL's pixelStorei only for the unsupported enums.
//    We retry a few times because the WebGL constructors may appear after GL is created.
(function patchEXGLPixelStorei() {
  const UNSUPPORTED = new Set([
    0x9243, // UNPACK_COLORSPACE_CONVERSION_WEBGL
    0x9241, // UNPACK_PREMULTIPLY_ALPHA_WEBGL
  ]);

  function tryPatchOnce() {
    // @ts-ignore
    const WebGL1 = global.WebGLRenderingContext;
    // @ts-ignore
    const WebGL2 = global.WebGL2RenderingContext;

    let didPatch = false;
    [WebGL1, WebGL2].forEach((Ctor: any) => {
      if (!Ctor || !Ctor.prototype) return;
      const proto = Ctor.prototype as any;
      if (proto.__exglPixelStoreiPatched) {
        didPatch = true;
        return;
      }
      const orig = proto.pixelStorei;
      if (typeof orig !== 'function') return;

      proto.pixelStorei = function (pname: number, param: any) {
        if (UNSUPPORTED.has(pname)) return; // quietly ignore unsupported hints
        return orig.call(this, pname, param);
      };
      proto.__exglPixelStoreiPatched = true;
      didPatch = true;
    });
    return didPatch;
  }

  // Try now, and then retry up to 10 times with short delays if needed.
  if (!tryPatchOnce()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (tryPatchOnce() || attempts >= 10) clearInterval(timer);
    }, 300);
  }
})();

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
