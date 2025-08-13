import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function AvatarCreate() {
  const router = useRouter();

  const injectedJS = useMemo(
    () => `
    (function () {
      function parse(d){ try { return typeof d==='string' ? JSON.parse(d) : d; } catch(e){ return null; } }
      function onMsg(event) {
        const msg = parse(event.data);
        if (!msg || msg.source !== 'readyplayerme') return;

        if (msg.eventName === 'v1.frame.ready') {
          window.postMessage(JSON.stringify({
            target: 'readyplayerme',
            type: 'subscribe',
            eventName: 'v1.**'
          }), '*');
        }

        window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      }
      window.addEventListener('message', onMsg);
      document.addEventListener('message', onMsg);
    })();
    true;
  `,
    []
  );

  async function onMessage(e: any) {
    try {
      const msg = JSON.parse(e.nativeEvent.data);

      if (msg.eventName === 'v1.avatar.exported' || msg.eventName === 'v2.avatar.exported') {
        const url: string | undefined = msg?.data?.url;
        const avatarId: string | undefined = msg?.data?.avatarId;

        if (url) {
          await AsyncStorage.setItem('avatarUrl', url);
        }
        if (avatarId) {
          await AsyncStorage.setItem('avatarId', avatarId);
        }

        Alert.alert('Avatar saved', 'Opening preview…');
        router.replace('/avatar-preview');
      }
    } catch {
      // ignore parse errors
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={{ uri: 'https://readyplayer.me/avatar?frameApi' }}
        injectedJavaScript={injectedJS}
        onMessage={onMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator />
          </View>
        )}
      />
    </View>
  );
}
