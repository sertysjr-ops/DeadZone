'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { World } from './world';

const KEY: Record<string, boolean> = {};

interface SaveData {
  playerPosition: { x: number; y: number; z: number };
  playerRotation: { yaw: number; pitch: number };
  health: number;
  ammo: number;
  score: number;
  wave: number;
  timestamp: number;
}

interface Enemy {
  id: number;
  mesh: THREE.Group;
  health: number;
  maxHealth: number;
  speed: number;
  dead: boolean;
}

interface Pickup {
  id: number;
  mesh: THREE.Mesh;
  type: 'health' | 'ammo';
}

interface Door {
  id: number;
  frame: THREE.Group;
  slab: THREE.Mesh;
  open: boolean;
  x: number;
  z: number;
  width: number;
}

interface Chest {
  id: number;
  group: THREE.Group;
  lid: THREE.Mesh;
  open: boolean;
  x: number;
  z: number;
  looted: boolean;
}

function createDoor(x: number, z: number, rotation: number, width = 2.2, height = 3.2, depth = 0.25, scene: THREE.Scene): Door {
  const frameMat = new THREE.MeshStandardMaterial({ color: '#2d2d33', roughness: 0.9 });
  const doorMat = new THREE.MeshStandardMaterial({ color: '#4a2c20', roughness: 0.8 });

  const frame = new THREE.Group();
  frame.position.set(x, 0, z);
  frame.rotation.y = rotation;

  const frameThick = 0.35;
  const left = new THREE.Mesh(new THREE.BoxGeometry(frameThick, height, depth + 0.05), frameMat);
  left.position.set(-width / 2 - frameThick / 2, height / 2, 0);
  left.castShadow = true;
  left.receiveShadow = true;
  frame.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(frameThick, height, depth + 0.05), frameMat);
  right.position.set(width / 2 + frameThick / 2, height / 2, 0);
  right.castShadow = true;
  right.receiveShadow = true;
  frame.add(right);

  const top = new THREE.Mesh(new THREE.BoxGeometry(width + frameThick * 2, frameThick, depth + 0.05), frameMat);
  top.position.set(0, height + frameThick / 2, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  frame.add(top);

  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), doorMat);
  slab.position.set(0, height / 2, 0);
  slab.castShadow = true;
  slab.receiveShadow = true;
  frame.add(slab);

  // handle
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: '#aaa' }));
  handle.position.set(width / 2 - 0.2, height / 2, depth / 2 + 0.06);
  slab.add(handle);

  scene.add(frame);
  return { id: Date.now() + Math.random(), frame, slab, open: false, x, z, width };
}

function createChest(x: number, z: number, rotation: number, scene: THREE.Scene): Chest {
  const boxMat = new THREE.MeshStandardMaterial({ color: '#5c3a1e', roughness: 0.7 });
  const metalMat = new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.6, roughness: 0.4 });

  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.9), boxMat);
  base.position.y = 0.35;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.9), boxMat);
  lid.position.set(0, 0.75, -0.45);
  lid.geometry.translate(0, 0, 0.45);
  lid.castShadow = true;
  group.add(lid);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.05), metalMat);
  lock.position.set(0, 0.55, 0.46);
  group.add(lock);

  scene.add(group);
  return { id: Date.now() + Math.random(), group, lid, open: false, x, z, looted: false };
}

