// components/Stage.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber/native';
import { OrbitControls, Environment, useTexture } from '@react-three/drei/native';
import * as THREE from 'three';
import Character from './Character';
import { getSafeAnisotropy } from '../utils/glCaps';

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

/* Sanctum palette */
const PALETTE = {
  // Background tones
  bgTop: '#0a1321',        // midnight indigo
  bgBottom: '#05080d',     // blue-black
  vignetteTeal: '#0d2a33', // faint teal at edges
  // Lighting/accents
  keyBlue: '#4ea3ff',
  rimCyan: '#7ffcff',
  indigo: '#4f46e5',
};

/* Gradient + teal vignette backdrop (mobile-cheap) */
function GradientBackground() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color(PALETTE.bgTop) },
      bottomColor: { value: new THREE.Color(PALETTE.bgBottom) },
      vignetteColor: { value: new THREE.Color(PALETTE.vignetteTeal) },
      vignetteRadius: { value: 0.78 },   // where vignette starts (0..1)
      vignetteSoftness: { value: 0.38 }, // larger = softer edge
      centerBoost: { value: 0.06 },      // subtle lift in the center
      tealAmount: { value: 0.35 },       // how teal the very edge becomes
    }),
    []
  );

  const fragment = `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform vec3 vignetteColor;
    uniform float vignetteRadius;
    uniform float vignetteSoftness;
    uniform float centerBoost;
    uniform float tealAmount;
    varying vec2 vUv;

    void main() {
      // Vertical gradient (bottom -> top)
      float t = vUv.y;
      vec3 col = mix(bottomColor, topColor, t);

      // Radial vignette (center -> edges)
      vec2 p = vUv - vec2(0.5);
      float dist = length(p);
      float vig = smoothstep(vignetteRadius, vignetteRadius - vignetteSoftness, dist);

      // Tint the far edges towards teal, mixed with existing color
      vec3 tealMix = mix(col, mix(col, vignetteColor, tealAmount), vig);
      col = tealMix;

      // Slight center glow to pull focus
      float glow = smoothstep(0.5, 0.0, dist) * centerBoost;
      col += vec3(glow);

      // Clamp to display-safe range
      col = clamp(col, 0.0, 1.0);
      gl_FragColor = vec4(col, 1.0);
    }
  `;
  const vertex = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  return (
    <mesh ref={meshRef} position={[0, 0, -6]}>
      <planeGeometry args={[30, 30]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        fragmentShader={fragment}
        vertexShader={vertex}
        depthWrite={false}
      />
    </mesh>
  );
}

/* Soft "oculus" god-ray as a camera-facing billboard (behind avatar) */
function OculusCone({
  color = '#7ffcff',            // teal-cyan
  intensity = 0.18,             // overall alpha strength
  flicker = 0.015,              // ~1–2% subtle flicker
  position = [0, 1.8, -0.28],   // behind avatar, slightly above chest
  scale = [6, 6, 1],            // wide cone
}: {
  color?: THREE.ColorRepresentation;
  intensity?: number;
  flicker?: number;
  position?: [number, number, number];
  scale?: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null!);
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const start = useRef<number>(Date.now());

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0.0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uFlicker: { value: flicker },
    }),
    [color, intensity, flicker]
  );

  // Always face the camera (billboard) and update time
  const { camera } = useThree();
  useFrame(() => {
    if (group.current) {
      group.current.quaternion.copy(camera.quaternion);
    }
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = (Date.now() - start.current) / 1000;
    }
  });

  const fragment = `
    uniform float uTime;
    uniform vec3  uColor;
    uniform float uIntensity;
    uniform float uFlicker;
    varying vec2 vUv;

    // Soft cone from a circular "oculus" at top-center
    void main() {
      vec2 o = vec2(0.5, 1.05);     // "window" center just above the plane
      vec2 p = vUv - o;

      // Vertical progression: 0 at top, 1 at bottom
      float down = clamp((o.y - vUv.y) * 1.25, 0.0, 1.0);

      // Cone half-width widens as we go down
      float halfW = mix(0.02, 0.40, down);

      // Core cone shape: thin near the top, wide near the bottom
      float core = 1.0 - smoothstep(halfW, halfW + 0.02, abs(p.x));

      // Fade in shortly after the "window", fade out before bottom
      float fadeTop = smoothstep(0.00, 0.06, down);
      float fadeBottom = 1.0 - smoothstep(0.88, 1.0, down);

      // Subtle radial pattern, like soft bands from a circular opening
      float rings = 0.5 + 0.5 * sin(length(p * vec2(1.0, 1.2)) * 36.0 - uTime * 0.6);
      float band = mix(1.0, rings, 0.06); // ~6% influence

      // Very low flicker (1–2%)
      float flicker = 1.0 + (sin(uTime * 2.1) + sin(uTime * 1.3)) * 0.5 * uFlicker;

      float shape = core * fadeTop * fadeBottom;
      float alpha = shape * uIntensity * band * flicker;

      gl_FragColor = vec4(uColor, alpha);
    }
  `;
  const vertex = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  return (
    <group ref={group} position={position} scale={scale}>
      <mesh>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={vertex}
          fragmentShader={fragment}
          transparent
          depthTest
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </mesh>
    </group>
  );
}

