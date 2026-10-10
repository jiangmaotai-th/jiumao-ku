export function createAudio({ tweaks, assets }) {
  const PLAYLISTS = {
    china: ["MUSIC_CHINA_1", "MUSIC_CHINA_2"],
    world: ["MUSIC_WORLD_1", "MUSIC_WORLD_2"]
  };
  const FALLBACK = {
    MUSIC_CHINA_1: "/audio/china-1.mp3",
    MUSIC_CHINA_2: "/audio/china-2.mp3",
    MUSIC_WORLD_1: "/audio/world-1.mp3",
    MUSIC_WORLD_2: "/audio/world-2.mp3"
  };
  const Ctx = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
  let context;
  let master;
  let musicOn = true;
  let playlist = "china";
  let trackIndex = { china: 0, world: 0 };
  let currentKey = "";
  const players = new Map();

  function musicUrl(key) {
    return assets?.get?.(key) || FALLBACK[key];
  }

  function playlistFor(country) {
    return country === "中国" ? "china" : "world";
  }

  function musicVolume() {
    return Math.max(0, Math.min(1, Number(tweaks.get("musicVolume")) || 0));
  }

  function applyElementVolume(value = musicOn ? musicVolume() : 0) {
    players.forEach((player) => {
      player.el.muted = value <= 0;
      player.el.volume = value;
    });
  }

  function ensureContextFromGesture() {
    if (!Ctx) return;
    if (!context) {
      context = new Ctx();
      master = context.createGain();
      master.gain.value = 1;
      master.connect(context.destination);
    }
    if (context.state === "suspended") void context.resume();
  }

  function currentPlayer() {
    return currentKey ? players.get(currentKey) : null;
  }

  function isPlaying() {
    const player = currentPlayer();
    return Boolean(player && !player.el.paused && !player.el.ended);
  }

  async function unlock() {
    try {
      ensureContextFromGesture();
      return await playCurrent();
    } catch {
      return false;
    }
  }

  function ensurePlayer(key) {
    const existing = players.get(key);
    if (existing) return existing;
    const el = new Audio();
    el.preload = "auto";
    el.playsInline = true;
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "true");
    el.src = musicUrl(key);
    el.loop = false;
    el.volume = musicOn ? musicVolume() : 0;
    el.addEventListener("ended", () => {
      if (!musicOn || currentKey !== key) return;
      trackIndex[playlist] = (trackIndex[playlist] + 1) % PLAYLISTS[playlist].length;
      void playCurrent();
    });
    const player = { el, key };
    players.set(key, player);
    return player;
  }

  async function playCurrent() {
    if (!musicOn) return false;
    ensureContextFromGesture();
    const keys = PLAYLISTS[playlist];
    const key = keys[trackIndex[playlist] % keys.length];
    const player = ensurePlayer(key);
    players.forEach((other) => {
      if (other.key !== key) {
        other.el.pause();
        other.el.currentTime = 0;
      }
    });
    currentKey = key;
    applyElementVolume();
    const nextKey = keys[(trackIndex[playlist] + 1) % keys.length];
    if (nextKey !== key) ensurePlayer(nextKey);
    try {
      const play = player.el.play();
      if (play) await play;
      return !player.el.paused;
    } catch {
      return false;
    }
  }

  function pauseCurrent() {
    players.forEach((player) => player.el.pause());
  }

  function setCountry(country) {
    const next = playlistFor(country);
    if (next === playlist) return;
    playlist = next;
    if (musicOn) void playCurrent();
  }

  function tone(freq, duration, volume = .08, type = "sine", destination = context?.destination, when = 0, slideTo) {
    if (!context || context.state !== "running") return;
    const now = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + .015);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    osc.connect(gain).connect(destination);
    osc.start(now);
    osc.stop(now + duration + .03);
  }

  function noiseBurst(duration, volume, frequency = 4200, when = 0) {
    if (!context || context.state !== "running") return;
    const now = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "highpass";
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    src.buffer = buffer;
    src.connect(filter).connect(gain).connect(context.destination);
    src.start(now);
    src.stop(now + duration + .02);
  }

  function duck(seconds) {
    const vol = musicOn ? musicVolume() : 0;
    const ducked = Math.max(0, vol * .12);
    applyElementVolume(ducked);
    window.setTimeout(() => applyElementVolume(vol), seconds * 1000);
  }

  function scratch(intensity = .5) {
    if (!context || context.state !== "running") return;
    const length = Math.floor(context.sampleRate * .075);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "bandpass";
    filter.frequency.value = 1700 + Math.random() * 900;
    filter.Q.value = .8;
    gain.gain.value = .035 + intensity * .04;
    src.buffer = buffer;
    src.connect(filter).connect(gain).connect(context.destination);
    src.start();
  }

  function reveal(index = 0) {
    tone(620 * 1.05 ** index, .18, .07, "sine");
    window.setTimeout(() => tone(930 * 1.04 ** index, .24, .05, "triangle"), 45);
  }

  function lose() {
    duck(1.4);
    const fall = [392, 311, 247, 185];
    fall.forEach((freq, i) => {
      tone(freq, .38 + i * .05, .07, "triangle", undefined, i * .13);
      tone(freq * .5, .42, .035, "sine", undefined, i * .13);
    });
    tone(96, .55, .09, "sine", undefined, 0, 42);
    noiseBurst(.22, .03, 900, .02);
  }

  function win(level = 1) {
    const rank = level === true ? 2 : Math.max(1, Number(level) || 1);
    const jackpot = rank >= 3;
    const big = rank >= 2;
    duck(jackpot ? 3.2 : big ? 2.4 : 1.8);
    noiseBurst(jackpot ? .55 : .32, jackpot ? .16 : .1, jackpot ? 2800 : 3600, 0);
    const drums = jackpot ? [0, .16, .32, .64, .8] : big ? [0, .18, .36] : [0, .22];
    drums.forEach((when) => {
      tone(148, .28, .16, "sine", undefined, when, 46);
      tone(72, .36, .1, "triangle", undefined, when, 38);
    });
    const pentatonic = jackpot
      ? [0, 2, 4, 7, 9, 12, 14, 16, 19, 24]
      : big
        ? [0, 4, 7, 9, 12, 16, 19]
        : [0, 4, 7, 12, 16];
    pentatonic.forEach((n, i) => {
      const when = .08 + i * (jackpot ? .09 : .11);
      tone(392 * 2 ** (n / 12), big ? .42 : .3, jackpot ? .14 : .1, "triangle", undefined, when);
      tone(392 * 2 ** (n / 12) * 2, .22, jackpot ? .06 : .04, "square", undefined, when + .02);
      if (jackpot && i % 2 === 0) tone(196 * 2 ** (n / 12), .5, .07, "sine", undefined, when);
    });
    const chordAt = .08 + pentatonic.length * (jackpot ? .09 : .11);
    [0, 4, 7, 12].forEach((n) => {
      tone(523.25 * 2 ** (n / 12), jackpot ? 1.4 : .9, jackpot ? .12 : .08, "triangle", undefined, chordAt);
    });
    noiseBurst(.4, .08, 5200, chordAt);
    const coinCount = jackpot ? 36 : big ? 24 : 14;
    for (let i = 0; i < coinCount; i++) {
      const when = .12 + i * (jackpot ? .038 : .05) + Math.random() * .03;
      const base = 880 + Math.random() * 1100;
      tone(base, .06, .03, i % 2 ? "sine" : "square", undefined, when);
      tone(base * 1.5, .04, .014, "triangle", undefined, when + .01);
    }
  }

  function coin() {
    tone(1180 + Math.random() * 160, .07, .045, "sine");
    tone(1680 + Math.random() * 220, .05, .02, "triangle", undefined, .018);
  }

  function toggle() {
    musicOn = !musicOn;
    applyElementVolume(musicOn ? musicVolume() : 0);
    if (musicOn) void playCurrent();
    else pauseCurrent();
    return musicOn;
  }

  function setVolume(value) {
    if (musicOn) applyElementVolume(Math.max(0, Math.min(1, Number(value) || 0)));
  }

  function onVisible() {
    if (document.hidden || !musicOn) return;
    if (context?.state === "suspended") void context.resume();
    void playCurrent();
  }

  document.addEventListener("visibilitychange", onVisible);

  function destroy() {
    document.removeEventListener("visibilitychange", onVisible);
    pauseCurrent();
    players.forEach((player) => {
      player.el.removeAttribute("src");
      player.el.load();
    });
    players.clear();
  }

  return {
    unlock,
    scratch,
    reveal,
    win,
    lose,
    coin,
    toggle,
    setVolume,
    setCountry,
    destroy,
    get musicOn() { return musicOn; },
    get isPlaying() { return isPlaying(); },
  };
}
