// app/(tabs)/index.tsx
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Welcome</Text>

      {/* View Avatar (2D) */}
      <Link href="/avatar-preview" asChild>
        <TouchableOpacity style={[styles.btnBox, styles.btnPrimary, { marginBottom: 12 }]}>
          <Text style={styles.btnPrimaryText}>View Avatar (2D)</Text>
        </TouchableOpacity>
      </Link>

      {/* View Avatar (3D) → character-rotate */}
      <Link href="/character-rotate" asChild>
        <Pressable style={[styles.btnBox, styles.btnWhite]}>
          <Text style={styles.btnWhiteText}>View Avatar (3D)</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b1220',
    padding: 20,
  },
  title: { color: 'white', fontSize: 22, marginBottom: 16 },
  btnBox: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    minWidth: 220,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: '#14532d' },
  btnPrimaryText: { color: '#fff', fontWeight: 'bold' },
  btnWhite: { backgroundColor: 'white' },
  btnWhiteText: { color: '#14532d', fontWeight: 'bold' },
});
