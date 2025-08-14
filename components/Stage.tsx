// components/Stage.tsx
import React, { useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber/native';
import { OrbitControls, Environment, useTexture } from '@react-three/drei/native';
import * as THREE from 'three';
import Character from './Character';
import { getSafeAnisotropy } from '../utils/glCaps';
import { AppState } from 'react-native';

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
  bgTop: '#0a1321',
  bgBottom: '#05080d',
  vignetteTeal: '#0d2a33',
  keyBlue: '#4ea3ff',
  rimCyan: '#7ffcff',
  indigo: '#4f46e5',
};

/* ---------- Helpers (Hermes-safe, no WeakMap usage) ---------- */

/** Build a small radial DataTexture for roughnessMap (center -> edge ramp).
 *  Encodes a single channel in RGBA equally; WebGL1-safe on Expo Go.
 */
function makeRadialRoughnessTex(
  size: number,
  centerRough = 0.12,
  edgeRough = 0.28
) {
  const data = new Uint8Array(size * size * 4); // RGBA
  const cx = size * 0.5;
  const cy = size * 0.5;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      // 0 at center, 1 near corners
      const r = Math.min(1, Math.sqrt(dx * dx + dy * dy) / maxR);
      // Smooth ramp center->edge
      const t = r * r; // slight ease
      const rough = THREE.MathUtils.lerp(centerRough, edgeRough, t);
      const v = Math.round(THREE.MathUtils.clamp(rough, 0, 1) * 255);
      const i = (y * size + x) * 4;
      data[i + 0] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(
    data,
    size,
    size,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  // Non-color data; keep linear color space (default).
  tex.needsUpdate = true;
  return tex;
}

/* ---------- Background (unchanged) ---------- */
function GradientBackground() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color(PALETTE.bgTop) },
      bottomColor: { value: new THREE.Color(PALETTE.bgBottom) },
      vignetteColor: { value: new THREE.Color(PALETTE.vignetteTeal) },
      vignetteRadius: { value: 0.78 },
      vignetteSoftness: { value: 0.38 },
      centerBoost: { value: 0.06 },
      tealAmount: { value: 0.35 },
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
      float t = vUv.y;
      vec3 col = mix(bottomColor, topColor, t);
      vec2 p = vUv - vec2(0.5);
      float dist = length(p);
      float vig = smoothstep(vignetteRadius, vignetteRadius - vignetteSoftness, dist);
      vec3 tealMix = mix(col, mix(col, vignetteColor, tealAmount), vig);
      col = tealMix;
      float glow = smoothstep(0.5, 0.0, dist) * centerBoost;
      col += vec3(glow);
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

/* White "oculus" cone — billboarded */
function OculusCone({
  color = '#ffffff',
  intensity = 0.07,
  flicker = 0.01,
  position = [0, 1.85, -1.0],
  scale = [6, 6, 1],
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
  const { camera } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0.0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uFlicker: { value: flicker },
    }),
    [color, intensity, flicker]
  );

  useFrame(() => {
    if (group.current) group.current.quaternion.copy(camera.quaternion);
    if (matRef.current) matRef.current.uniforms.uTime.value = (Date.now() - start.current) / 1000;
  });

  const fragment = `
    uniform float uTime; uniform vec3 uColor; uniform float uIntensity, uFlicker;
    varying vec2 vUv;
    void main() {
      vec2 o = vec2(0.5, 1.05), p = vUv - o;
      float down = clamp((o.y - vUv.y) * 1.25, 0.0, 1.0);
      float halfW = mix(0.02, 0.28, down);
      float core = 1.0 - smoothstep(halfW, halfW + 0.02, abs(p.x));
      float fadeTop = smoothstep(0.00, 0.06, down);
      float fadeBottom = 1.0 - smoothstep(0.88, 1.0, down);
      float rings = 0.5 + 0.5 * sin(length(p*vec2(1.0,1.2))*36.0 - uTime*0.6);
      float band = mix(1.0, rings, 0.04);
      float flicker = 1.0 + (sin(uTime*2.1)+sin(uTime*1.3))*0.5*uFlicker;
      float alpha = core * fadeTop * fadeBottom * uIntensity * band * flicker;
      gl_FragColor = vec4(uColor, alpha);
    }
  `;
  const vertex = `
    varying vec2 vUv;
    void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
  `;

  return (
    <group ref={group} position={position} scale={scale} renderOrder={-10}>
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
          toneMapped={false}
          blending={THREE.NormalBlending}
        />
      </mesh>
    </group>
  );
}

