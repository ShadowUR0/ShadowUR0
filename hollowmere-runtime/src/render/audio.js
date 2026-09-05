import { ASSET_BASE } from '../assetBase.js';
const AUDIO_BASE = `${ASSET_BASE}audio/`;
const BED_BASE_GAIN = 0.18;
const BED_WRAP_CROSSFADE = 2.5;
const MUSIC_STATE_CROSSFADE = 1.5;
const BED_FILES = {
    explore: 'ambient/explore-loop.mp3',
    boss: 'ambient/boss-loop.mp3',
};
const SAMPLE_FILES = {
    swordSwing: ['sfx/sword-swing-1.ogg', 'sfx/sword-swing-2.ogg'],
    swordImpact: ['sfx/sword-impact-1.ogg', 'sfx/sword-impact-2.ogg'],
    magicCast: ['sfx/magic-cast-1.ogg', 'sfx/magic-cast-2.ogg'],
    magicCastHeavy: ['sfx/magic-cast-heavy.ogg'],
    boneRattleDeath: ['sfx/bone-rattle-1.ogg'],
    boneRattleHurt: ['sfx/bone-rattle-2.ogg'],
};
class BedLoop {
    ctx;
    bus;
    voices;
    buffer = null;
    running = false;
    timer = null;
    constructor(ctx, dest) {
        this.ctx = ctx;
        this.bus = ctx.createGain();
        this.bus.gain.value = 0;
        this.bus.connect(dest);
        this.voices = [ctx.createGain(), ctx.createGain()];
        this.voices[0].connect(this.bus);
        this.voices[1].connect(this.bus);
    }
    get gainNode() { return this.bus; }
    setBuffer(buf) {
        this.buffer = buf;
        if (this.running)
            this.playVoice(0, this.ctx.currentTime);
    }
    start() {
        if (this.running || !this.buffer)
            return;
        this.running = true;
        this.playVoice(0, this.ctx.currentTime);
    }
    stop() {
        this.running = false;
        if (this.timer !== null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    playVoice(idx, when) {
        if (!this.running || !this.buffer)
            return;
        const buf = this.buffer;
        const dur = buf.duration;
        const fade = Math.min(BED_WRAP_CROSSFADE, dur / 2.2);
        const startAt = Math.max(when, this.ctx.currentTime);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.voices[idx]);
        const g = this.voices[idx].gain;
        g.cancelScheduledValues(startAt);
        g.setValueAtTime(0, startAt);
        g.linearRampToValueAtTime(1, startAt + fade);
        const fadeOutAt = startAt + dur - fade;
        if (fadeOutAt > startAt + fade)
            g.setValueAtTime(1, fadeOutAt);
        g.linearRampToValueAtTime(0, startAt + dur);
        src.start(startAt);
        src.stop(startAt + dur + 0.05);
        const nextIdx = idx === 0 ? 1 : 0;
        const nextStart = startAt + dur - fade;
        const delayMs = Math.max(0, (nextStart - this.ctx.currentTime) * 1000 - 250);
        this.timer = setTimeout(() => this.playVoice(nextIdx, nextStart), delayMs);
    }
}
export class Sfx {
    ctx = null;
    master = null;
    windGain = null;
    muted = false;
    samples = new Map();
    altIndex = new Map();
    samplesLoaded = 0;
    assetsRequested = false;
    bedMaster = null;
    exploreBed = null;
    bossBed = null;
    musicState = 'off';
    unlock() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended')
                void this.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext ?? window.webkitAudioContext;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.55;
        this.master.connect(this.ctx.destination);
        this.startWind();
        this.bedMaster = this.ctx.createGain();
        this.bedMaster.gain.value = this.muted ? 0 : BED_BASE_GAIN;
        this.bedMaster.connect(this.ctx.destination);
        this.exploreBed = new BedLoop(this.ctx, this.bedMaster);
        this.bossBed = new BedLoop(this.ctx, this.bedMaster);
        this.loadAssets();
        if (this.musicState !== 'off')
            this.applyMusicState();
    }
    setMuted(m) {
        this.muted = m;
        if (this.master && this.ctx)
            this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
        if (this.bedMaster && this.ctx)
            this.bedMaster.gain.setTargetAtTime(m ? 0 : BED_BASE_GAIN, this.ctx.currentTime, 0.05);
        if (!m && this.musicState !== 'off')
            this.ensureBed(this.musicState);
    }
    prewarmBossBed() { this.ensureBed('boss'); }
    setMusicState(state) {
        if (state === this.musicState)
            return;
        this.musicState = state;
        this.applyMusicState();
    }
    applyMusicState() {
        if (!this.ctx || !this.exploreBed || !this.bossBed)
            return;
        const t = this.ctx.currentTime;
        const wantExplore = this.musicState === 'explore' ? 1 : 0;
        const wantBoss = this.musicState === 'boss' ? 1 : 0;
        if (wantExplore > 0) {
            this.ensureBed('explore');
            this.exploreBed.start();
        }
        if (wantBoss > 0) {
            this.ensureBed('boss');
            this.bossBed.start();
        }
        this.exploreBed.gainNode.gain.cancelScheduledValues(t);
        this.exploreBed.gainNode.gain.setValueAtTime(this.exploreBed.gainNode.gain.value, t);
        this.exploreBed.gainNode.gain.linearRampToValueAtTime(wantExplore, t + MUSIC_STATE_CROSSFADE);
        this.bossBed.gainNode.gain.cancelScheduledValues(t);
        this.bossBed.gainNode.gain.setValueAtTime(this.bossBed.gainNode.gain.value, t);
        this.bossBed.gainNode.gain.linearRampToValueAtTime(wantBoss, t + MUSIC_STATE_CROSSFADE);
    }
    debugState() {
        return {
            bed: this.musicState,
            bedGain: this.bedMaster ? this.bedMaster.gain.value : 0,
            samplesLoaded: this.samplesLoaded,
            contextState: this.ctx ? this.ctx.state : 'closed',
            bedsRequested: [...this.bedRequested],
        };
    }
    decode = async (url) => {
        if (!this.ctx)
            return null;
        try {
            const res = await fetch(url);
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const arr = await res.arrayBuffer();
            return await this.ctx.decodeAudioData(arr);
        }
        catch (err) {
            console.warn(`[audio] failed to load ${url}, keeping synth fallback:`, err);
            return null;
        }
    };
    bedRequested = new Set();
    ensureBed(state) {
        if (this.muted || !this.ctx || this.bedRequested.has(state))
            return;
        this.bedRequested.add(state);
        void this.decode(AUDIO_BASE + BED_FILES[state]).then((buf) => {
            if (!buf)
                return;
            this.samplesLoaded++;
            const bed = state === 'explore' ? this.exploreBed : this.bossBed;
            bed?.setBuffer(buf);
            if (this.musicState === state)
                this.applyMusicState();
        });
    }
    loadAssets() {
        if (this.assetsRequested || !this.ctx)
            return;
        this.assetsRequested = true;
        for (const [category, files] of Object.entries(SAMPLE_FILES)) {
            for (const file of files) {
                void this.decode(AUDIO_BASE + file).then((buf) => {
                    if (!buf)
                        return;
                    this.samplesLoaded++;
                    const arr = this.samples.get(category) ?? [];
                    arr.push(buf);
                    this.samples.set(category, arr);
                });
            }
        }
    }
    playSample(category, gain, rateJitter = 0.04) {
        if (!this.ctx || !this.master)
            return false;
        const bufs = this.samples.get(category);
        if (!bufs || bufs.length === 0)
            return false;
        const idx = (this.altIndex.get(category) ?? 0) % bufs.length;
        this.altIndex.set(category, idx + 1);
        const buf = bufs[idx];
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = 1 + (Math.random() * 2 - 1) * rateJitter;
        const g = this.ctx.createGain();
        g.gain.value = gain;
        src.connect(g).connect(this.master);
        src.start();
        return true;
    }
    startWind() {
        if (!this.ctx || !this.master)
            return;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < d.length; i++) {
            const white = Math.random() * 2 - 1;
            last = (last + 0.02 * white) / 1.02;
            d[i] = last * 3;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 320;
        filt.Q.value = 0.6;
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0.05;
        src.connect(filt).connect(this.windGain).connect(this.master);
        src.start();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 0.07;
        lfoGain.gain.value = 0.025;
        lfo.connect(lfoGain).connect(this.windGain.gain);
        lfo.start();
    }
    tone(freq, dur, type, vol, sweepTo) {
        if (!this.ctx || !this.master)
            return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (sweepTo !== undefined)
            o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.02);
    }
    noise(dur, vol, freq, q = 1) {
        if (!this.ctx || !this.master)
            return;
        const t = this.ctx.currentTime;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++)
            d[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = freq;
        filt.Q.value = q;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(filt).connect(g).connect(this.master);
        src.start(t);
    }
    onEvents(events) {
        if (!this.ctx)
            return;
        for (const ev of events) {
            switch (ev.t) {
                case 'skillCast': {
                    const ultimate = ev.s === 'kingbreaker' || ev.s === 'eclipse';
                    if (ultimate) {
                        this.tone(120, 0.4, 'sawtooth', 0.32, 55);
                        this.noise(0.22, 0.24, 780, 1.1);
                    }
                    else
                        this.tone(ev.s?.includes('void') || ev.s?.includes('frost') || ev.s === 'mist-step' ? 720 : 260, 0.13, 'triangle', 0.16, 90);
                    break;
                }
                case 'swing':
                    if (!this.playSample('swordSwing', 0.5))
                        this.noise(0.14, 0.5, 1600, 0.8);
                    break;
                case 'bolt':
                    if (!this.playSample('magicCast', 0.32))
                        this.tone(880, 0.16, 'sine', 0.28, 220);
                    break;
                case 'ebolt':
                    if (!this.playSample('magicCast', 0.22))
                        this.tone(340, 0.22, 'square', 0.14, 120);
                    break;
                case 'volley':
                    if (!this.playSample('magicCastHeavy', 0.4)) {
                        this.tone(340, 0.3, 'square', 0.2, 90);
                        this.noise(0.25, 0.2, 700);
                    }
                    break;
                case 'hit':
                    if (!this.playSample('swordImpact', 0.45)) {
                        this.noise(0.1, 0.5, 420, 1.6);
                        this.tone(180, 0.1, 'triangle', 0.3, 90);
                    }
                    this.playSample('boneRattleHurt', 0.14, 0.08);
                    break;
                case 'playerHit':
                    this.tone(140, 0.25, 'sawtooth', 0.4, 60);
                    this.noise(0.18, 0.4, 300);
                    break;
                case 'projHit':
                    this.noise(0.08, 0.25, 900);
                    break;
                case 'slam':
                    this.tone(90, 0.5, 'sine', 0.7, 34);
                    this.noise(0.4, 0.5, 180, 0.8);
                    break;
                case 'rush':
                    this.noise(0.3, 0.32, 980, 0.8);
                    this.tone(120, 0.4, 'sawtooth', 0.24, 55);
                    break;
                case 'parryStart':
                    this.tone(760, 0.12, 'sine', 0.12, 980);
                    break;
                case 'parry':
                    this.tone(1320, 0.18, 'square', 0.28, 660);
                    this.noise(0.08, 0.38, 2600, 1.8);
                    break;
                case 'reflect':
                    this.tone(880, 0.2, 'triangle', 0.22, 1760);
                    break;
                case 'dodge':
                    this.noise(0.12, 0.3, 2400, 0.7);
                    break;
                case 'sip':
                    this.tone(520, 0.3, 'sine', 0.15, 700);
                    break;
                case 'flask':
                    this.tone(700, 0.25, 'sine', 0.25, 1050);
                    break;
                case 'kill':
                    this.tone(240, 0.35, 'triangle', 0.3, 60);
                    this.playSample('boneRattleDeath', 0.4, 0.08);
                    break;
                case 'levelup': {
                    let f = 440;
                    for (let i = 0; i < 4; i++) {
                        setTimeout(() => this.tone(f * Math.pow(1.335, i), 0.22, 'sine', 0.25), i * 90);
                    }
                    break;
                }
                case 'shrine':
                    this.tone(1046, 0.8, 'sine', 0.25);
                    this.tone(523, 1.1, 'sine', 0.2);
                    break;
                case 'aggro':
                    this.tone(110, 0.3, 'sawtooth', 0.12, 70);
                    break;
                case 'bossSpawn':
                    this.tone(70, 1.2, 'sawtooth', 0.5, 45);
                    this.noise(0.9, 0.4, 140, 0.7);
                    break;
                case 'bossPhase':
                    this.tone(60, 1, 'sawtooth', 0.5, 100);
                    break;
                case 'gateOpen':
                    this.noise(1.1, 0.4, 220, 0.5);
                    this.tone(80, 1, 'triangle', 0.3, 50);
                    break;
                case 'arenaLock':
                    this.noise(0.7, 0.25, 260, 0.5);
                    this.tone(150, 0.8, 'sine', 0.22, 48);
                    break;
                case 'death':
                    this.tone(220, 1.4, 'sine', 0.4, 55);
                    break;
                case 'bossDown': {
                    this.noise(1.2, 0.35, 160, 0.6);
                    const notes = [392, 311, 262];
                    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.9, 'sine', 0.24), i * 220));
                    break;
                }
                case 'zone2':
                    this.tone(180, 1.4, 'triangle', 0.2, 90);
                    this.noise(0.8, 0.2, 240, 0.5);
                    break;
                case 'victory': {
                    const notes = [523, 659, 784, 1046];
                    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.7, 'sine', 0.22), i * 160));
                    break;
                }
            }
        }
    }
}
