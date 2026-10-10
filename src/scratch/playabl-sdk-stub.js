import { createAudioContext } from "./playabl-audio.js";

const STORAGE_KEY = "scratch-gallery-state";

function tweakValues(manifest) {
  const values = {};
  const listeners = new Map();
  for (const [key, entry] of Object.entries(manifest || {})) {
    values[key] = entry && typeof entry === "object" && "value" in entry ? entry.value : entry;
  }
  return {
    get(name) {
      return values[name];
    },
    subscribe(name, callback) {
      const list = listeners.get(name) || [];
      list.push(callback);
      listeners.set(name, list);
      return () => {
        listeners.set(name, (listeners.get(name) || []).filter((fn) => fn !== callback));
      };
    },
  };
}

const sdk = {
  async ready() {
    return { width: window.innerWidth, height: window.innerHeight };
  },
  tweaks: {
    async init(manifest) {
      return tweakValues(manifest);
    },
  },
  assets: {
    async register(manifest) {
      const map = new Map();
      for (const [key, value] of Object.entries(manifest || {})) map.set(key, value);
      return map;
    },
  },
  gameState: {
    async load() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      } catch {
        return null;
      }
    },
    async save(state) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
  },
  audio: {
    async getContext() {
      return createAudioContext();
    },
  },
  device: {
    haptics: {
      isSupported() {
        return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
      },
      async vibrate(pattern) {
        navigator.vibrate?.(pattern);
      },
    },
  },
  leaderboard: {
    async submit() {},
  },
};

export default sdk;