/* Tiny motes */
function Motes({
  count = 14,
  xRange = 1.6,
  yMin = 0.1,
  yMax = 3.0,
  zNear = -0.6,
  zFar = -0.3,
  minSize = 0.015,
  maxSize = 0.03,
  minSpeed = 0.10,
  maxSpeed = 0.14,
  opacity = 0.05,
  color = '#ffffff',
}: Partial<{
  count: number; xRange: number; yMin: number; yMax: number; zNear: number; zFar: number;
  minSize: number; maxSize: number; minSpeed: number; maxSpeed: number; opacity: number;
  color: THREE.ColorRepresentation;
}>) {
  const { camera } = useThree();
  const group = useRef<THREE.Group>(null!);

  const seeds = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() * 2 - 1) * xRange;
      const y = yMin + Math.random() * (yMax - yMin);
      const z = zNear + Math.random() * (zFar - zNear);
      const size = minSize + Math.random() * (maxSize - minSize);
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
      arr.push({ pos: new THREE.Vector3(x, y, z), size, speed });
    }
    return arr;
  }, [count, xRange, yMin, yMax, zNear, zFar, minSize, maxSize, minSpeed, maxSpeed]);

  useFrame((_, delta) => {
    if (group.current) group.current.quaternion.copy(camera.quaternion);
    for (const child of group.current.children as THREE.Mesh[]) {
      // @ts-ignore
      const { speed, yMin: y0, yMax: y1, xRange: xr, zNear: zn, zFar: zf } = child.userData;
      child.position.y += speed * delta;
      if (child.position.y > y1) {
        child.position.y = y0;
        child.position.x = (Math.random() * 2 - 1) * xr;
        child.position.z = zn + Math.random() * (zf - zn);
      }
    }
  });

  const moteFrag = `
    uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
    void main() {
      vec2 p = vUv - 0.5;
      float d = length(p) * 2.0;
      float a = smoothstep(1.0, 0.6, d) * uOpacity;
      gl_FragColor = vec4(uColor, a);
    }
  `;
  const moteVert = `
    varying vec2 vUv;
    void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }
  `;

  return (
    <group ref={group} renderOrder={-9}>
      {seeds.map(({ pos, size }, i) => (
        <mesh
          key={i}
          position={pos.toArray() as [number, number, number]}
          scale={[size, size, size]}
          userData={{ speed: seeds[i].speed, yMin, yMax, xRange, zNear, zFar }}
        >
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            uniforms={{
              uColor: { value: new THREE.Color(color) },
              uOpacity: { value: opacity },
            }}
            vertexShader={moteVert}
            fragmentShader={moteFrag}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- Stained-glass platform & effects ---------- */

type HeroPlatformProps = {
  meshRef: React.MutableRefObject<THREE.Mesh | null>;
  texRef: React.MutableRefObject<THREE.Texture | null>;
};

function HeroPlatform({ meshRef, texRef }: HeroPlatformProps) {
  const { gl } = useThree();
  // Base stained glass art (KH-style image)
  const stained = useTexture(require('../assets/images/stained-glass-blue.png')) as THREE.Texture;
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
    // Enable soft shadows on renderer (Expo-safe)
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;

    const safeAniso = getSafeAnisotropy(gl);
    stained.anisotropy = safeAniso;
    stained.needsUpdate = true;

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

  // Micro-roughness radial map (center 0.12 -> edge 0.28)
  const roughnessMap = useMemo(() => makeRadialRoughnessTex(128, 0.12, 0.28), []);

  // ----- Rune glow (masked) overlay -----
  const runeGlowUniforms = useMemo(
    () => ({
      uMap: { value: stained },
      uTint: { value: new THREE.Color(PALETTE.keyBlue) },
      uStrength: { value: 0.28 }, // in the 0.20 - 0.35 band
      uSmooth: { value: 0.05 },   // soften the threshold
    }),
    [stained]
  );

  const runeFrag = `
    uniform sampler2D uMap;
    uniform vec3 uTint;
    uniform float uStrength;
    uniform float uSmooth;
    varying vec2 vUv;
    // simple luminance
    float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main(){
      vec4 tex = texture2D(uMap, vUv);
      // Heuristic: darker line art emits, vivid panes don't
      float lum = luma(tex.rgb);
      // Invert so lines (low lum) -> high mask; then soften
      float mask = smoothstep(1.0 - uSmooth, 1.0, 1.0 - lum);
      vec3 col = uTint * (uStrength * mask);
      gl_FragColor = vec4(col, mask * uStrength);
    }
  `;
  const runeVert = `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `;

  // ----- Fresnel-ish thin rim highlight -----
  const fresnelUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(PALETTE.rimCyan) },
      uInner: { value: 0.88 },  // inner radius of ring
      uOuter: { value: 1.00 },  // outer radius of ring
      uFeather: { value: 0.06 },// softness
      uBoost: { value: 0.55 },  // brightness
    }),
    []
  );

  const fresnelFrag = `
    uniform vec3 uColor;
    uniform float uInner, uOuter, uFeather, uBoost;
    varying vec2 vUv;
    void main(){
      vec2 p = vUv - 0.5;
      float r = length(p) * 2.0; // ~0 center -> ~sqrt(2) edge; circle uv maps okay
      float ring = smoothstep(uOuter, uOuter - uFeather, r) * (1.0 - smoothstep(uInner, uInner + uFeather, r));
      vec3 col = uColor * (uBoost * ring);
      gl_FragColor = vec4(col, ring);
    }
  `;
  const fresnelVert = `
    varying vec2 vUv;
    void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }
  `;

  // ----- Radial falloff (darker rim) to ground feet -----
  const falloffUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#000000') },
      uInner: { value: 0.0 },   // keep center almost untouched
      uOuter: { value: 1.0 },
      uFeather: { value: 0.35 },
      uMaxDark: { value: 0.35 },// how dark near the rim
    }),
    []
  );
  const falloffFrag = `
    uniform vec3 uColor;
    uniform float uInner, uOuter, uFeather, uMaxDark;
    varying vec2 vUv;
    void main(){
      vec2 p = vUv - 0.5;
      float r = length(p) * 2.0;
      // 0 at center, 1 near edge; feather for smoothness
      float edge = smoothstep(uInner, uOuter, r);
      float alpha = smoothstep(0.0, 1.0, edge);
      alpha = pow(alpha, 1.5); // bias a little to the rim
      alpha *= uMaxDark;
      gl_FragColor = vec4(uColor, alpha);
    }
  `;
  const falloffVert = `
    varying vec2 vUv;
    void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }
  `;

  return (
    <group position={[0, 0, 0]}>
      {/* Top stained-glass disk (physically lit) */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.5, 128]} />
        <meshStandardMaterial
          map={stained}
          color={'#ffffff'}
          transparent
          alphaTest={0.5}
          depthWrite
          depthTest
          roughness={0.2}                 // base; modulated by roughnessMap
          roughnessMap={roughnessMap as any}
          metalness={0.05}
          emissive={PALETTE.keyBlue}
          emissiveIntensity={0.06}        // <— subtle uplight fill from platform
          envMapIntensity={0.12}          // subtle reflections, not a blue wash
        />
      </mesh>

      {/* Rune-line glow overlay — additive, paper-thin offset to avoid z-fighting */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]} renderOrder={5}>
        <circleGeometry args={[1.5, 128]} />
        <shaderMaterial
          uniforms={runeGlowUniforms}
          vertexShader={runeVert}
          fragmentShader={runeFrag}
          transparent
          depthWrite={false}
          depthTest
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Fresnel-ish rim highlight — additive and very thin */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0006, 0]} renderOrder={6}>
        <circleGeometry args={[1.55, 128]} />
        <shaderMaterial
          uniforms={fresnelUniforms}
          vertexShader={fresnelVert}
          fragmentShader={fresnelFrag}
          transparent
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Radial falloff (darker rim) — normal blend with black, lifts grounding */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0004, 0]} renderOrder={4}>
        <circleGeometry args={[1.55, 128]} />
        <shaderMaterial
          uniforms={falloffUniforms}
          vertexShader={falloffVert}
          fragmentShader={falloffFrag}
          transparent
          depthWrite={false}
          toneMapped={false}
          blending={THREE.NormalBlending}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* Soft underglow halo (kept subtle) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[1.7, 64]} />
        <meshBasicMaterial
          color={PALETTE.keyBlue}
          transparent
          opacity={0.06}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* ---------- Lighting Stack (replaces old "Cinematic lights") ---------- */
