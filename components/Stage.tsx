// components/Stage.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber/native';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  useTexture,
} from '@react-three/drei/native';
import * as THREE from 'three';
import Character from './Character';

export type StageProps = {
  rotationY?: number;
  turntableSpeed?: number;      // radians per frame, e.g. 0.003
  autoRotate?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  cameraLimits?: {
    minDistance?: number;
    maxDistance?: number;
    minPolar?: number;
    maxPolar?: number;
  };
  characterYOffset?: number;
  children?: React.ReactNode;
};

/* Deep blue Solo‑Leveling palette */
const PALETTE = {
  bgTop: '#0a1424',
  bgBottom: '#07101d',
  keyBlue: '#4ea3ff',
  rimCyan: '#7ffcff',
  indigo: '#4f46e5',
};

/* Vertical gradient backdrop (cheap, works everywhere) */
function GradientBackground() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color(PALETTE.bgTop) },
      bottomColor: { value: new THREE.Color(PALETTE.bgBottom) },
    }),
    []
  );

  const fragment = `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    varying vec2 vUv;
    void main() {
      float t = vUv.y;
      vec3 col = mix(bottomColor, topColor, t);
      gl_FragColor = vec4(col, 1.0);
    }
  `;
  const vertex = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position =
        projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  return (
    <mesh ref={meshRef} position={[0, 0, -6]}>
      <planeGeometry args={[20, 20]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        fragmentShader={fragment}
        vertexShader={vertex}
      />
    </mesh>
  );
}

/* Stained‑glass hero platform */
function HeroPlatform() {
  const stained = useTexture(
    require('../assets/images/stained-glass-blue.png')
  );
  stained.colorSpace = THREE.SRGBColorSpace;
  stained.wrapS = THREE.ClampToEdgeWrapping;
  stained.wrapT = THREE.ClampToEdgeWrapping;
  stained.minFilter = THREE.LinearMipmapLinearFilter;
  stained.magFilter = THREE.LinearFilter;
  stained.generateMipmaps = true;

  return (
    <group position={[0, 0, 0]}>
      {/* Top stained‑glass disk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.5, 128]} />
        <meshStandardMaterial
          map={stained}
          transparent
          alphaTest={0.5}
          depthWrite
          depthTest
          roughness={0.25}
          metalness={0.1}
          emissive={PALETTE.keyBlue}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Glowing rim */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <torusGeometry args={[1.52, 0.06, 64, 256]} />
        <meshStandardMaterial
          color={PALETTE.keyBlue}
          emissive={PALETTE.keyBlue}
          emissiveIntensity={1.1}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* Soft underglow halo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[1.7, 64]} />
        <meshBasicMaterial
          color={PALETTE.keyBlue}
          transparent
          opacity={0.18}
        />
      </mesh>
    </group>
  );
}

/* Cinematic blue + cyan lighting */
function Lights() {
  return (
    <>
      <directionalLight
        position={[-3, 6, 4]}
        intensity={2.2}
        color={PALETTE.keyBlue}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight
        position={[3, 5, -4]}
        intensity={1.6}
        color={PALETTE.rimCyan}
      />
      <ambientLight intensity={0.25} />
      <spotLight
        position={[0, 6.5, 0]}
        angle={0.7}
        penumbra={0.6}
        intensity={1.5}
        color={PALETTE.indigo}
        castShadow
      />
    </>
  );
}

export default function Stage({
  rotationY = 0,
  turntableSpeed = 0,
  autoRotate = true,
  onStart,
  onEnd,
  cameraLimits,
  characterYOffset = 0,
  children,
}: StageProps) {
  const group = useRef<THREE.Group>(null!);
  const controls = useRef<any>(null);
  const { gl } = useThree();

  /* Smooth model rotation with optional turntable motion */
  useFrame(() => {
    const current = group.current.rotation.y;
    group.current.rotation.y =
      current + (rotationY - current) * 0.15 + turntableSpeed;
  });

  /* Color/tone mapping */
  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
  }, [gl]);

  useEffect(() => {
    if (controls.current) controls.current.autoRotate = autoRotate;
  }, [autoRotate]);

  const {
    minDistance = 3.2,
    maxDistance = 7.2,
    minPolar = Math.PI * 0.2,
    maxPolar = Math.PI * 0.44,
  } = cameraLimits || {};

  return (
    <>
      {/* Depth/atmosphere */}
      <fog attach="fog" args={[PALETTE.bgBottom, 8, 18]} />

      {/* Backdrop + lights */}
      <GradientBackground />
      <Lights />

      {/* Platform + ground shadow (rotates with model) */}
      <group ref={group}>
        <group position={[0, 0, 0]}>
          <HeroPlatform />
          <ContactShadows
            position={[0, 0, 0]}
            scale={6}
            blur={2.2}
            far={2.8}
            opacity={0.42}
          />
        </group>

        {/* Character slot */}
        <group position={[0, characterYOffset, 0]} castShadow>
          {children ?? <Character />}
        </group>
      </group>

      {/* Subtle reflections */}
      <Environment preset="night" />

      {/* Orbit controls – purely Three.js, no React Native views */}
      <OrbitControls
        ref={controls}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
        minDistance={minDistance}
        maxDistance={maxDistance}
        minPolarAngle={minPolar}
        maxPolarAngle={maxPolar}
        enableZoom={false}
        touches={{ ONE: 1, TWO: 0, THREE: 0 }}
        onStart={onStart}
        onEnd={onEnd}
      />
    </>
  );
}
