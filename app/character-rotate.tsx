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
          // --- Color / tone mapping (your existing setup)
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;

          // --- CRASH GUARD: Shim anisotropy extension & caps at the renderer level
          const anyGl: any = gl;

          // Patch getExtension so code that expects the anisotropy ext never crashes
          const origGetExtension = anyGl.getExtension?.bind(anyGl);
          anyGl.getExtension = (name: string) => {
            const ext = origGetExtension ? origGetExtension(name) : null;
            // Do not stub anisotropy extension; use renderer capabilities instead
            return ext;
          };

          // Normalize capabilities so helper code has something sane to read
          const caps: any = anyGl.capabilities ?? (anyGl.capabilities = {});
          if (typeof caps.getMaxAnisotropy !== 'function') {
            caps.getMaxAnisotropy = () =>
              typeof caps.maxAnisotropy === 'number' ? caps.maxAnisotropy : 1;
          }
          if (typeof caps.maxAnisotropy !== 'number') {
            caps.maxAnisotropy = 1;
          }

          // Optional: one-line sanity log (remove if noisy)
          // console.log('[GL] caps.maxAnisotropy =', caps.maxAnisotropy);
        }}
      >
        {/* Stage doesn’t need a debug prop, but harmless if present */}
        <Stage /* debug={debug} */>
          <Character /* debug={debug} */ />
        </Stage>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050b14' },
});