function HandWithGun({ recoil, walkBob }: { recoil: number; walkBob: number }) {
  return (
    <group position={[0.35, -0.38 + walkBob * 0.06, -0.55]} rotation={[-0.1 - recoil, 0.25, walkBob * 0.05]}>
      {/* arm */}
      <mesh position={[0, -0.12, -0.12]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.14, 0.35, 0.16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* hand */}
      <mesh position={[0, 0.02, 0.02]}>
        <boxGeometry args={[0.12, 0.14, 0.16]} />
        <meshStandardMaterial color="#d1a982" />
      </mesh>
      {/* gun grip */}
      <mesh position={[-0.05, -0.08, 0.08]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.06, 0.18, 0.08]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {/* gun barrel */}
      <mesh position={[0, 0.02, 0.22]}>
        <boxGeometry args={[0.07, 0.09, 0.42]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  );
}

function Player({
  savedPosition,
  savedRotation,
  onSave,
  recoil,
  collisionBoxes,
}: {
  savedPosition?: { x: number; y: number; z: number };
  savedRotation?: { yaw: number; pitch: number };
  onSave: (data: SaveData) => void;
  recoil: number;
  collisionBoxes: THREE.Box3[];
}) {
  const { camera, scene } = useThree();
  const yaw = useRef(savedRotation?.yaw ?? 0);
  const pitch = useRef(savedRotation?.pitch ?? 0);
  const locked = useRef(false);
  const health = useRef(100);
  const ammo = useRef(30);
  const score = useRef(0);
  const wave = useRef(1);

  useEffect(() => {
    if (savedPosition) {
      camera.position.set(savedPosition.x, savedPosition.y, savedPosition.z);
    }
    if (savedRotation) {
      yaw.current = savedRotation.yaw;
      pitch.current = savedRotation.pitch;
    }
    if (savedDataHealth !== undefined) health.current = savedDataHealth;
    if (savedDataAmmo !== undefined) ammo.current = savedDataAmmo;
    if (savedDataScore !== undefined) score.current = savedDataScore;
    if (savedDataWave !== undefined) wave.current = savedDataWave;
  }, [camera, savedPosition, savedRotation]);

  // expose refs for game loop
  (Player as any).refs = { health, ammo, score, wave };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      KEY[e.key.toLowerCase()] = e.type === 'keydown';
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!locked.current) return;
      yaw.current -= e.movementX * 0.002;
      pitch.current -= e.movementY * 0.002;
      pitch.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch.current));
    };
    const onLock = () => {
      locked.current = document.pointerLockElement === document.body;
    };
    const onClick = () => {
      if (!locked.current) document.body.requestPointerLock?.().catch(() => {});
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onLock);
    window.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onLock);
      window.removeEventListener('click', onClick);
    };
  }, []);

  const walkBob = useRef(0);
  (Player as any).walkBob = walkBob;

  useFrame((state) => {
    const speed = 5;
    const dir = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    if (KEY['w']) dir.add(forward);
    if (KEY['s']) dir.sub(forward);
    if (KEY['a']) dir.sub(right);
    if (KEY['d']) dir.add(right);

    const isMoving = dir.length() > 0;
    if (isMoving) dir.normalize().multiplyScalar(speed * 0.016);

    // collision check: try X then Z separately so sliding works
    const playerRadius = 0.4;
    const nextX = camera.position.clone();
    nextX.x += dir.x;
    let collidesX = false;
    for (const box of collisionBoxes) {
      if (box.containsPoint(nextX) || box.distanceToPoint(nextX) < playerRadius) {
        collidesX = true;
        break;
      }
    }
    if (!collidesX) camera.position.x = nextX.x;

    const nextZ = camera.position.clone();
    nextZ.z += dir.z;
    let collidesZ = false;
    for (const box of collisionBoxes) {
      if (box.containsPoint(nextZ) || box.distanceToPoint(nextZ) < playerRadius) {
        collidesZ = true;
        break;
      }
    }
    if (!collidesZ) camera.position.z = nextZ.z;

    camera.position.y = 1.7;

    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;

    // walk bob for hand
    const t = state.clock.elapsedTime;
    walkBob.current = isMoving ? Math.sin(t * 10) : Math.sin(t * 1.5) * 0.15;

    onSave({
      playerPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      playerRotation: { yaw: yaw.current, pitch: pitch.current },
      health: health.current,
      ammo: ammo.current,
      score: score.current,
      wave: wave.current,
      timestamp: Date.now(),
    });
  });

  return (
    <>
      <spotLight position={camera.position} rotation={camera.rotation} angle={0.6} penumbra={0.4} intensity={80} distance={35} color="#ffccaa" />
      <group position={camera.position} rotation={[camera.rotation.x, camera.rotation.y, 0]}>
        <HandWithGun recoil={recoil} walkBob={walkBob.current} />
      </group>
    </>
  );
}

