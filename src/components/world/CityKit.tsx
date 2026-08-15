import * as THREE from 'three';
import { BuildingDef, PropDef } from './types';

// Materials reused for performance
const mats = {
  asphalt: new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.95 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: '#6b6b70', roughness: 0.9 }),
  line: new THREE.MeshStandardMaterial({ color: '#d4d4d8', roughness: 0.8 }),
  concrete: new THREE.MeshStandardMaterial({ color: '#4a4a52', roughness: 0.9 }),
  window: new THREE.MeshStandardMaterial({ color: '#1a2a3a', roughness: 0.2, metalness: 0.6 }),
  brokenWindow: new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: '#5c3a1e', roughness: 0.9 }),
  metal: new THREE.MeshStandardMaterial({ color: '#555', roughness: 0.5, metalness: 0.6 }),
  police: new THREE.MeshStandardMaterial({ color: '#1e3a5f', roughness: 0.5 }),
  fire: new THREE.MeshStandardMaterial({ color: '#ff6b35', emissive: '#aa2200', emissiveIntensity: 2 }),
  blood: new THREE.MeshStandardMaterial({ color: '#5a0a0a', roughness: 1 }),
  glow: new THREE.MeshStandardMaterial({ color: '#ffaa00', emissive: '#ffaa00', emissiveIntensity: 3 }),
};

function castReceive(mesh: THREE.Mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

export function createGround(scene: THREE.Scene) {
  // main road
  const road = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mats.asphalt);
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  scene.add(road);

  // crossroad lines
  for (let i = -80; i <= 80; i += 40) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(200, 1.5), mats.line);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.02, i);
    scene.add(h);

    const v = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 200), mats.line);
    v.rotation.x = -Math.PI / 2;
    v.position.set(i, 0.02, 0);
    scene.add(v);
  }

  // sidewalks
  for (const [x, z, w, d] of [
    [-20, -20, 60, 6],
    [-20, 20, 6, 40],
    [20, -20, 6, 40],
    [20, 20, 60, 6],
    [-60, -60, 80, 6],
    [60, -60, 80, 6],
  ] as const) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, d), mats.sidewalk);
    sw.position.set(x, 0.12, z);
    sw.receiveShadow = true;
    scene.add(sw);
  }
}

export function createBuilding(b: BuildingDef): THREE.Group {
  const g = new THREE.Group();
  g.position.set(b.x, 0, b.z);
  g.rotation.y = b.rotation ?? 0;

  const w = b.w;
  const h = b.h;
  const d = b.d;

  // main shell
  const shell = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.concrete);
  shell.position.y = h / 2;
  castReceive(shell);
  g.add(shell);

  // windows
  if (b.windows !== false) {
    const rows = Math.floor(h / 2.5);
    const colsW = Math.max(1, Math.floor(w / 3));
    const colsD = Math.max(1, Math.floor(d / 3));

    for (let r = 1; r < rows; r++) {
      const y = r * 2.5;
      // front/back
      for (let c = 0; c < colsW; c++) {
        const x = -w / 2 + (c + 0.5) * (w / colsW);
        const broken = Math.random() < (b.ruined ? 0.5 : 0.1);
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.1), broken ? mats.brokenWindow : mats.window);
        win.position.set(x, y, d / 2 + 0.05);
        g.add(win);
        if (broken) {
          const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.7, 0.08), mats.wood);
          board.position.set(x, y, d / 2 + 0.06);
          board.rotation.z = (Math.random() - 0.5) * 0.3;
          g.add(board);
        }
        const winBack = win.clone();
        winBack.position.set(x, y, -d / 2 - 0.05);
        g.add(winBack);
      }
      // sides
      for (let c = 0; c < colsD; c++) {
        const z = -d / 2 + (c + 0.5) * (d / colsD);
        const broken = Math.random() < (b.ruined ? 0.5 : 0.1);
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 1.2), broken ? mats.brokenWindow : mats.window);
        win.position.set(w / 2 + 0.05, y, z);
        g.add(win);
        if (broken) {
          const board = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 1.3), mats.wood);
          board.position.set(w / 2 + 0.06, y, z);
          board.rotation.x = (Math.random() - 0.5) * 0.3;
          g.add(board);
        }
        const winLeft = win.clone();
        winLeft.position.set(-w / 2 - 0.05, y, z);
        g.add(winLeft);
      }
    }
  }

  // rooftop lip
  const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.6, d + 0.5), mats.concrete);
  lip.position.y = h + 0.3;
  castReceive(lip);
  g.add(lip);

  // shop sign
  if (b.shop) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.8, 0.2), mats.glow);
    sign.position.set(0, 2.8, d / 2 + 0.3);
    g.add(sign);
    const point = new THREE.PointLight('#ffaa00', 5, 8);
    point.position.set(0, 3.5, d / 2 + 2);
    g.add(point);
  }

  // door gap
  if (b.door) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.2), mats.wood);
    door.position.set(0, 1.3, d / 2 + 0.1);
    g.add(door);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.7, 0.15), mats.metal);
    frame.position.set(0, 1.35, d / 2 + 0.08);
    g.add(frame);
  }

  // trash/debris around base
  for (let i = 0; i < (b.ruined ? 12 : 4); i++) {
    const trash = new THREE.Mesh(new THREE.BoxGeometry(0.2 + Math.random() * 0.4, 0.1, 0.2 + Math.random() * 0.4), mats.blood);
    const angle = Math.random() * Math.PI * 2;
    const rad = w / 2 + 0.5 + Math.random();
    trash.position.set(Math.cos(angle) * rad, 0.05, Math.sin(angle) * rad);
    trash.rotation.y = Math.random() * Math.PI;
    g.add(trash);
  }

  return g;
}

