'use client';

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createBuilding, createGround, createProp } from './CityKit';
import { RegionProps } from './types';

export function Region_City({ day, onCollisionBoxes }: RegionProps) {
  const { scene } = useThree();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;

    createGround(scene);

    const collisionBoxes: THREE.Box3[] = [];

    const buildings: { x: number; z: number; w: number; h: number; d: number; rotation?: number; ruined?: boolean; shop?: boolean; door?: boolean }[] = [
      // north block
      { x: -55, z: -55, w: 18, h: 16, d: 18, ruined: true, door: true },
      { x: -25, z: -55, w: 16, h: 22, d: 14, shop: true, door: true },
      { x: 25, z: -55, w: 20, h: 14, d: 16, ruined: true, door: true },
      { x: 55, z: -55, w: 15, h: 18, d: 15, shop: true, door: true },
      // south block
      { x: -55, z: 55, w: 16, h: 14, d: 18, ruined: true, door: true },
      { x: -25, z: 55, w: 18, h: 20, d: 14, door: true },
      { x: 25, z: 55, w: 14, h: 12, d: 18, shop: true, door: true },
      { x: 55, z: 55, w: 16, h: 16, d: 16, ruined: true, door: true },
      // west/east tall
      { x: -75, z: 0, w: 12, h: 28, d: 22, door: true },
      { x: 75, z: 0, w: 12, h: 26, d: 20, ruined: true, door: true },
      // central ruins
      { x: -8, z: -8, w: 10, h: 6, d: 10, ruined: true },
      { x: 8, z: 8, w: 8, h: 5, d: 8, ruined: true },
    ];

    for (const b of buildings) {
      const built = createBuilding(b);
      scene.add(built.group);
      collisionBoxes.push(built.box);
    }

    const props = [
      // cars
      { type: 'car' as const, x: -10, z: -5, rotation: 0.2 },
      { type: 'car' as const, x: 12, z: 6, rotation: -0.4 },
      { type: 'police_car' as const, x: -30, z: -5, rotation: Math.PI / 2 },
      { type: 'bus' as const, x: 0, z: -45, rotation: 0 },
      { type: 'truck' as const, x: -45, z: 20, rotation: 0.6 },
      { type: 'car' as const, x: 40, z: 40, rotation: Math.PI },
      { type: 'police_car' as const, x: 60, z: -20, rotation: -0.7 },
      { type: 'bus' as const, x: -60, z: 35, rotation: -0.3 },
      // barricades
      { type: 'barricade' as const, x: 0, z: -20, rotation: 0 },
      { type: 'barricade' as const, x: -35, z: 0, rotation: Math.PI / 2 },
      { type: 'barricade' as const, x: 35, z: 5, rotation: Math.PI / 4 },
      // dumpsters
      { type: 'dumpster' as const, x: -15, z: 18, rotation: 0.5 },
      { type: 'dumpster' as const, x: 20, z: -25, rotation: -0.3 },
      // street lamps
      { type: 'street_lamp' as const, x: -18, z: -18, rotation: 0 },
      { type: 'street_lamp' as const, x: 18, z: -18, rotation: 0 },
      { type: 'street_lamp' as const, x: -18, z: 18, rotation: 0 },
      { type: 'street_lamp' as const, x: 18, z: 18, rotation: 0 },
      { type: 'street_lamp' as const, x: -58, z: 0, rotation: 0 },
      { type: 'street_lamp' as const, x: 58, z: 0, rotation: 0 },
      // traffic lights
      { type: 'traffic_light' as const, x: -22, z: -22, rotation: 0 },
      { type: 'traffic_light' as const, x: 22, z: 22, rotation: 0 },
      // cones + crates
      { type: 'cone' as const, x: 5, z: -12, rotation: 0 },
      { type: 'cone' as const, x: 7, z: -13, rotation: 0 },
      { type: 'cone' as const, x: 3, z: -11, rotation: 0 },
      { type: 'crate' as const, x: -22, z: 22, rotation: 0.2 },
      { type: 'crate' as const, x: 22, z: -22, rotation: -0.1 },
      { type: 'crate' as const, x: 24, z: -20, rotation: 0.3 },
      // blood + trash random
      ...Array.from({ length: 16 }).map((_, i) => ({
        type: (Math.random() > 0.6 ? 'blood' : 'trash') as 'blood' | 'trash',
        x: (Math.random() - 0.5) * 140,
        z: (Math.random() - 0.5) * 140,
        rotation: Math.random() * Math.PI,
      })),
    ];

    for (const p of props) {
      const prop = createProp(p);
      scene.add(prop.group);
      if (prop.box) collisionBoxes.push(prop.box);
    }

    onCollisionBoxes?.(collisionBoxes);

    // fog & color
    scene.fog = new THREE.FogExp2('#1a1a20', 0.018);

    return () => {
      scene.fog = null;
    };
  }, [scene, day, onCollisionBoxes]);

  return null;
}
