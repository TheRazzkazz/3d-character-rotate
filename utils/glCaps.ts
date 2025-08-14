import * as THREE from 'three';

export function getSafeAnisotropy(renderer: THREE.WebGLRenderer): number {
  if (!renderer || !(renderer as any).capabilities) return 1;
  const caps: any = (renderer as any).capabilities;
  let max: number | undefined;

  if (typeof caps.getMaxAnisotropy === 'function') {
    max = caps.getMaxAnisotropy();
  } else if (typeof caps.maxAnisotropy === 'number') {
    max = caps.maxAnisotropy;
  }

  const value = typeof max === 'number' && isFinite(max) && max > 0 ? max : 1;
  return Math.max(1, Math.min(8, value));
}