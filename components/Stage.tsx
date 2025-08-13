import { useFrame } from '@react-three/fiber/native';
import React, { useRef } from 'react';
import * as THREE from 'three';
import Character from './Character';

type Props = {
  rotationY?: number;
  turntableSpeed?: number; // radians per frame, e.g. 0.003
};

export default function Stage({ rotationY = 0, turntableSpeed = 0 }: Props) {
  const group = useRef<THREE.Group | null>(null);

  useFrame(() => {
    if (!group.current) return;

    // Smoothly follow the drag target
    const current = group.current.rotation.y;
    group.current.rotation.y = current + (rotationY - current) * 0.15;

    // Optional slow auto-rotate
    if (turntableSpeed !== 0) {
      group.current.rotation.y += turntableSpeed;
    }
  });

  return (
    // Keep world-aligned with your ContactShadows at y = -0.5
    <group ref={group} position={[0, -0.5, 0]}>
      {/* Sleek platform (thin disk) */}
      <group position={[0, 0, 0]}>
        {/* main disk */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[1.0, 1.0, 0.08, 96]} />
          <meshStandardMaterial color="#2a313b" metalness={0.35} roughness={0.6} />
        </mesh>

        {/* subtle top rim */}
        <mesh position={[0, 0.041, 0]}>
          <torusGeometry args={[0.95, 0.01, 16, 96]} />
          <meshStandardMaterial color="#3a4250" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>

      {/* Character stands on the platform */}
      <group position={[0, 0.1, 0]} scale={[0.9, 0.9, 0.9]} castShadow>
        <Character />
      </group>
    </group>
  );
}
