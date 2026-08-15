'use client';

import { Region_City } from './Region_City';
import * as THREE from 'three';

export function World({ day, onCollisionBoxes }: { day: number; onCollisionBoxes?: (boxes: THREE.Box3[]) => void }) {
  return <Region_City day={day} onCollisionBoxes={onCollisionBoxes} />;
}