function Scene({ savedData, onSave, onStats, onHit, recoil, day }: { savedData?: SaveData; onSave: (d: SaveData) => void; onStats: (h: number, a: number, s: number, w: number) => void; onHit: (point: THREE.Vector3) => void; recoil: { current: number }; day: number }) {
  const { camera, scene } = useThree();
  const enemies = useRef<Enemy[]>([]);
  const pickups = useRef<Pickup[]>([]);
  const doors = useRef<Door[]>([]);
  const chests = useRef<Chest[]>([]);
  const wave = useRef(savedData?.wave ?? 1);
  const score = useRef(savedData?.score ?? 0);
  const health = useRef(savedData?.health ?? 100);
  const ammo = useRef(savedData?.ammo ?? 30);
  const gameOver = useRef(false);
  const spawnTimer = useRef(0);
  const spawnedThisWave = useRef(0);
  const lastShot = useRef(0);
  const muzzleFlash = useRef<THREE.PointLight | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);

  // day scaling: harder each day, spawn more
  const dayRef = useRef(day);
  useEffect(() => { dayRef.current = day; }, [day]);

  // spawn doors and chests once
  useEffect(() => {
    // doors near some buildings
    doors.current.push(createDoor(0, -24, 0, 2.2, 3.2, 0.25, scene));
    doors.current.push(createDoor(-30, -16, Math.PI / 2, 2.2, 3.2, 0.25, scene));
    doors.current.push(createDoor(28, -12, Math.PI / 4, 2.2, 3.2, 0.25, scene));

    // chests scattered
    chests.current.push(createChest(-10, 10, Math.PI / 6, scene));
    chests.current.push(createChest(15, 15, -Math.PI / 8, scene));
    chests.current.push(createChest(-25, 25, Math.PI / 3, scene));
    chests.current.push(createChest(30, 8, -Math.PI / 4, scene));
  }, [scene]);

  // sync player saved stats on mount
  useEffect(() => {
    if (savedData) {
      health.current = savedData.health ?? 100;
      ammo.current = savedData.ammo ?? 30;
      score.current = savedData.score ?? 0;
      wave.current = savedData.wave ?? 1;
    }
  }, [savedData]);

  // muzzle flash light
  useEffect(() => {
    const light = new THREE.PointLight('#ffaa55', 0, 8);
    scene.add(light);
    muzzleFlash.current = light;
    return () => {
      scene.remove(light);
    };
  }, [scene]);

  const spawnEnemy = () => {
    const id = Date.now() + Math.random();
    const angle = Math.random() * Math.PI * 2;
    const dist = 25 + Math.random() * 15;
    const x = camera.position.x + Math.cos(angle) * dist;
    const z = camera.position.z + Math.sin(angle) * dist;

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.4, 0.3),
      new THREE.MeshStandardMaterial({ color: '#2d4a22', roughness: 0.9 })
    );
    body.position.y = 0.7;
    body.castShadow = true;
    group.add(body);

    // head
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.35),
      new THREE.MeshStandardMaterial({ color: '#3d5a32' })
    );
    head.position.y = 1.55;
    head.castShadow = true;
    group.add(head);

    // arms
    [-0.32, 0.32].forEach((ox) => {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.8, 0.12),
        new THREE.MeshStandardMaterial({ color: '#2d4a22' })
      );
      arm.position.set(ox, 1, 0.15);
      arm.rotation.x = -0.6;
      group.add(arm);
    });

    scene.add(group);

    enemies.current.push({
      id,
      mesh: group,
      health: 40 + wave.current * 15,
      maxHealth: 40 + wave.current * 15,
      speed: 1.8 + wave.current * 0.25,
      dead: false,
    });
  };

  const spawnPickup = (x: number, z: number) => {
    const type = Math.random() > 0.5 ? 'health' : 'ammo';
    const id = Date.now() + Math.random();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: type === 'health' ? '#22c55e' : '#facc15', emissive: type === 'health' ? '#115522' : '#665500' })
    );
    mesh.position.set(x, 0.25, z);
    mesh.castShadow = true;
    scene.add(mesh);
    pickups.current.push({ id, mesh, type });
  };

  const shoot = () => {
    const now = performance.now();
    if (now - lastShot.current < 180 || ammo.current <= 0 || gameOver.current) return;
    lastShot.current = now;
    ammo.current--;
    recoil.current = 0.25;

    // muzzle flash
    if (muzzleFlash.current) {
      muzzleFlash.current.intensity = 40;
      muzzleFlash.current.position.copy(camera.position).add(new THREE.Vector3(0, 0.1, -0.5).applyQuaternion(camera.quaternion));
      setTimeout(() => {
        if (muzzleFlash.current) muzzleFlash.current.intensity = 0;
      }, 50);
    }

    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const ray = new THREE.Raycaster(camera.position, direction);
    let hit: Enemy | null = null;
    let bestDist = Infinity;
    let hitPoint = new THREE.Vector3();

    for (const e of enemies.current) {
      if (e.dead) continue;
      const target = new THREE.Vector3();
      const box = new THREE.Box3().setFromObject(e.mesh);
      const intersects = ray.ray.intersectBox(box, target);
      if (intersects) {
        const d = target.distanceTo(camera.position);
        if (d < bestDist) {
          bestDist = d;
          hit = e;
          hitPoint.copy(target);
        }
      }
    }

    if (hit) {
      hit.health -= 25;
      if (hit.health <= 0) {
        hit.dead = true;
        score.current += 10 + wave.current * 2;
        if (Math.random() > 0.7) spawnPickup(hit.mesh.position.x, hit.mesh.position.z);
      }
    } else {
      // hit the ground far away
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      hitPoint = new THREE.Vector3();
      ray.ray.intersectPlane(groundPlane, hitPoint);
    }

    onHit(hitPoint);
  };

  useEffect(() => {
    const onMouseDown = () => {
      if (document.pointerLockElement === document.body && !gameOver.current) {
        shoot();
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [camera]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' && !gameOver.current) {
        ammo.current = 30;
      }
      if (e.key.toLowerCase() === 'e' && !gameOver.current) {
        let nearest: Door | null = null;
        let best = Infinity;
        for (const d of doors.current) {
          const dx = camera.position.x - d.x;
          const dz = camera.position.z - d.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 3 && dist < best) {
            best = dist;
            nearest = d;
          }
        }
        if (nearest) {
          nearest.open = !nearest.open;
        }
      }
      if (e.key.toLowerCase() === 'f' && !gameOver.current) {
        let nearest: Chest | null = null;
        let best = Infinity;
        for (const c of chests.current) {
          const dx = camera.position.x - c.x;
          const dz = camera.position.z - c.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 2.5 && dist < best) {
            best = dist;
            nearest = c;
          }
        }
        if (nearest) {
          nearest.open = !nearest.open;
          if (nearest.open && !nearest.looted) {
            nearest.looted = true;
            const type = Math.random() > 0.5 ? 'health' : 'ammo';
            if (type === 'health') health.current = Math.min(100, health.current + 30);
            else ammo.current = Math.min(60, ammo.current + 15);
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useFrame(() => {
    recoil.current = Math.max(0, recoil.current - 0.04);
    if (gameOver.current) return;

    // wave spawning — scale by day
    const waveSize = 5 + dayRef.current * 4;
    spawnTimer.current += 0.016;
    if (spawnedThisWave.current < waveSize && spawnTimer.current > Math.max(0.8, 3 - dayRef.current * 0.1)) {
      spawnEnemy();
      spawnedThisWave.current++;
      spawnTimer.current = 0;
    }
    if (spawnedThisWave.current >= waveSize && enemies.current.filter((e) => !e.dead).length === 0) {
      dayRef.current++;
      spawnedThisWave.current = 0;
      spawnTimer.current = 0;
      health.current = Math.min(100, health.current + 20);
      ammo.current += 15;
    }

    // update enemies
    for (let i = enemies.current.length - 1; i >= 0; i--) {
      const e = enemies.current[i];
      if (e.dead) {
        e.mesh.scale.multiplyScalar(0.85);
        e.mesh.rotation.z += 0.1;
        if (e.mesh.scale.x < 0.05) {
          scene.remove(e.mesh);
          enemies.current.splice(i, 1);
        }
        continue;
      }

      const dx = camera.position.x - e.mesh.position.x;
      const dz = camera.position.z - e.mesh.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);

      if (d > 0.7) {
        e.mesh.position.x += (dx / d) * e.speed * 0.016;
        e.mesh.position.z += (dz / d) * e.speed * 0.016;
      }
      e.mesh.lookAt(camera.position.x, e.mesh.position.y, camera.position.z);

      // hit player
      if (d < 1.2) {
        health.current -= 1.5;
      }
    }

    // animate doors
    for (const d of doors.current) {
      const target = d.open ? -Math.PI / 1.8 : 0;
      d.slab.rotation.y += (target - d.slab.rotation.y) * 0.1;
    }

    // animate chests
    for (const c of chests.current) {
      const target = c.open ? -Math.PI / 1.8 : 0;
      c.lid.rotation.x += (target - c.lid.rotation.x) * 0.1;
    }

    // interaction prompt
    let nearDoor = false;
    for (const d of doors.current) {
      const dx = camera.position.x - d.x;
      const dz = camera.position.z - d.z;
      if (Math.sqrt(dx * dx + dz * dz) < 3) nearDoor = true;
    }
    let nearChest = false;
    for (const c of chests.current) {
      const dx = camera.position.x - c.x;
      const dz = camera.position.z - c.z;
      if (Math.sqrt(dx * dx + dz * dz) < 2.5) nearChest = true;
    }
    if (nearDoor && nearChest) setPrompt('E — DOOR  ·  F — CHEST');
    else if (nearDoor) setPrompt('E — OPEN DOOR');
    else if (nearChest) setPrompt('F — OPEN CHEST');
    else setPrompt(null);

    if (health.current <= 0) {
      health.current = 0;
      gameOver.current = true;
      document.exitPointerLock?.();
    }

    // pickups
    for (let i = pickups.current.length - 1; i >= 0; i--) {
      const p = pickups.current[i];
      const dx = camera.position.x - p.mesh.position.x;
      const dz = camera.position.z - p.mesh.position.z;
      p.mesh.rotation.y += 0.05;
      p.mesh.position.y = 0.25 + Math.sin(performance.now() * 0.005) * 0.1;
      if (dx * dx + dz * dz < 2) {
        if (p.type === 'health') health.current = Math.min(100, health.current + 25);
        else ammo.current += 10;
        scene.remove(p.mesh);
        pickups.current.splice(i, 1);
      }
    }

    onStats(health.current, ammo.current, score.current, dayRef.current);
  });

  return (
    <>
      {prompt && (
        <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-[120%] z-50">
          <div className="bg-black/70 border border-white/20 backdrop-blur-sm px-4 py-2 rounded-sm text-sm font-black tracking-widest text-white shadow-[0_0_20px_rgba(255,255,255,0.15)]">
            {prompt}
          </div>
        </div>
      )}
    </>
  );
}

const SAVE_KEY = 'dead-zone-save-v1';

function formatTime(ts: number) {
  if (!ts) return '';
  return new Date(ts).toLocaleString();
}

let savedDataHealth: number | undefined;
let savedDataAmmo: number | undefined;
let savedDataScore: number | undefined;
let savedDataWave: number | undefined;

function ZombieHand({ delay }: { delay: number }) {
  const hand = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hand.current;
    if (!el) return;
    let raf = 0;
    let start: number | null = null;
    const duration = 2500;

    const animate = (t: number) => {
      if (start === null) start = t;
      const progress = ((t - start + delay) % duration) / duration;
      const y = Math.max(-120, -120 + progress * 160 + Math.sin(progress * Math.PI * 6) * 10);
      const rot = Math.sin(progress * Math.PI * 4) * 8;
      el.style.transform = `translateY(${y}%) rotate(${rot}deg)`;
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [delay]);

  return (
    <div
      ref={hand}
      className="absolute w-16 h-40 opacity-70"
      style={{
        bottom: '-40px',
        left: `${10 + Math.random() * 80}%`,
        filter: 'blur(0.5px) drop-shadow(0 0 8px rgba(0,0,0,0.8))',
      }}
    >
      <svg viewBox="0 0 100 220" className="w-full h-full fill-zinc-800 stroke-black stroke-2">
        <path d="M50 210 C 20 200, 10 160, 15 130 C 5 120, 5 90, 20 85 C 10 70, 15 40, 35 35 C 30 20, 40 5, 55 10 C 60 25, 75 30, 80 50 C 95 55, 100 85, 85 95 C 95 110, 90 140, 75 150 C 80 180, 70 205, 50 210 Z" />
        <ellipse cx="25" cy="85" rx="8" ry="18" />
        <ellipse cx="30" cy="55" rx="7" ry="16" />
        <ellipse cx="50" cy="40" rx="7" ry="16" />
        <ellipse cx="72" cy="58" rx="7" ry="16" />
        <ellipse cx="78" cy="90" rx="7" ry="16" />
      </svg>
    </div>
  );
}

function MenuBackgroundHands() {
  const [hands, setHands] = useState<{ id: number; delay: number; left: number }[]>([]);

  useEffect(() => {
    const h = Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      delay: i * 350,
      left: 5 + (i * 90) / 11 + Math.random() * 6,
    }));
    setHands(h);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
      {hands.map((h) => (
        <div key={h.id} className="absolute bottom-0" style={{ left: `${h.left}%`, transform: 'translateX(-50%)' }}>
          <ZombieHand delay={h.delay} />
        </div>
      ))}
    </div>
  );
}

