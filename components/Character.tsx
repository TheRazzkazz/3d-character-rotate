// components/Character.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGLTF } from '@react-three/drei/native';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

type CharacterProps = {
  /** Optional: force a specific GLB URL for testing */
  overrideUrl?: string;
  /** Optional: uniform scale */
  scale?: number;
};

// Default Ready Player Me avatar
const FALLBACK_GLB =
  'https://models.readyplayer.me/689b9e04c911aabc2e9c587f.glb';

// Preload fallback for faster initial load
useGLTF.preload(FALLBACK_GLB);

function CharacterInner({
  url,
  scale = 1,
}: {
  url: string;
  scale?: number;
}) {
  const gltf = useGLTF(url);

  useEffect(() => {
  gltf.scene.scale.set(scale, scale, scale);

    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });

    const box = new THREE.Box3().setFromObject(gltf.scene);
    const minY = box.min.y;
    gltf.scene.position.y -= minY;
    console.log('Avatar bounding box:', box.min, box.max, 'offset', -minY);
  }, [gltf.scene, scale]);

  return <primitive object={gltf.scene} dispose={null} />;
}

export default function Character({ overrideUrl, scale = 0.9 }: CharacterProps) {
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('avatarUrl');
        setSavedUrl(stored);
      } catch {
        setSavedUrl(null);
      }
    })();
  }, []);

  const finalUrl = useMemo(
    () => overrideUrl || savedUrl || FALLBACK_GLB,
    [overrideUrl, savedUrl]
  );

  return (
    <Suspense
      fallback={
        <mesh>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color="#8892b0" />
        </mesh>
      }
    >
      <CharacterInner url={finalUrl} scale={scale} />
    </Suspense>
  );
}
