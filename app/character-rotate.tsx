// app/character-rotate.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas } from '@react-three/fiber/native';
import * as THREE from 'three';
import Stage from '../components/Stage';

export default function CharacterRotateScreen() {
  return (
    <View style={styles.fill}>
      <Canvas
        shadows
        dpr={[1, 2]}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color('#0b1220'), 1)}
        camera={{ position: [0, 1.3, 3.3], fov: 50 }}
      >
        <Stage />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
});
