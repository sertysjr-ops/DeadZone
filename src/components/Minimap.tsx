'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TreeState } from './world/types';

export interface WorldSnapshot {
  player: { x: number; z: number; yaw: number };
  enemies: { x: number; z: number }[];
  chests: { x: number; z: number }[];
  doors: { x: number; z: number }[];
  collisionBoxes: THREE.Box3[];
  trees: TreeState[];
}

interface MinimapProps {
  show: boolean;
  worldRef: React.MutableRefObject<WorldSnapshot>;
  exploredRef: React.MutableRefObject<boolean[][]>;
}

const GRID_SIZE = 100;
const CELL_SIZE = 2;
const CANVAS_SIZE = 320;
const VISIBLE_WORLD = 160;
const SCALE = CANVAS_SIZE / VISIBLE_WORLD;
const CENTER = CANVAS_SIZE / 2;

const COLOR_EMPTY = '#2a2a2e';
const COLOR_UNEXPLORED = '#000000';
const COLOR_BUILDING = '#880000';
const COLOR_TREE = '#225522';
const COLOR_CHEST = '#ccaa00';
const COLOR_DOOR = '#2266cc';
const COLOR_ZOMBIE = '#ffffff';
const COLOR_PLAYER = '#00ffff';

export function Minimap({ show, worldRef, exploredRef }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!show) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const { player, enemies, chests, doors, collisionBoxes, trees } = worldRef.current;
      const explored = exploredRef.current;

      // background
      ctx.fillStyle = COLOR_UNEXPLORED;
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // visible world bounds in grid coords
      const minWorldX = player.x - VISIBLE_WORLD / 2;
      const maxWorldX = player.x + VISIBLE_WORLD / 2;
      const minWorldZ = player.z - VISIBLE_WORLD / 2;
      const maxWorldZ = player.z + VISIBLE_WORLD / 2;

      const minGx = Math.max(0, Math.floor((minWorldX + 100) / CELL_SIZE));
      const maxGx = Math.min(GRID_SIZE - 1, Math.floor((maxWorldX + 100) / CELL_SIZE));
      const minGz = Math.max(0, Math.floor((minWorldZ + 100) / CELL_SIZE));
      const maxGz = Math.min(GRID_SIZE - 1, Math.floor((maxWorldZ + 100) / CELL_SIZE));

      // explored empty terrain
      ctx.fillStyle = COLOR_EMPTY;
      for (let gx = minGx; gx <= maxGx; gx++) {
        for (let gz = minGz; gz <= maxGz; gz++) {
          if (!explored[gx][gz]) continue;
          const wx = gx * CELL_SIZE - 100 + CELL_SIZE / 2;
          const wz = gz * CELL_SIZE - 100 + CELL_SIZE / 2;
          const cx = CENTER + (wx - player.x) * SCALE;
          const cy = CENTER + (wz - player.z) * SCALE;
          const size = CELL_SIZE * SCALE;
          ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
        }
      }

      const isExplored = (wx: number, wz: number) => {
        const gx = Math.floor((wx + 100) / CELL_SIZE);
        const gz = Math.floor((wz + 100) / CELL_SIZE);
        if (gx < 0 || gx >= GRID_SIZE || gz < 0 || gz >= GRID_SIZE) return false;
        return explored[gx][gz];
      };

      const isBoxExplored = (box: THREE.Box3) => {
        const cx = (box.min.x + box.max.x) / 2;
        const cz = (box.min.z + box.max.z) / 2;
        return isExplored(cx, cz);
      };

      // collision boxes (buildings / props)
      ctx.fillStyle = COLOR_BUILDING;
      for (const box of collisionBoxes) {
        if (!box) continue;
        if (!isBoxExplored(box)) continue;
        const x1 = CENTER + (box.min.x - player.x) * SCALE;
        const y1 = CENTER + (box.min.z - player.z) * SCALE;
        const x2 = CENTER + (box.max.x - player.x) * SCALE;
        const y2 = CENTER + (box.max.z - player.z) * SCALE;
        if (x2 < 0 || x1 > CANVAS_SIZE || y2 < 0 || y1 > CANVAS_SIZE) continue;
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      }

      // trees
      ctx.fillStyle = COLOR_TREE;
      for (const t of trees) {
        if (t.health <= 0) continue;
        if (!isExplored(t.x, t.z)) continue;
        const cx = CENTER + (t.x - player.x) * SCALE;
        const cy = CENTER + (t.z - player.z) * SCALE;
        if (cx < -4 || cx > CANVAS_SIZE + 4 || cy < -4 || cy > CANVAS_SIZE + 4) continue;
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
      }

      // chests
      ctx.fillStyle = COLOR_CHEST;
      for (const c of chests) {
        const cx = CENTER + (c.x - player.x) * SCALE;
        const cy = CENTER + (c.z - player.z) * SCALE;
        if (cx < -4 || cx > CANVAS_SIZE + 4 || cy < -4 || cy > CANVAS_SIZE + 4) continue;
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
      }

      // doors
      ctx.fillStyle = COLOR_DOOR;
      for (const d of doors) {
        const cx = CENTER + (d.x - player.x) * SCALE;
        const cy = CENTER + (d.z - player.z) * SCALE;
        if (cx < -4 || cx > CANVAS_SIZE + 4 || cy < -4 || cy > CANVAS_SIZE + 4) continue;
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
      }

      // zombies (only if their cell is explored)
      ctx.fillStyle = COLOR_ZOMBIE;
      for (const e of enemies) {
        const gx = Math.floor((e.x + 100) / CELL_SIZE);
        const gz = Math.floor((e.z + 100) / CELL_SIZE);
        if (gx < 0 || gx >= GRID_SIZE || gz < 0 || gz >= GRID_SIZE) continue;
        if (!explored[gx][gz]) continue;
        const cx = CENTER + (e.x - player.x) * SCALE;
        const cy = CENTER + (e.z - player.z) * SCALE;
        if (cx < -3 || cx > CANVAS_SIZE + 3 || cy < -3 || cy > CANVAS_SIZE + 3) continue;
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // player arrow
      ctx.save();
      ctx.translate(CENTER, CENTER);
      ctx.rotate(player.yaw);
      ctx.fillStyle = COLOR_PLAYER;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5, 5);
      ctx.lineTo(0, 2);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [show, worldRef, exploredRef]);

  if (!show) return null;

  return (
    <div className="fixed top-5 left-5 z-50 bg-black/80 border border-white/20 backdrop-blur-sm p-2 rounded-sm shadow-[0_0_30px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="text-[10px] font-black tracking-[0.2em] text-cyan-400">MINIMAP</div>
        <div className="text-[9px] text-zinc-500 font-mono">M TO CLOSE</div>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="block bg-black rounded-sm"
        style={{ imageRendering: 'pixelated' as const }}
      />
      <div className="grid grid-cols-3 gap-x-3 gap-y-1 mt-2 px-1 text-[9px] text-zinc-400 font-mono">
        <div><span className="inline-block w-2 h-2 bg-[#880000] mr-1 align-middle" />Bldg</div>
        <div><span className="inline-block w-2 h-2 bg-[#225522] mr-1 align-middle" />Tree</div>
        <div><span className="inline-block w-2 h-2 bg-[#ccaa00] mr-1 align-middle" />Chest</div>
        <div><span className="inline-block w-2 h-2 bg-[#2266cc] mr-1 align-middle" />Door</div>
        <div><span className="inline-block w-2 h-2 bg-white rounded-full mr-1 align-middle" />Zed</div>
        <div><span className="inline-block w-0 h-0 border-l-[4px] border-r-[4px] border-b-[8px] border-l-transparent border-r-transparent border-b-cyan-400 mr-1 align-middle" />You</div>
      </div>
    </div>
  );
}
