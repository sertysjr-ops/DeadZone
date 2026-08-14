'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const KEY: Record<string, boolean> = {};

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
      {/* forearm */}
      <mesh position={[0, -0.15, -0.1]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.14, 0.35, 0.16]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* hand */}
      <mesh position={[0, 0.05, 0.02]}>
        <boxGeometry args={[0.13, 0.16, 0.18]} />
        <meshStandardMaterial color="#d1a982" />
      </mesh>
      {/* fingers */}
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
      {/* thumb */}
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

      {/* a few simple block buildings */}
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

function Player() {
  const { camera } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(0);
  const locked = useRef(false);

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

  useFrame((_, delta) => {
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

    if (dir.length() > 0) dir.normalize().multiplyScalar(speed * delta);

    camera.position.x += dir.x;
    camera.position.z += dir.z;
    camera.position.y = 1.7;

    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;
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

function Scene() {
  return (
    <>
      <World />
      <Player />
      {/* crosshair */}
      <mesh position={[0, 0, -1]}>
        <ringGeometry args={[0.015, 0.02, 32]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.7} />
      </mesh>
    </>
  );
}

export default function Game() {
  const [started, setStarted] = useState(false);

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden text-white font-mono">
      {!started ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-black via-zinc-950 to-red-950">
          <div className="text-center space-y-6 p-8">
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-red-500 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]">
              DEAD ZONE
            </h1>
            <button
              onClick={() => setStarted(true)}
              className="px-10 py-4 bg-red-600 hover:bg-red-500 text-black font-black text-xl rounded-sm tracking-widest transition-all hover:scale-105 shadow-[0_0_30px_rgba(220,38,38,0.4)]"
            >
              PLAY
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-6">
            <div className="rounded bg-black/60 px-4 py-2 text-xs text-zinc-300">
              WASD move · Mouse look · ESC unlock · Click lock
            </div>
          </div>
          <Canvas shadows camera={{ position: [0, 1.7, 0], fov: 75 }}>
            <Scene />
          </Canvas>
        </>
      )}
    </div>
  );
}
