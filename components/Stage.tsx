// components/Stage.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber/native';
import {
  OrbitControls,
  Environment,
  ContactShadows,
  useTexture,
} from '@react-three/drei/native';
import * as THREE from 'three';
import Character from './Character';

export type StageProps = {
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
stained.wrapS = THREE.RepeatWrapping;
  stained.wrapT = THREE.RepeatWrapping;
  stained.repeat.set(1, 1);
  stained.offset.set(0, 0);
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
  onStart,
  onEnd,
  cameraLimits,
  characterYOffset = 0,
  children,
}: StageProps) {
  const stageRef = useRef<THREE.Group>(null);
  const controls = useRef<any>(null);
  const { gl } = useThree();

  /* Color/tone mapping */
  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
  }, [gl]);

  /* Center orbit controls on stage */
  useEffect(() => {
    if (controls.current) {
      controls.current.target.set(0, 1.6, 0);
      controls.current.update();
    }
  }, []);

  const {
    minDistance = 0.5,
    maxDistance = 6,
    minPolar = Math.PI * 0.35,
    maxPolar = Math.PI * 0.95,
  } = cameraLimits || {};

  return (
    <>
      {/* Depth/atmosphere */}
      <fog attach="fog" args={[PALETTE.bgBottom, 8, 18]} />

      {/* Backdrop + lights */}
      <GradientBackground />
      <Lights />

      {/* Platform + ground shadow */}
      <group ref={stageRef} position={[0, 0, 0]}>
        <HeroPlatform />
        {/* <ContactShadows
          position={[0, 0, 0]}
          scale={6}
          blur={2.2}
          far={2.8}
          opacity={0.42}
        /> */}
        {/* Character slot */}
        <group position={[0, characterYOffset, 0]} castShadow>
          {children ?? <Character />}
        </group>
      </group>

      {/* Subtle reflections */}
      <Environment preset="night" />

      {/* Orbit controls */}
      <OrbitControls
        ref={controls}
        makeDefault
        autoRotate={false}
        enablePan={false}
        enableZoom
        enableRotate
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.9}
        minDistance={minDistance}
        maxDistance={maxDistance}
        minPolarAngle={minPolar}
        maxPolarAngle={maxPolar}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY }}
        onStart={onStart}
        onEnd={onEnd}
      />
    </>
  );
}
