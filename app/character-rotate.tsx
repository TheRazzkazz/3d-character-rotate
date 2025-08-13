// app/character-rotate.tsx
import React, { useRef, useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State,
  TapGestureHandler,
} from 'react-native-gesture-handler';
import { Canvas } from '@react-three/fiber/native';
import { ContactShadows, Float } from '@react-three/drei/native';
import * as THREE from 'three';
import Stage from '../components/Stage';

export default function CharacterRotateScreen() {
  const [rotationY, setRotationY] = useState(0);
  const dragBase = useRef(0);
  const [autoRotate, setAutoRotate] = useState(true);

  // Drag to rotate (same behavior as before)
  const onGestureEvent = (e: PanGestureHandlerGestureEvent) => {
    const dx = e.nativeEvent.translationX;
    setRotationY(dragBase.current + dx / 150); // sensitivity
  };

  const onHandlerStateChange = (e: any) => {
    if (e.nativeEvent.state === State.BEGAN) {
      dragBase.current = rotationY;
      setAutoRotate(false); // pause auto-rotate while user interacts
    }
    if (e.nativeEvent.state === State.END || e.nativeEvent.state === State.CANCELLED) {
      dragBase.current = rotationY;
      // auto-rotate stays off until user double-taps to toggle back on
    }
  };

  // Double‑tap anywhere to toggle auto‑rotate
  const onDoubleTap = () => setAutoRotate(v => !v);

  // Slow turntable when auto‑rotate is enabled
  const turntable = useMemo(() => (autoRotate ? 0.003 : 0), [autoRotate]);

  return (
    <TapGestureHandler numberOfTaps={2} onActivated={onDoubleTap} maxDelayMs={260}>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <View style={styles.fill}>
          <Canvas
            shadows
            dpr={[1, 2]}
            onCreated={({ gl }) => {
              const origPixelStorei = gl.pixelStorei.bind(gl);
              gl.pixelStorei = (pname: number, param: any) => {
                if (pname === 0x9243 || pname === 0x9241) return; // ignore unsupported enums
                return origPixelStorei(pname, param);
              };
              gl.setClearColor(new THREE.Color('#0b1220'), 1);
            }}
            camera={{ position: [0, 1.3, 3.3], fov: 50 }}
          >
            {/* Lighting (kept) */}
            <hemisphereLight intensity={0.8} groundColor={'#223'} />
            <directionalLight
              position={[2, 4, 3]}
              intensity={1.2}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />

            {/* Grounded soft shadow under the floating platform/character */}
            <ContactShadows
              position={[0, -0.5, 0]}
              opacity={0.42}
              scale={4}
              blur={2.0}
              far={4}
              resolution={1024}
              frames={1}
            />

            {/* Float BOTH platform + character (platform lives inside Stage) */}
            <Float speed={1.1} floatIntensity={0.55} rotationIntensity={0}>
              <Stage rotationY={rotationY} turntableSpeed={turntable} />
            </Float>
          </Canvas>
        </View>
      </PanGestureHandler>
    </TapGestureHandler>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
});
