import * as THREE from 'three';

export interface RegionProps {
  day: number;
  spawnSeed?: number;
  onCollisionBoxes?: (boxes: THREE.Box3[]) => void;
  onTrees?: (trees: TreeState[]) => void;
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
  type: 'car' | 'police_car' | 'bus' | 'truck' | 'barricade' | 'dumpster' | 'trash' | 'blood' | 'cone' | 'crate' | 'traffic_light' | 'street_lamp' | 'tree_dead' | 'tree_fallen';
  x: number;
  z: number;
  rotation?: number;
  health?: number;
  chopped?: boolean;
}

export interface TreeState {
  id: string;
  x: number;
  z: number;
  health: number;
  mesh?: THREE.Group;
  box?: THREE.Box3;
}