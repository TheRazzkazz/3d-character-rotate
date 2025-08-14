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
        // Mobile-friendly defaults
        dpr={[1, 2]}
        shadows
        camera={{ position: [0, 1.65, 2.2], fov: 38, near: 0.1, far: 100 }}
        onCreated={({ gl, camera }) => {
          // --- Safe renderer color/tone settings
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;

          // Initial framing: slight downward tilt toward upper chest (~1.35m)
          camera.fov = 38;
          camera.position.set(0, 1.65, 2.2);
          camera.lookAt(0, 1.35, 0);
          camera.updateProjectionMatrix();

          // --- Access renderer + raw WebGL context
          const renderer: any = gl;
          const ctx: any =
            typeof renderer.getContext === 'function'
              ? renderer.getContext()
              : undefined;

          // --- HARD DISABLE ANISOTROPY (mobile-safe)
          if (ctx && typeof ctx.getExtension === 'function') {
            const origGetExtension = ctx.getExtension.bind(ctx);

            ctx.getExtension = (name: string) => {
              // If anything asks for anisotropy, return a harmless stub.
              if (
                name === 'EXT_texture_filter_anisotropic' ||
                name === 'WEBKIT_EXT_texture_filter_anisotropic' ||
                name === 'MOZ_EXT_texture_filter_anisotropic'
              ) {
                return {
                  // Standard enum values; keep MAX at 1 to effectively disable the feature.
                  TEXTURE_MAX_ANISOTROPY_EXT: 0x84fe,
                  MAX_TEXTURE_MAX_ANISOTROPY_EXT: 1,
                };
              }
              // Otherwise, fall back to the real extension fetch.
              return origGetExtension(name);
            };
          }

          // --- SILENCE EXGL pixelStorei warnings (no-op unsupported parameters)
          if (ctx && typeof ctx.pixelStorei === 'function') {
            const origPixelStorei = ctx.pixelStorei.bind(ctx);

            // Numeric fallbacks if EXGL doesn't expose these constants
            const P_UNPACK_FLIP_Y = ctx.UNPACK_FLIP_Y_WEBGL ?? 0x9240; // 37440
            const P_UNPACK_PREMULTIPLY =
              ctx.UNPACK_PREMULTIPLY_ALPHA_WEBGL ?? 0x9241; // 37441
            const P_UNPACK_COLORSPACE =
              ctx.UNPACK_COLORSPACE_CONVERSION_WEBGL ?? 0x9243; // 37443
            // WebGL2-style (often unsupported on EXGL)
            const P_UNPACK_ROW_LENGTH = ctx.UNPACK_ROW_LENGTH ?? 0x0cf2; // 3314
            const P_UNPACK_SKIP_ROWS = ctx.UNPACK_SKIP_ROWS ?? 0x0cf3; // 3315
            const P_UNPACK_SKIP_PIXELS = ctx.UNPACK_SKIP_PIXELS ?? 0x0cf4; // 3316

            const unsupported = new Set<number>([
              P_UNPACK_FLIP_Y,
              P_UNPACK_PREMULTIPLY,
              P_UNPACK_COLORSPACE,
              P_UNPACK_ROW_LENGTH,
              P_UNPACK_SKIP_ROWS,
              P_UNPACK_SKIP_PIXELS,
            ]);

            ctx.pixelStorei = (pname: number, param: any) => {
              if (unsupported.has(pname)) {
                // Quietly ignore unsupported pixelStorei params on EXGL
                return;
              }
              try {
                origPixelStorei(pname, param);
              } catch {
                // Swallow rare EXGL throws to avoid log spam
              }
            };
          }

          // --- Normalize Three.js capabilities so everything sees anisotropy = 1 (off)
          const caps = (renderer.capabilities ??= {});
          caps.maxAnisotropy = 1;
          caps.getMaxAnisotropy = () => 1;
        }}
      >
        {/* Scene content */}
        <Stage /* debug={debug} */>
          <Character /* debug={debug} */ />
        </Stage>
        {/* NOTE: No per-frame CameraRig here, so OrbitControls can rotate freely */}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050b14' },
});