export function createProp(p: PropDef): THREE.Group {
  const g = new THREE.Group();
  g.position.set(p.x, 0, p.z);
  g.rotation.y = p.rotation ?? 0;

  switch (p.type) {
    case 'car': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 4.6), new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? '#444' : '#666', roughness: 0.6 }));
      body.position.y = 0.65;
      castReceive(body);
      g.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 2.2), new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.2, metalness: 0.7 }));
      cabin.position.y = 1.4;
      g.add(cabin);
      for (const [x, z] of [[-0.9, 1.6], [0.9, 1.6], [-0.9, -1.6], [0.9, -1.6]]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16), mats.metal);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.35, z);
        g.add(wheel);
      }
      if (Math.random() < 0.3) {
        const fire = new THREE.PointLight('#ff4400', 8, 12);
        fire.position.set(0, 1, 1.5);
        g.add(fire);
        const flame = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), mats.fire);
        flame.position.set(0, 1, 1.5);
        g.add(flame);
      }
      break;
    }
    case 'police_car': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 4.6), mats.police);
      body.position.y = 0.65;
      castReceive(body);
      g.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 2.2), new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.2, metalness: 0.7 }));
      cabin.position.y = 1.4;
      g.add(cabin);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.3), mats.metal);
      bar.position.y = 1.8;
      g.add(bar);
      const light1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.25), new THREE.MeshStandardMaterial({ color: '#ff0000', emissive: '#ff0000', emissiveIntensity: 2 }));
      light1.position.set(-0.35, 1.85, 0);
      g.add(light1);
      const light2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.25), new THREE.MeshStandardMaterial({ color: '#0000ff', emissive: '#0000ff', emissiveIntensity: 2 }));
      light2.position.set(0.35, 1.85, 0);
      g.add(light2);
      break;
    }
    case 'bus': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.8, 10), new THREE.MeshStandardMaterial({ color: '#8B4513', roughness: 0.7 }));
      body.position.y = 1.4;
      castReceive(body);
      g.add(body);
      for (let z = -3.5; z <= 3.5; z += 1.4) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 0.1), mats.brokenWindow);
        win.position.set(0, 2, z);
        g.add(win);
      }
      break;
    }
    case 'truck': {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.6), new THREE.MeshStandardMaterial({ color: '#3d3d3d', roughness: 0.7 }));
      cab.position.set(0, 1.2, 1.8);
      castReceive(cab);
      g.add(cab);
      const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.2, 6), new THREE.MeshStandardMaterial({ color: '#5a5a5a', roughness: 0.7 }));
      trailer.position.set(0, 1.6, -2.5);
      trailer.rotation.z = Math.random() < 0.5 ? 0 : Math.PI;
      castReceive(trailer);
      g.add(trailer);
      break;
    }
    case 'barricade': {
      for (let i = -1; i <= 1; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.9, 0.25), mats.wood);
        bar.position.set(0, 0.45, i * 0.6);
        bar.rotation.y = (Math.random() - 0.5) * 0.2;
        g.add(bar);
      }
      break;
    }
    case 'dumpster': {
      const bin = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 1.2), new THREE.MeshStandardMaterial({ color: '#2d4a22', roughness: 0.8 }));
      bin.position.y = 0.8;
      castReceive(bin);
      g.add(bin);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 1.2), mats.metal);
      lid.position.set(0, 1.65, -0.3);
      lid.rotation.x = -0.5;
      g.add(lid);
      break;
    }
    case 'traffic_light': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.5), mats.metal);
      pole.position.y = 2.75;
      g.add(pole);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), mats.metal);
      box.position.y = 5.2;
      g.add(box);
      const red = new THREE.Mesh(new THREE.SphereGeometry(0.12), new THREE.MeshStandardMaterial({ color: '#ff0000', emissive: '#ff0000', emissiveIntensity: 1 }));
      red.position.set(0, 5.5, 0.26);
      g.add(red);
      break;
    }
    case 'street_lamp': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6), mats.metal);
      pole.position.y = 3;
      g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.2), mats.metal);
      arm.position.set(0.5, 5.9, 0);
      g.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2), mats.glow);
      bulb.position.set(1, 5.8, 0);
      g.add(bulb);
      const light = new THREE.PointLight('#ffcc77', 8, 18);
      light.position.set(1, 5.5, 0);
      g.add(light);
      break;
    }
    case 'cone': {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 16), new THREE.MeshStandardMaterial({ color: '#ff6600', roughness: 0.8 }));
      cone.position.y = 0.35;
      g.add(cone);
      break;
    }
    case 'crate': {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats.wood);
      crate.position.y = 0.5;
      castReceive(crate);
      g.add(crate);
      break;
    }
    case 'blood': {
      const blood = new THREE.Mesh(new THREE.CircleGeometry(0.4 + Math.random() * 0.4, 16), mats.blood);
      blood.rotation.x = -Math.PI / 2;
      blood.position.y = 0.03;
      g.add(blood);
      break;
    }
    case 'trash': {
      const trash = new THREE.Mesh(new THREE.BoxGeometry(0.3 + Math.random() * 0.3, 0.15, 0.3 + Math.random() * 0.3), new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 1 }));
      trash.position.y = 0.075;
      trash.rotation.y = Math.random() * Math.PI;
      g.add(trash);
      break;
    }
  }

  return g;
}
