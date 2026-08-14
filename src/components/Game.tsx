'use client';

import { useEffect, useRef, useState, Suspense, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, Loader } from '@react-three/drei';
import { useGame } from '@/store';
import { Vector3, LootItem, BuildItem, Stalker } from '@/store';

const GLB_OUTPOST = '/models/source/56qoshq0_toonout_upscayl_2x_ul_Telecommunication_building_with_f.glb';
const GLB_WAREHOUSE = '/models/source/Copilot3D-e7609421-c809-4b38-bb78-0cd1ffa0f989.glb';
const USE_GLBS = false; // disable 60MB models until streaming/lazy load is set up

const KEY: Record<string, boolean> = {};

function dist(a: Vector3, b: Vector3) {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dz * dz);
}

function World() {
  const { buildings, loot, stalkers, selectedBuild, placeBuilding, setSelectedBuild, pickupLoot, player } = useGame();
  const groundRef = useRef<THREE.Mesh>(null);
  const { camera, raycaster, pointer } = useThree();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      KEY[e.key.toLowerCase()] = e.type === 'keydown';
      if (e.key === '1') setSelectedBuild('wall');
      if (e.key === '2') setSelectedBuild('storage');
      if (e.key === '3') setSelectedBuild('campfire');
      if (e.key === 'Escape') setSelectedBuild(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [setSelectedBuild]);

  const handleClick = (e: any) => {
    if (!selectedBuild) return;
    e.stopPropagation();
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObject(groundRef.current!);
    if (intersects.length > 0) {
      const p = intersects[0].point;
      placeBuilding(selectedBuild, [p.x, 0, p.z], 0);
    }
  };

  return (
    <>
      <color attach="background" args={['#050508']} />
      <fog attach="fog" args={['#050508', 10, 50]} />
      <ambientLight intensity={0.05} />

      <mesh ref={groundRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={handleClick}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#1a1a1e" roughness={0.9} metalness={0.1} />
      </mesh>

      <gridHelper args={[200, 100, '#333', '#222']} />

      {/* City block buildings — lightweight boxes instead of 60MB GLBs for instant start */}
      {USE_GLBS ? (
        <Suspense fallback={null}>
          <ModelBuilding position={[-15, 0, -15]} glb={GLB_WAREHOUSE} scale={2} />
          <ModelBuilding position={[15, 0, -15]} glb={GLB_OUTPOST} scale={0.04} />
          <ModelBuilding position={[-15, 0, 15]} glb={GLB_WAREHOUSE} scale={2} />
          <ModelBuilding position={[15, 0, 15]} glb={GLB_OUTPOST} scale={0.04} />
          <ModelBuilding position={[0, 0, -25]} glb={GLB_WAREHOUSE} scale={2} />
        </Suspense>
      ) : (
        <>
          <Building position={[-15, 0, -15]} size={[8, 6, 8]} />
          <Building position={[15, 0, -15]} size={[6, 10, 6]} />
          <Building position={[-15, 0, 15]} size={[8, 5, 8]} />
          <Building position={[15, 0, 15]} size={[6, 8, 6]} />
          <Building position={[0, 0, -25]} size={[10, 5, 10]} />
        </>
      )}

      {buildings.map((b) => (
        <BuildObject key={b.id} b={b} />
      ))}

      {loot.map((l) => (
        <LootObject key={l.id} item={l} onPickup={() => pickupLoot(l.id)} player={player.position} />
      ))}

      {stalkers.map((s) => (
        <StalkerObject key={s.id} s={s} />
      ))}
    </>
  );
}

function ModelBuilding({ position, glb, scale = 1 }: { position: [number, number, number]; glb: string; scale?: number }) {
  const { scene } = useGLTF(glb);
  const cloned = useMemo(() => scene.clone(), [scene]);
  return (
    <group position={position}>
      <primitive object={cloned} scale={scale} castShadow receiveShadow />
    </group>
  );
}

function Building({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={[position[0], size[1] / 2, position[2]]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#2a2a35" roughness={0.8} />
    </mesh>
  );
}

function BuildObject({ b }: { b: BuildItem }) {
  const color = b.type === 'wall' ? '#4a4a55' : b.type === 'storage' ? '#5a4a35' : '#ff6b35';
  const size = b.type === 'wall' ? [3, 2.5, 0.5] : b.type === 'storage' ? [2, 1.5, 1.5] : [1.5, 0.5, 1.5];
  return (
    <mesh position={[b.position[0], size[1] / 2, b.position[2]]} castShadow receiveShadow>
      <boxGeometry args={size as [number, number, number]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

function LootObject({ item, onPickup, player }: { item: LootItem; onPickup: () => void; player: Vector3 }) {
  const color =
    item.type === 'food' ? '#22c55e' : item.type === 'ammo' ? '#facc15' : item.type === 'medicine' ? '#ef4444' : item.type === 'keycard' ? '#a855f7' : '#3b82f6';
  const d = dist(item.position, player);
  return (
    <group position={item.position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          if (d < 3) onPickup();
        }}
      >
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {d < 3 && (
        <mesh position={[0, 0.6, 0]}>
          <planeGeometry args={[1.2, 0.3]} />
          <meshBasicMaterial color="black" transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
}

function StalkerObject({ s }: { s: Stalker }) {
  return (
    <group position={s.position}>
      <mesh castShadow>
        <capsuleGeometry args={[0.4, 1.2, 4, 8]} />
        <meshStandardMaterial color={s.visible ? '#ff0044' : '#1a0000'} emissive={s.visible ? '#330000' : '#000000'} />
      </mesh>
      {s.state === 'attack' && (
        <pointLight color="#ff0044" intensity={2} distance={5} />
      )}
    </group>
  );
}

function PlayerController() {
  const { camera } = useThree();
  const { setPlayerPosition, setPlayerRotation, toggleFlashlight, player, shoot } = useGame();
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const velocity = useRef(new THREE.Vector3());
  const locked = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      KEY[e.key.toLowerCase()] = e.type === 'keydown';
      if (e.type === 'keydown' && e.key === 'f') toggleFlashlight();
      if (e.type === 'keydown' && e.key === ' ') shoot();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!locked.current) return;
      yawRef.current -= e.movementX * 0.002;
      pitchRef.current -= e.movementY * 0.002;
      pitchRef.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitchRef.current));
    };
    const onLock = () => {
      locked.current = document.pointerLockElement === document.body;
    };
    const onClick = () => {
      if (!locked.current) document.body.requestPointerLock();
      else shoot();
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
  }, [toggleFlashlight, shoot, setPlayerPosition, setPlayerRotation]);

  useFrame((_, delta) => {
    const speed = 4;
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

    if (dir.length() > 0) dir.normalize().multiplyScalar(speed * delta);

    const newX = player.position[0] + dir.x;
    const newZ = player.position[2] + dir.z;
    setPlayerPosition([newX, 1.7, newZ]);
    setPlayerRotation(yawRef.current);

    camera.position.set(newX, 1.7, newZ);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yawRef.current;
    camera.rotation.x = pitchRef.current;
  });

  return (
    <>
      <spotLight
        position={camera.position}
        rotation={camera.rotation}
        angle={0.5}
        penumbra={0.3}
        intensity={player.flashlight ? 80 : 0}
        distance={25}
        castShadow
        color="#ffaa77"
      />
    </>
  );
}

function Scene({ started }: { started: boolean }) {
  const { time, isNight, nightNumber, player, gameOver, survived, resetGame, messages, tick } = useGame();
  const cycle = time % 60;
  const dayRatio = cycle / 60;
  const sky = isNight ? '#050508' : '#1a1a24';
  const sunIntensity = isNight ? 0 : 0.3 + dayRatio * 0.4;
  const recentMessages = messages.slice(-4);

  useEffect(() => {
    if (!started) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      tick(delta);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, tick]);

  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 8, 60]} />
      <ambientLight intensity={isNight ? 0.05 : 0.4} />
      <directionalLight position={[20, 30, 10]} intensity={sunIntensity} castShadow color="#ffffff" />

      <World />
      {started && <PlayerController />}

      {/* UI Overlay */}
      {started && <div className="pointer-events-none fixed inset-0 flex flex-col justify-between p-4 font-mono text-xs text-white">
        <div className="flex justify-between">
          <div className="space-y-1 rounded bg-black/60 p-3">
            <div className="text-cyan-400 font-bold">DEAD ZONE</div>
            <div>Night {nightNumber} — {isNight ? '🌙 NIGHT' : '☀️ DAY'}</div>
            <div>Time: {cycle.toFixed(0)}s</div>
            <div>Health: {player.health.toFixed(0)}</div>
            <div>Hunger: {player.hunger.toFixed(0)}</div>
          </div>
          <div className="space-y-1 rounded bg-black/60 p-3 text-right">
            <div>Ammo: {player.ammo}</div>
            <div>Food: {player.food}</div>
            <div>Medicine: {player.medicine}</div>
            <div>Scrap: {player.scrap}</div>
            <div>{player.hasKeycard ? '🔑 KEYCARD' : ''}</div>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div className="rounded bg-black/60 p-3">
            <div className="text-gray-400 mb-1">Controls</div>
            <div>WASD move | Mouse look | Click shoot</div>
            <div>F flashlight | 1 Wall | 2 Storage | 3 Campfire | ESC cancel</div>
          </div>
          <div className="max-w-xs rounded bg-black/60 p-3 text-[10px] text-gray-300">
            {recentMessages.map((m, i) => (
              <div key={i} className={m.includes('died') ? 'text-red-400' : m.includes('KEYCARD') ? 'text-purple-400' : ''}>
                {m}
              </div>
            ))}
          </div>
        </div>

        {(gameOver || survived) && (
          <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="rounded bg-black p-8 text-center border border-white/10">
              <div className="mb-4 text-2xl font-bold text-red-500">{gameOver ? 'YOU DIED' : 'SURVIVED'}</div>
              <button onClick={resetGame} className="rounded bg-cyan-500 px-6 py-2 text-black font-bold hover:bg-cyan-400">
                Restart
              </button>
            </div>
          </div>
        )}
      </div>}
    </>
  );
}