function Lights() {
  return (
    <>
      {/* Shadowed key: soft spotlight above/front (~4300K) */}
      <spotLight
        position={[0.4, 3.2, 2.2]}
        angle={0.75}
        penumbra={0.9}
        intensity={1.25}
        color={'#F1E6D6'}         // warm-neutral ~4300K
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.00035}
        shadow-normalBias={0.02}
      />

      {/* Cyan rim: small back light at head height — no shadows */}
      <directionalLight
        position={[0.2, 1.7, -2.3]}
        intensity={0.9}
        color={PALETTE.rimCyan}
      />

      {/* Ambient/hemisphere: very low, cool-blue */}
      <hemisphereLight
        skyColor={'#0c243d'}
        groundColor={'#0a0b10'}
        intensity={0.12}
      />
    </>
  );
}

/* ---------- Stage ---------- */
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
  const tunedEnv = useRef(false);

  // DEV guard: surface duplicate THREE (common WeakMap cause in Hermes)
  if (__DEV__) {
    // @ts-ignore
    const g = global as any;
    g.__THREE_INSTANCES__ = g.__THREE_INSTANCES__ || new Set();
    const before = g.__THREE_INSTANCES__.size;
    g.__THREE_INSTANCES__.add(THREE);
    if (g.__THREE_INSTANCES__.size !== before + 1) {
      console.warn('[Stage] Multiple THREE instances detected — this can cause WeakMap errors.');
    }
  }

  // Watchdog to unstick controls if touchend is lost
  const dragTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unstickControls = () => {
    const c = controls.current;
    if (!c) return;
    c.enabled = false;
    requestAnimationFrame(() => {
      if (controls.current) {
        controls.current.enabled = true;
        controls.current.update();
      }
    });
  };
  const handleStart = () => {
    if (dragTimer.current) clearTimeout(dragTimer.current);
    dragTimer.current = setTimeout(unstickControls, 2500);
    onStart?.();
  };
  const handleEnd = () => {
    if (dragTimer.current) {
      clearTimeout(dragTimer.current);
      dragTimer.current = null;
    }
    onEnd?.();
  };
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') unstickControls();
    });
    return () => {
      sub.remove();
      if (dragTimer.current) clearTimeout(dragTimer.current);
    };
  }, []);

  // Log safe anisotropy available
  useEffect(() => {
    if (!gl) return;
    // @ts-ignore
    const maxAniso = typeof gl?.capabilities?.getMaxAnisotropy === 'function'
      ? gl.capabilities.getMaxAnisotropy()
      : 1;
    const safeAniso = Math.max(1, Math.min(8, maxAniso));
    console.log('[GL] safeAniso =', safeAniso);
  }, [gl]);

  /* Color/tone + soft shadows */
  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.12; // small global lift for iPhone 13
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [gl]);

  /* Character material/env tuning + ensure cast shadows */
  useFrame(() => {
    if (tunedEnv.current || !avatarRef.current) return;
    avatarRef.current.traverse((obj: any) => {
      if (obj.isMesh) obj.castShadow = true;
      if (obj.isMesh && obj.material) {
        const m = obj.material;
        if ('envMapIntensity' in m) m.envMapIntensity = 0.25;
        if ('toneMapped' in m) m.toneMapped = true;
      }
    });
    tunedEnv.current = true;
  });

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
        platformWorldMatrix: platformMesh.current?.matrixWorld?.elements,
        textureSize: { width: texture?.image?.width, height: texture?.image?.height },
        textureEncoding: texture?.colorSpace,
        textureAnisotropy: texture?.anisotropy,
        textureRepeat: texture?.repeat,
        textureOffset: texture?.offset,
        avatarBounds: { min: box.min, max: box.max },
        orbit: {
          target: controlsInst?.target,
          distance: controlsInst?.object?.position.distanceTo(controlsInst?.target),
          fov: controlsInst?.object?.fov,
        },
      });
    }
  }, [DEBUG]);

  return (
    <>
      {/* Depth/atmosphere */}
      <fog attach="fog" args={[PALETTE.bgBottom, 8, 18]} />

      {/* Backdrop + effects */}
      <GradientBackground />
      <OculusCone />
      <Motes />

      {/* Platform + character */}
      <group ref={stageRef} position={[0, 0, 0]}>
        <HeroPlatform meshRef={platformMesh} texRef={platformTex} />
        <group ref={avatarRef} position={[0, characterYOffset, 0]} castShadow>
          {children ?? <Character />}
        </group>
      </group>

      {/* Subtle reflections; keep gradient background */}
      <Environment preset="night" background={false} blur={0.6} />

      {/* Lighting stack (key + rim + hemisphere) */}
      <Lights />

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
        onStart={handleStart}   // watchdog wrapper
        onEnd={handleEnd}       // watchdog wrapper
      />
    </>
  );
}