/* Stained-glass hero platform */
type HeroPlatformProps = {
  meshRef: React.MutableRefObject<THREE.Mesh | null>;
  texRef: React.MutableRefObject<THREE.Texture | null>;
};

function HeroPlatform({ meshRef, texRef }: HeroPlatformProps) {
  const { gl } = useThree();
  const stained = useTexture(
    require('../assets/images/stained-glass-blue.png')
  );

  texRef.current = stained;

  // Texture defaults (mobile-safe)
  stained.colorSpace = THREE.SRGBColorSpace;
  stained.wrapS = THREE.ClampToEdgeWrapping;
  stained.wrapT = THREE.ClampToEdgeWrapping;
  stained.minFilter = THREE.LinearMipmapLinearFilter;
  stained.magFilter = THREE.LinearFilter;
  stained.generateMipmaps = true;

  // Safe anisotropy + square-crop handling (robust on Expo Go)
  useEffect(() => {
    if (!gl) return;
    const safeAniso = getSafeAnisotropy(gl);
    stained.anisotropy = safeAniso;
    stained.needsUpdate = true;

    // If the source art is not square, letterbox vertically without distortion
    const img: any = stained.image;
    if (img && img.width && img.height) {
      const { width, height } = img;
      if (width !== height) {
        const repeatY = width / height;
        stained.repeat.set(1, repeatY);
        stained.offset.set(0, (1 - repeatY) / 2);
      } else {
        stained.repeat.set(1, 1);
        stained.offset.set(0, 0);
      }
    }
  }, [stained, gl]);

  return (
    <group position={[0, 0, 0]}>
      {/* Top stained-glass disk (true circle) */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
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
        <meshBasicMaterial color={PALETTE.keyBlue} transparent opacity={0.18} />
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
  const platformMesh = useRef<THREE.Mesh>(null);
  const platformTex = useRef<THREE.Texture | null>(null);
  const avatarRef = useRef<THREE.Group>(null);

  // Log safe anisotropy available
  useEffect(() => {
    if (!gl) return;
    const maxAniso =
      typeof gl?.capabilities?.getMaxAnisotropy === 'function'
        ? gl.capabilities.getMaxAnisotropy()
        : 1;
    const safeAniso = Math.max(1, Math.min(8, maxAniso));
    console.log('[GL] safeAniso =', safeAniso);
  }, [gl]);

  /* Color/tone mapping */
  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
  }, [gl]);

  /* Center orbit controls on stage */
  useEffect(() => {
    if (controls.current) {
      controls.current.target.set(0, 1, 0);
      controls.current.update();
    }
  }, []);

  const {
    minDistance = 1.5,
    maxDistance = 6,
    minPolar = Math.PI * 0.35,
    maxPolar = Math.PI * 0.95,
  } = cameraLimits || {};

  const DEBUG = __DEV__ && process.env.EXPO_PUBLIC_DEV_DEBUG === '1';

  useEffect(() => {
    if (DEBUG) {
      const texture = platformTex.current;
      const box = new THREE.Box3().setFromObject(avatarRef.current!);
      const controlsInst = controls.current;
      console.log('Stage debug info', {
        platformScale: platformMesh.current?.scale,
        platformWorldMatrix: platformMesh.current?.matrixWorld.elements,
        textureSize: {
          width: texture?.image?.width,
          height: texture?.image?.height,
        },
        textureEncoding: texture?.colorSpace,
        textureAnisotropy: texture?.anisotropy,
        textureRepeat: texture?.repeat,
        textureOffset: texture?.offset,
        avatarBounds: { min: box.min, max: box.max },
        orbit: {
          target: controlsInst?.target,
          distance: controlsInst?.object?.position.distanceTo(
            controlsInst?.target
          ),
          fov: controlsInst?.object?.fov,
        },
      });
    }
  }, [DEBUG]);

  return (
    <>
      {/* Depth/atmosphere matches bottom tone */}
      <fog attach="fog" args={[PALETTE.bgBottom as unknown as THREE.ColorRepresentation, 8, 18]} />

      {/* Backdrop, god-ray, and lights */}
      <GradientBackground />
      <OculusCone />
      <Lights />

      {/* Platform + ground shadow */}
      <group ref={stageRef} position={[0, 0, 0]}>
        <HeroPlatform meshRef={platformMesh} texRef={platformTex} />

        {/* Character slot (stays in front of oculus cone) */}
        <group ref={avatarRef} position={[0, characterYOffset, 0]} castShadow>
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
