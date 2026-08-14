import { create } from 'zustand';

export type Vector3 = [number, number, number];

export interface LootItem {
  id: string;
  name: string;
  position: Vector3;
  type: 'food' | 'ammo' | 'medicine' | 'scrap' | 'weapon' | 'keycard';
  amount: number;
}

export interface BuildItem {
  id: string;
  type: 'wall' | 'storage' | 'campfire';
  position: Vector3;
  rotation: number;
}

export interface Stalker {
  id: string;
  position: Vector3;
  targetPosition: Vector3;
  visible: boolean;
  state: 'idle' | 'follow' | 'attack';
  health: number;
  lastSeen: number;
}

export interface GameState {
  player: {
    position: Vector3;
    rotation: number;
    health: number;
    hunger: number;
    stamina: number;
    ammo: number;
    food: number;
    medicine: number;
    scrap: number;
    hasKeycard: boolean;
    flashlight: boolean;
  };
  time: number;
  isNight: boolean;
  nightNumber: number;
  survived: boolean;
  gameOver: boolean;
  loot: LootItem[];
  buildings: BuildItem[];
  stalkers: Stalker[];
  selectedBuild: 'wall' | 'storage' | 'campfire' | null;
  messages: string[];
}

export interface GameActions {
  setPlayerPosition: (position: Vector3) => void;
  setPlayerRotation: (rotation: number) => void;
  toggleFlashlight: () => void;
  damagePlayer: (amount: number) => void;
  healPlayer: (amount: number) => void;
  consumeFood: () => void;
  useMedicine: () => void;
  addAmmo: (amount: number) => void;
  pickupLoot: (id: string) => void;
  spendAmmo: (amount: number) => boolean;
  addScrap: (amount: number) => void;
  tick: (delta: number) => void;
  placeBuilding: (type: BuildItem['type'], position: Vector3, rotation: number) => boolean;
  setSelectedBuild: (type: BuildItem['type'] | null) => void;
  shoot: () => boolean;
  resetGame: () => void;
  addMessage: (msg: string) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function spawnLoot(count: number): LootItem[] {
  const items: LootItem[] = [];
  const types: LootItem['type'][] = ['food', 'ammo', 'medicine', 'scrap', 'weapon'];
  for (let i = 0; i < count; i++) {
    items.push({
      id: uid(),
      name: types[Math.floor(Math.random() * types.length)],
      position: [Math.random() * 60 - 30, 0.5, Math.random() * 60 - 30],
      type: types[Math.floor(Math.random() * types.length)],
      amount: 1 + Math.floor(Math.random() * 3),
    });
  }
  return items;
}

const DAY_DURATION = 60;

const initialState = (): GameState => ({
  player: {
    position: [0, 1.7, 0],
    rotation: 0,
    health: 100,
    hunger: 100,
    stamina: 100,
    ammo: 15,
    food: 0,
    medicine: 0,
    scrap: 0,
    hasKeycard: false,
    flashlight: true,
  },
  time: 0,
  isNight: false,
  nightNumber: 1,
  survived: false,
  gameOver: false,
  loot: spawnLoot(40),
  buildings: [],
  stalkers: [],
  selectedBuild: null,
  messages: ['Night 1 begins soon. Find shelter.'],
});

export const useGame = create<GameState & GameActions>((set, get) => ({
  ...initialState(),

  setPlayerPosition: (position) =>
    set((state) => ({ player: { ...state.player, position } })),

  setPlayerRotation: (rotation) =>
    set((state) => ({ player: { ...state.player, rotation } })),

  toggleFlashlight: () =>
    set((state) => ({ player: { ...state.player, flashlight: !state.player.flashlight } })),

  damagePlayer: (amount) =>
    set((state) => {
      const health = Math.max(0, state.player.health - amount);
      if (health <= 0 && !state.gameOver) {
        return { player: { ...state.player, health: 0 }, gameOver: true, messages: [...state.messages, 'You died.'] };
      }
      return { player: { ...state.player, health } };
    }),

  healPlayer: (amount) =>
    set((state) => ({ player: { ...state.player, health: Math.min(100, state.player.health + amount) } })),

  consumeFood: () =>
    set((state) => {
      if (state.player.food <= 0) return state;
      return {
        player: {
          ...state.player,
          food: state.player.food - 1,
          hunger: Math.min(100, state.player.hunger + 25),
          health: Math.min(100, state.player.health + 5),
        },
      };
    }),

  useMedicine: () =>
    set((state) => {
      if (state.player.medicine <= 0) return state;
      return {
        player: {
          ...state.player,
          medicine: state.player.medicine - 1,
          health: Math.min(100, state.player.health + 40),
        },
      };
    }),

  addAmmo: (amount) =>
    set((state) => ({ player: { ...state.player, ammo: state.player.ammo + amount } })),

  addScrap: (amount) =>
    set((state) => ({ player: { ...state.player, scrap: state.player.scrap + amount } })),

  pickupLoot: (id) =>
    set((state) => {
      const item = state.loot.find((l) => l.id === id);
      if (!item) return state;
      const next = { ...state.player };
      let msg = `Picked up ${item.name} x${item.amount}`;
      switch (item.type) {
        case 'food':
          next.food += item.amount;
          break;
        case 'ammo':
          next.ammo += item.amount;
          break;
        case 'medicine':
          next.medicine += item.amount;
          break;
        case 'scrap':
          next.scrap += item.amount;
          break;
        case 'weapon':
          next.ammo += 10;
          msg = 'Found a weapon + ammo';
          break;
        case 'keycard':
          next.hasKeycard = true;
          msg = 'Found the CORE KEYCARD';
          break;
      }
      return {
        player: next,
        loot: state.loot.filter((l) => l.id !== id),
        messages: [...state.messages.slice(-5), msg],
      };
    }),

  spendAmmo: (amount) => {
    const state = get();
    if (state.player.ammo < amount) return false;
    set({ player: { ...state.player, ammo: state.player.ammo - amount } });
    return true;
  },

  shoot: () => {
    const state = get();
    if (state.player.ammo <= 0) return false;
    set({ player: { ...state.player, ammo: state.player.ammo - 1 } });
    return true;
  },

  placeBuilding: (type, position, rotation) => {
    const state = get();
    const costs = { wall: 5, storage: 10, campfire: 3 };
    if (state.player.scrap < costs[type]) return false;
    set({
      player: { ...state.player, scrap: state.player.scrap - costs[type] },
      buildings: [...state.buildings, { id: uid(), type, position, rotation }],
      messages: [...state.messages.slice(-5), `Built ${type}`],
    });
    return true;
  },

  setSelectedBuild: (type) => set({ selectedBuild: type }),

  tick: (delta) =>
    set((state) => {
      if (state.gameOver || state.survived) return state;

      const time = state.time + delta;
      const cycle = time % DAY_DURATION;
      const isNight = cycle > DAY_DURATION * 0.6;
      const nightNumber = Math.floor(time / DAY_DURATION) + 1;

      let hunger = state.player.hunger - delta * 0.3;
      if (hunger <= 0) hunger = 0;
      let health = state.player.health;
      if (hunger <= 0) health -= delta * 0.5;

      let stalkers = [...state.stalkers];

      if (isNight && stalkers.length === 0) {
        for (let i = 0; i < nightNumber + 1; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 20 + Math.random() * 15;
          stalkers.push({
            id: uid(),
            position: [state.player.position[0] + Math.cos(angle) * dist, 0, state.player.position[2] + Math.sin(angle) * dist],
            targetPosition: [state.player.position[0], 0, state.player.position[2]],
            visible: false,
            state: 'follow',
            health: 40,
            lastSeen: 0,
          });
        }
      }

      if (!isNight) {
        stalkers = [];
      }

      const px = state.player.position[0];
      const pz = state.player.position[2];

      stalkers = stalkers.map((s) => {
        const dx = px - s.position[0];
        const dz = pz - s.position[2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        const visible = dist < 15 && (state.player.flashlight || !isNight);

        let speed = 1.5 + nightNumber * 0.2;
        if (s.state === 'attack') speed = 4.5;
        else if (visible) speed = 2.5;
        else if (dist < 25) speed = 1.5;
        else speed = 0.5;

        const move = Math.min(dist, speed * delta);
        const nx = s.position[0] + (dx / dist) * move;
        const nz = s.position[2] + (dz / dist) * move;

        let stateName = s.state;
        if (dist < 2) stateName = 'attack';
        else if (visible) stateName = 'follow';
        else stateName = 'follow';

        return {
          ...s,
          position: [nx, 0, nz],
          targetPosition: [px, 0, pz],
          visible,
          state: stateName as Stalker['state'],
        };
      });

      // Damage if close
      for (const s of stalkers) {
        const dx = px - s.position[0];
        const dz = pz - s.position[2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 1.5) {
          health -= delta * 20;
        }
      }

      if (health <= 0) {
        return { player: { ...state.player, health: 0, hunger }, gameOver: true, messages: [...state.messages.slice(-5), 'You died.'] };
      }

      return {
        time,
        isNight,
        nightNumber,
        player: { ...state.player, health, hunger },
        stalkers,
      };
    }),

  resetGame: () => set(initialState()),

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages.slice(-5), msg] })),
}));