export default function Game() {
  const [started, setStarted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePlay = () => {
    setStarted(true);
    setTimeout(() => {
      document.body.requestPointerLock?.().catch(() => {});
    }, 300);
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      {!started && (
        <div className="pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-black via-zinc-950 to-red-950 text-white">
          <div className="text-center space-y-6 p-8">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-red-500 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]">
              DEAD ZONE
            </h1>
            <p className="text-zinc-400 text-sm md:text-base max-w-md mx-auto font-mono">
              Survive the night. Loot abandoned blocks. Build shelter. Don't let the Stalkers find you.
            </p>
            <div className="flex flex-col items-center gap-3 pt-4">
              <button
                onClick={handlePlay}
                className="px-10 py-4 bg-red-600 hover:bg-red-500 text-black font-black text-xl rounded-sm tracking-widest transition-all hover:scale-105 shadow-[0_0_30px_rgba(220,38,38,0.4)]"
              >
                PLAY
              </button>
              <div className="text-zinc-500 text-[10px] font-mono">
                WASD move · Mouse look · Click shoot · F flashlight
              </div>
            </div>
          </div>
        </div>
      )}
      {mounted && (
        <Canvas shadows camera={{ position: [0, 1.7, 0], fov: 75 }}>
          {started && <Scene started={started} />}
        </Canvas>
      )}
      <Loader
        containerStyles={{
          position: 'absolute',
          inset: 0,
          background: '#000',
          display: started ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          color: '#fff',
          fontFamily: 'monospace',
        }}
        innerStyles={{
          width: '280px',
          height: '6px',
          background: '#222',
          borderRadius: '0',
        }}
        barStyles={{
          background: '#dc2626',
        }}
        dataStyles={{
          color: '#aaa',
          fontSize: '12px',
          marginTop: '12px',
          textAlign: 'center',
        }}
        initialState={(active) => active}
        dataInterpolation={(p) => `LOADING SECTOR... ${p.toFixed(0)}%`}
      />
    </div>
  );
}

useGLTF.preload(GLB_OUTPOST);
useGLTF.preload(GLB_WAREHOUSE);
