import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas } from '@react-three/fiber/native';
import * as THREE from 'three';

// ⬇️ adjust these import paths ONLY if your folders differ
import Stage from '../components/Stage';
import Character from '../components/Character';

export default function CharacterRotate() {
  return (
    <View style={styles.container}>
      <Canvas
        shadows
        camera={{ position: [0, 1.8, 5], fov: 42, near: 0.1, far: 100 }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
        }}
      >
        {/* Keep camera autorotate OFF; gentle character idle spin via turntableSpeed */}
        <Stage turntableSpeed={0.000} characterYOffset={0.75}>
          <Character />
        </Stage>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050b14' },
});
