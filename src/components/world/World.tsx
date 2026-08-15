'use client';

import { Region_City } from './Region_City';
import * as THREE from 'three';
import { TreeState } from './types';

export function World({ day, onCollisionBoxes, onTrees }: { day: number; onCollisionBoxes?: (boxes: THREE.Box3[]) => void; onTrees?: (trees: TreeState[]) => void }) {
  return <Region_City day={day} onCollisionBoxes={onCollisionBoxes} onTrees={onTrees} />;
}
