import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas } from '@react-three/fiber/native';
import * as THREE from 'three';

import Stage from '../components/Stage';
import Character from '../components/Character';

export default function CharacterRotate() {
    const debug = process.env.NODE_ENV !== 'production';
  return (
    <View style={styles.container}>
      <Canvas
        shadows
        camera={{ position: [0, 1.8, 5], fov: 42 }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
        }}
      >
<Stage debug={debug}>
          <Character debug={debug} />
        </Stage>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050b14' },
});
