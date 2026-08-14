'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const KEY: Record<string, boolean> = {};

interface SaveData {
  playerPosition: { x: number; y: number; z: number };
  playerRotation: { yaw: number; pitch: number };
  timestamp: number;
}

function Hand() {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.position.set(0.35, -0.35, -0.55);
    group.current.rotation.set(-0.1 + Math.sin(t * 8) * 0.02, 0.2, 0);
  });

  return (
    <group ref={group}>
      <mesh position={[0, -0.15, -0.1]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.14, 0.35, 0.16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0, 0.05, 0.02]}>
        <boxGeometry args={[0.13, 0.16, 0.18]} />
        <meshStandardMaterial color="#d1a982" />
      </mesh>
      <mesh position={[-0.04, 0.08, 0.12]}>
        <boxGeometry args={[0.025, 0.12, 0.08]} />
        <meshStandardMaterial color="#d1a982" />
      </mesh>
      <mesh position={[0, 0.1, 0.11]}>
        <boxGeometry args={[0.025, 0.14, 0.08]} />
        <meshStandardMaterial color="#d1a982" />
      </mesh>
      <mesh position={[0.04, 0.08, 0.1]}>
        <boxGeometry args={[0.025, 0.12, 0.08]} />
        <meshStandardMaterial color="#d1a982" />
      </mesh>
      <mesh position={[-0.08, 0, 0.04]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.035, 0.08, 0.05]} />
        <meshStandardMaterial color="#d1a982" />
      </mesh>
    </group>
  );
}

function World() {
  return (
    <>
      <color attach="background" args={['#87ceeb']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow color="#ffffff" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#3a5f0b" roughness={0.9} />
      </mesh>

      <gridHelper args={[500, 100, '#ffffff', '#888888']} position={[0, 0.05, 0]} />

      <mesh position={[0, 2.5, -20]} castShadow receiveShadow>
        <boxGeometry args={[10, 5, 10]} />
        <meshStandardMaterial color="#4a4a55" />
      </mesh>
      <mesh position={[-18, 3, -12]} castShadow receiveShadow>
        <boxGeometry args={[6, 6, 6]} />
        <meshStandardMaterial color="#4a4a55" />
      </mesh>
      <mesh position={[18, 2, -15]} castShadow receiveShadow>
        <boxGeometry args={[7, 4, 7]} />
        <meshStandardMaterial color="#4a4a55" />
      </mesh>
    </>
  );
}

function Player({
  savedPosition,
  savedRotation,
  onSave,
}: {
  savedPosition?: { x: number; y: number; z: number };
  savedRotation?: { yaw: number; pitch: number };
  onSave: (data: SaveData) => void;
}) {
  const { camera } = useThree();
  const yaw = useRef(savedRotation?.yaw ?? 0);
  const pitch = useRef(savedRotation?.pitch ?? 0);
  const locked = useRef(false);

  useEffect(() => {
    if (savedPosition) {
      camera.position.set(savedPosition.x, savedPosition.y, savedPosition.z);
    }
  }, [camera, savedPosition]);

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
      timestamp: Date.now(),
    });
  });

  return (
    <>
      <spotLight position={camera.position} rotation={camera.rotation} angle={0.5} penumbra={0.3} intensity={60} distance={25} color="#ffaa77" />
      <group position={camera.position} rotation={[camera.rotation.x, camera.rotation.y, 0]}>
        <Hand />
      </group>
    </>
  );
}

function Scene({ savedData, onSave }: { savedData?: SaveData; onSave: (data: SaveData) => void }) {
  return (
    <>
      <World />
      <Player savedPosition={savedData?.playerPosition} savedRotation={savedData?.playerRotation} onSave={onSave} />
      <mesh position={[0, 0, -1]}>
        <ringGeometry args={[0.015, 0.02, 32]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.7} />
      </mesh>
    </>
  );
}

const SAVE_KEY = 'dead-zone-save-v1';

function formatTime(ts: number) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString();
}

export default function Game() {
  const [started, setStarted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedData, setSavedData] = useState<SaveData | undefined>(undefined);
  const [hasSave, setHasSave] = useState(false);
  const currentSave = useRef<SaveData | undefined>(undefined);

  useEffect(() => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SaveData;
        setSavedData(parsed);
        setHasSave(true);
        currentSave.current = parsed;
      } catch {}
    }
  }, []);

  const saveGame = (data: SaveData) => {
    currentSave.current = data;
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  };

  const handleSaveAndLeave = () => {
    if (currentSave.current) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(currentSave.current));
    }
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
    setStarted(true);
    setMenuOpen(false);
  };

  const handleContinue = () => {
    setStarted(true);
    setMenuOpen(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started) return;
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
  }, [started]);

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden text-white font-mono select-none">
      {!started ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-black via-zinc-950 to-red-950">
          <div className="text-center space-y-6 p-8">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-red-500 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]">
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
          {menuOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
              <div className="rounded bg-zinc-950 border border-white/10 p-8 text-center space-y-4 min-w-[260px]">
                <h2 className="text-2xl font-black text-red-500">PAUSED</h2>
                <button
                  onClick={handleResume}
                  className="w-full px-6 py-3 bg-red-600 hover:bg-red-500 text-black font-bold rounded-sm"
                >
                  RESUME
                </button>
                <button
                  onClick={handleSaveAndLeave}
                  className="w-full px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-sm border border-white/10"
                >
                  SAVE & LEAVE
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem(SAVE_KEY);
                    setStarted(false);
                    setMenuOpen(false);
                    setHasSave(false);
                    setSavedData(undefined);
                    document.exitPointerLock?.();
                  }}
                  className="w-full px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-red-400 font-bold rounded-sm border border-red-900/30"
                >
                  ABANDON RUN
                </button>
              </div>
            </div>
          )}

          {!menuOpen && (
            <div className="pointer-events-none fixed inset-0 z-40 flex items-end justify-center p-6">
              <div className="rounded bg-black/60 px-4 py-2 text-xs text-zinc-300">
                WASD move · Mouse look · ESC menu · Click lock
              </div>
            </div>
          )}

          <Canvas shadows camera={{ position: [0, 1.7, 0], fov: 75 }}>
            <Scene savedData={savedData} onSave={saveGame} />
          </Canvas>
        </>
      )}
    </div>
  );
}
