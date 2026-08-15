import * as THREE from 'three';

export interface RegionProps {
  day: number;
  spawnSeed?: number;
  onCollisionBoxes?: (boxes: THREE.Box3[]) => void;
}

export interface BuildingDef {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  rotation?: number;
  color?: string;
  windows?: boolean;
  ruined?: boolean;
  shop?: boolean;
  door?: boolean;
}

export interface PropDef {
  type: 'car' | 'police_car' | 'bus' | 'truck' | 'barricade' | 'dumpster' | 'trash' | 'blood' | 'cone' | 'crate' | 'traffic_light' | 'street_lamp';
  x: number;
  z: number;
  rotation?: number;
}