export default function Game() {
  const [started, setStarted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedData, setSavedData] = useState<SaveData | undefined>(undefined);
  const [hasSave, setHasSave] = useState(false);
  const [health, setHealth] = useState(100);
  const [ammo, setAmmo] = useState(30);
  const [score, setScore] = useState(0);
  const [day, setDay] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [collisionBoxes, setCollisionBoxes] = useState<THREE.Box3[]>([]);
  const currentSave = useRef<SaveData | undefined>(undefined);
  const recoilRef = useRef(0);
  const [hitDots, setHitDots] = useState<{ id: number; x: number; y: number; z: number }[]>([]);

  const onHit = (point: THREE.Vector3) => {
    const id = Date.now() + Math.random();
    setHitDots((prev) => [...prev, { id, x: point.x, y: point.y, z: point.z }]);
    setTimeout(() => {
      setHitDots((prev) => prev.filter((d) => d.id !== id));
    }, 800);
  };

  useEffect(() => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SaveData;
        setSavedData(parsed);
        setHasSave(true);
        currentSave.current = parsed;
        savedDataHealth = parsed.health;
        savedDataAmmo = parsed.ammo;
        savedDataScore = parsed.score;
        savedDataWave = parsed.wave;
      } catch {}
    }
  }, []);

  const saveGame = (data: SaveData) => {
    currentSave.current = data;
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  };

  const handleSaveAndLeave = () => {
    if (currentSave.current) localStorage.setItem(SAVE_KEY, JSON.stringify(currentSave.current));
    setStarted(false);
    setMenuOpen(false);
    setHasSave(true);
    setSavedData(currentSave.current);
    document.exitPointerLock?.();
  };

  const handleResume = () => {
    setMenuOpen(false);
    document.body.requestPointerLock?.().catch(() => {});
  };

  const handleNewGame = () => {
    localStorage.removeItem(SAVE_KEY);
    setSavedData(undefined);
    currentSave.current = undefined;
    setHasSave(false);
    setHealth(100);
    setAmmo(30);
    setScore(0);
    setDay(1);
    setGameOver(false);
    savedDataHealth = undefined;
    savedDataAmmo = undefined;
    savedDataScore = undefined;
    savedDataWave = undefined;
    setStarted(true);
    setMenuOpen(false);
  };

  const handleContinue = () => {
    setStarted(true);
    setMenuOpen(false);
  };

  // starter screen particle / title animation
  const [titlePulse, setTitlePulse] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTitlePulse((p) => (p + 1) % 2), 2000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started || gameOver) return;
      if (e.key === 'Escape') {
        setMenuOpen((open) => {
          const next = !open;
          if (next) document.exitPointerLock?.();
          else document.body.requestPointerLock?.().catch(() => {});
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, gameOver]);

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden text-white font-mono select-none">
      {!started ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black overflow-hidden">
          <MenuBackgroundHands />
          {/* scanlines */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%] pointer-events-none z-10" />
          {/* vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.85)_100%)] pointer-events-none z-10" />
          {/* title */}
          <div className="relative z-20 text-center space-y-8 p-8">
            <div className="relative">
              <h1
                className={`text-7xl md:text-9xl font-black tracking-tighter text-red-600 transition-all duration-1000 ${titlePulse ? 'drop-shadow-[0_0_60px_rgba(220,38,38,0.9)] scale-105' : 'drop-shadow-[0_0_20px_rgba(220,38,38,0.5)] scale-100'}`}
              >
                DEAD ZONE
              </h1>
              <div className="absolute -bottom-3 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-60" />
              <p className="text-zinc-500 text-xs md:text-sm tracking-[0.5em] mt-4 font-bold">SURVIVE THE NIGHT. DISCOVER THE TRUTH.</p>
            </div>

            <div className="flex flex-col items-center gap-3 pt-6">
              <button
                onClick={handleNewGame}
                className="group relative px-14 py-5 bg-red-700 hover:bg-red-600 text-black font-black text-2xl rounded-sm tracking-[0.2em] transition-all hover:scale-105 shadow-[0_0_40px_rgba(220,38,38,0.4)] overflow-hidden"
              >
                <span className="relative z-10">PLAY</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
              </button>
              {hasSave && (
                <button
                  onClick={handleContinue}
                  className="px-12 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-lg rounded-sm tracking-widest transition-all hover:scale-105 border border-white/10"
                >
                  CONTINUE {savedData && <span className="block text-xs font-normal text-zinc-500">{formatTime(savedData.timestamp)}</span>}
                </button>
              )}
              <button className="px-10 py-2 text-zinc-600 hover:text-zinc-400 text-sm font-bold tracking-widest transition-colors">SETTINGS</button>
            </div>

            <div className="pt-8 flex justify-center gap-8 text-[10px] text-zinc-700 font-mono tracking-widest">
              <span>V 0.2.0</span>
              <span>DEAD CITY // REGION 1</span>
              <span>OFFLINE MODE</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {(menuOpen || gameOver) && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
              <div className="rounded bg-zinc-950 border border-white/10 p-8 text-center space-y-4 min-w-[260px]">
                <h2 className={`text-2xl font-black ${gameOver ? 'text-red-500' : 'text-red-500'}`}>
                  {gameOver ? 'YOU DIED' : 'PAUSED'}
                </h2>
                {!gameOver && (
                  <button onClick={handleResume} className="w-full px-6 py-3 bg-red-600 hover:bg-red-500 text-black font-bold rounded-sm">
                    RESUME
                  </button>
                )}
                {gameOver && (
                  <button onClick={handleNewGame} className="w-full px-6 py-3 bg-red-600 hover:bg-red-500 text-black font-bold rounded-sm">
                    RESTART
                  </button>
                )}
                {!gameOver && (
                  <button onClick={handleSaveAndLeave} className="w-full px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-sm border border-white/10">
                    SAVE & LEAVE
                  </button>
                )}
                <button
                  onClick={() => {
                    localStorage.removeItem(SAVE_KEY);
                    setStarted(false);
                    setMenuOpen(false);
                    setGameOver(false);
                    setHasSave(false);
                    setSavedData(undefined);
                    document.exitPointerLock?.();
                  }}
                  className="w-full px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-red-400 font-bold rounded-sm border border-red-900/30"
                >
                  {gameOver ? 'MAIN MENU' : 'ABANDON RUN'}
                </button>
              </div>
            </div>
          )}

          {!menuOpen && !gameOver && (
            <>
              {/* DAMAGE VIGNETTE */}
              <div
                className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-200"
                style={{
                  background: `radial-gradient(circle, transparent 55%, rgba(220,38,38,${Math.max(0, 1 - health / 35)}) 100%)`,
                  opacity: health < 35 ? 1 : 0,
                }}
              />

              {/* CROSSHAIR */}
              <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
                <div className="relative w-8 h-8">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-red-500 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.9)]" />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-red-500/80" />
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-2 bg-red-500/80" />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-red-500/80" />
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[2px] w-2 bg-red-500/80" />
                </div>
              </div>

              {/* TOP LEFT: HP + STAMINA */}
              <div className="pointer-events-none fixed top-5 left-5 z-40 flex flex-col gap-2">
                <div className="bg-black/60 border border-red-900/40 backdrop-blur-sm p-3 rounded-sm shadow-[0_0_20px_rgba(220,38,38,0.15)]">
                  <div className="flex items-center justify-between text-xs font-black tracking-widest text-red-500 mb-1">
                    <span>HEALTH</span>
                    <span>{Math.ceil(health)}%</span>
                  </div>
                  <div className="w-52 h-3 bg-zinc-900/80 border border-zinc-700 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${health < 25 ? 'bg-red-600 animate-pulse' : 'bg-gradient-to-r from-red-700 to-red-500'}`}
                      style={{ width: `${Math.max(0, health)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* TOP RIGHT: WAVE / SCORE */}
              <div className="pointer-events-none fixed top-5 right-5 z-40 text-right">
                <div className="bg-black/60 border border-cyan-900/40 backdrop-blur-sm p-3 rounded-sm shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                  <div className="text-cyan-400 font-black text-2xl tracking-tighter leading-none">DAY {day}</div>
                  <div className="text-zinc-400 text-xs font-bold tracking-widest mt-1">SCORE <span className="text-white">{score}</span></div>
                </div>
              </div>

              {/* BOTTOM LEFT: WEAPON + AMMO */}
              <div className="pointer-events-none fixed bottom-5 left-5 z-40">
                <div className="bg-black/60 border border-yellow-900/40 backdrop-blur-sm p-4 rounded-sm shadow-[0_0_20px_rgba(234,179,8,0.15)] min-w-[180px]">
                  <div className="text-yellow-500 text-xs font-black tracking-widest mb-2">PRIMARY</div>
                  <div className="flex items-end gap-3">
                    <div className="text-5xl font-black text-white leading-none tabular-nums">{ammo}</div>
                    <div className="text-sm text-zinc-500 font-bold mb-1">/ 30</div>
                  </div>
                  <div className="text-zinc-500 text-[10px] font-bold tracking-wider mt-2">R — RELOAD</div>
                </div>
              </div>

              {/* BOTTOM RIGHT: CONTROLS */}
              <div className="pointer-events-none fixed bottom-5 right-5 z-40">
                <div className="bg-black/60 border border-zinc-800 backdrop-blur-sm px-4 py-3 rounded-sm text-[10px] text-zinc-400 font-mono leading-relaxed text-right">
                  <div><span className="text-white font-bold">WASD</span> MOVE</div>
                  <div><span className="text-white font-bold">MOUSE</span> AIM</div>
                  <div><span className="text-white font-bold">CLICK</span> SHOOT</div>
                  <div><span className="text-white font-bold">ESC</span> MENU</div>
                </div>
              </div>
            </>
          )}

          <Canvas shadows camera={{ position: [0, 1.7, 0], fov: 75 }}>
            <color attach="background" args={['#0f0f12']} />
            <ambientLight intensity={0.25} />
            <directionalLight position={[40, 60, 20]} intensity={0.6} castShadow color="#b0b8c0" />
            <World day={day} onCollisionBoxes={setCollisionBoxes} />
            <Player savedPosition={savedData?.playerPosition} savedRotation={savedData?.playerRotation} onSave={saveGame} recoil={recoilRef.current} collisionBoxes={collisionBoxes} />
            <Scene savedData={savedData} onSave={saveGame} onStats={(h, a, s, w) => {
              setHealth(h);
              setAmmo(a);
              setScore(s);
              setDay(w);
              if (h <= 0) setGameOver(true);
            }} onHit={onHit} recoil={recoilRef} day={day} />
            {hitDots.map((d) => (
              <mesh key={d.id} position={[d.x, d.y + 0.02, d.z]}>
                <sphereGeometry args={[0.08, 8, 8]} />
                <meshBasicMaterial color="#ff0000" transparent opacity={0.8} />
              </mesh>
            ))}
          </Canvas>
        </>
      )}
    </div>
  );
}
