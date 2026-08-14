'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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

function HandWithGun({ recoil }: { recoil: number }) {
  return (
    <group position={[0.35, -0.38, -0.55]} rotation={[-0.1 - recoil, 0.25, 0]}>
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

function World() {
  return (
    <>
      <color attach="background" args={['#1a1a20']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[20, 40, 10]} intensity={1.2} castShadow color="#ffffff" />
      <pointLight position={[0, 8, 0]} intensity={0.5} color="#ff4444" distance={40} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#252528" roughness={1} />
      </mesh>

      <gridHelper args={[300, 150, '#444', '#333']} position={[0, 0.05, 0]} />

      {/* scattered buildings */}
      {[
        [0, 3, -30, 12, 6, 12],
        [-30, 4, -20, 8, 8, 8],
        [28, 2.5, -15, 10, 5, 10],
        [-18, 3.5, 22, 9, 7, 9],
        [22, 4, 25, 7, 8, 7],
        [-35, 2, 10, 6, 4, 6],
        [35, 3, 5, 8, 6, 8],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} castShadow receiveShadow>
          <boxGeometry args={[w as number, h as number, d as number]} />
          <meshStandardMaterial color="#3a3a42" roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

function Player({
  savedPosition,
  savedRotation,
  onSave,
  recoil,
}: {
  savedPosition?: { x: number; y: number; z: number };
  savedRotation?: { yaw: number; pitch: number };
  onSave: (data: SaveData) => void;
  recoil: number;
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

  useFrame(() => {
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

    if (dir.length() > 0) dir.normalize().multiplyScalar(speed * 0.016);

    camera.position.x += dir.x;
    camera.position.z += dir.z;
    camera.position.y = 1.7;

    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;

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
        <HandWithGun recoil={recoil} />
      </group>
    </>
  );
}

function Scene({ savedData, onSave, onStats, onHit, recoil }: { savedData?: SaveData; onSave: (d: SaveData) => void; onStats: (h: number, a: number, s: number, w: number) => void; onHit: (point: THREE.Vector3) => void; recoil: { current: number } }) {
  const { camera, scene } = useThree();
  const enemies = useRef<Enemy[]>([]);
  const pickups = useRef<Pickup[]>([]);
  const wave = useRef(savedData?.wave ?? 1);
  const score = useRef(savedData?.score ?? 0);
  const health = useRef(savedData?.health ?? 100);
  const ammo = useRef(savedData?.ammo ?? 30);
  const gameOver = useRef(false);
  const spawnTimer = useRef(0);
  const spawnedThisWave = useRef(0);
  const lastShot = useRef(0);
  const muzzleFlash = useRef<THREE.PointLight | null>(null);

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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useFrame(() => {
    recoil.current = Math.max(0, recoil.current - 0.04);
    if (gameOver.current) return;

    // wave spawning
    const waveSize = 5 + wave.current * 3;
    spawnTimer.current += 0.016;
    if (spawnedThisWave.current < waveSize && spawnTimer.current > Math.max(1.5, 3.5 - wave.current * 0.15)) {
      spawnEnemy();
      spawnedThisWave.current++;
      spawnTimer.current = 0;
    }
    if (spawnedThisWave.current >= waveSize && enemies.current.filter((e) => !e.dead).length === 0) {
      wave.current++;
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

    onStats(health.current, ammo.current, score.current, wave.current);
  });

  return null;
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
  const [wave, setWave] = useState(1);
  const [gameOver, setGameOver] = useState(false);
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
    setWave(1);
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
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-black via-zinc-950 to-red-950">
          <MenuBackgroundHands />
          <div className="relative z-20 text-center space-y-6 p-8">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-red-500 drop-shadow-[0_0_30px_rgba(220,38,38,0.8)]">
              DEAD ZONE
            </h1>
            <div className="flex flex-col items-center gap-3 pt-4">
              <button
                onClick={handleNewGame}
                className="px-10 py-4 bg-red-600 hover:bg-red-500 text-black font-black text-xl rounded-sm tracking-widest transition-all hover:scale-105 shadow-[0_0_30px_rgba(220,38,38,0.4)]"
              >
                NEW GAME
              </button>
              {hasSave && (
                <button
                  onClick={handleContinue}
                  className="px-10 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-lg rounded-sm tracking-widest transition-all hover:scale-105 border border-white/10"
                >
                  CONTINUE {savedData && <span className="block text-xs font-normal text-zinc-400">{formatTime(savedData.timestamp)}</span>}
                </button>
              )}
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
              {/* HUD */}
              <div className="pointer-events-none fixed top-4 left-4 right-4 z-40 flex justify-between items-start">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-bold">HP</span>
                    <div className="w-40 h-4 bg-zinc-900 border border-zinc-700">
                      <div className="h-full bg-red-600 transition-all" style={{ width: `${health}%` }} />
                    </div>
                    <span className="text-sm">{Math.ceil(health)}</span>
                  </div>
                  <div className="text-yellow-400 text-sm">AMMO {ammo} <span className="text-zinc-500 text-xs">(R reload)</span></div>
                </div>
                <div className="text-right">
                  <div className="text-cyan-400 font-bold text-lg">WAVE {wave}</div>
                  <div className="text-zinc-300 text-sm">SCORE {score}</div>
                </div>
              </div>

              <div className="pointer-events-none fixed bottom-6 left-0 right-0 z-40 flex justify-center">
                <div className="rounded bg-black/60 px-4 py-2 text-xs text-zinc-300">
                  WASD move · Mouse aim · Click shoot · R reload · ESC menu
                </div>
              </div>
            </>
          )}

          <Canvas shadows camera={{ position: [0, 1.7, 0], fov: 75 }}>
            <World />
            <Player savedPosition={savedData?.playerPosition} savedRotation={savedData?.playerRotation} onSave={saveGame} recoil={recoilRef.current} />
            <Scene savedData={savedData} onSave={saveGame} onStats={(h, a, s, w) => {
              setHealth(h);
              setAmmo(a);
              setScore(s);
              setWave(w);
              if (h <= 0) setGameOver(true);
            }} onHit={onHit} recoil={recoilRef} />
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
