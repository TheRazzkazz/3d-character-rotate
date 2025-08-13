import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';

const FALLBACK_AVATAR_ID = '689b9e04c911aabc2e9c587f';

export default function AvatarPreviewScreen() {
  const [avatarId, setAvatarId] = useState<string>(FALLBACK_AVATAR_ID);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [storedId, storedUrl] = await Promise.all([
          AsyncStorage.getItem('avatarId'),
          AsyncStorage.getItem('avatarUrl'),
        ]);

        if (storedId) {
          setAvatarId(storedId);
        } else if (storedUrl) {
          const match = storedUrl.match(/readyplayer\\.me\\/([^/]+)\\.glb/i);
          if (match && match[1]) {
            setAvatarId(match[1]);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const pngUrl = `https://models.readyplayer.me/${avatarId}.png?size=512&camera=portrait&expression=neutral`;

  return (
    <SafeAreaView style={styles.center}>
      <View style={styles.card}>
        <ExpoImage source={{ uri: pngUrl }} style={styles.avatar} contentFit="contain" />
      </View>
      <Text style={styles.caption}>My Ready Player Me Avatar</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: 280,
    height: 320,
    backgroundColor: '#101826',
    borderRadius: 18,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: { width: '100%', height: '100%' },
  caption: { marginTop: 12, fontSize: 16, color: '#cbd5e1' },
});
