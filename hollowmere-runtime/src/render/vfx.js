import * as THREE from 'three';
import { ASSET_BASE } from '../assetBase.js';
const AMBER = 0xffc06a;
const CYAN = 0x6fe3d4;
const RED = 0xd8564a;
const PALE = 0xdfe8ea;
const FROST = 0xa9e7ff;
const TEX = {
    swing: 'slash_03.png',
    cleave: 'slash_02.png',
    novaRing: 'magic_03.png',
    novaSwirl: 'twirl_02.png',
    glow: 'circle_05.png',
    scorch: 'scorch_01.png',
    smoke: 'smoke_05.png',
    hit: 'star_07.png',
    spark: 'spark_04.png',
};
export class Vfx {
    fx = [];
    projMeshes = new Map();
    scene;
    reduced;
    tex = new Map();
    unitPlane = new THREE.PlaneGeometry(1, 1);
    constructor(scene, reducedMotion) {
        this.scene = scene;
        this.reduced = reducedMotion;
    }
    preload() {
        const loader = new THREE.TextureLoader();
        return Promise.all(Object.keys(TEX).map((k) => loader.loadAsync(`${ASSET_BASE}textures/fx/${TEX[k]}`).then((t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            this.tex.set(k, t);
        }).catch((err) => console.error(`[vfx] texture ${TEX[k]} failed`, err)))).then(() => undefined);
    }
    disposeFx(f) {
        this.scene.remove(f.obj);
        f.ownGeometry?.dispose();
        f.mat.dispose();
    }
    track(obj, mat, own, opts) {
        this.scene.add(obj);
        this.fx.push({
            obj, mat, ownGeometry: own,
            t: 0, life: opts.life ?? 0.35, grow: opts.grow ?? 0,
            spin: this.reduced ? 0 : (opts.spin ?? 0), rise: this.reduced ? 0 : (opts.rise ?? 0),
            base: opts.base ?? 0.85,
        });
    }
    quad(key, color, x, z, opts = {}) {
        const t = this.tex.get(key);
        if (!t)
            return;
        const m = new THREE.Mesh(this.unitPlane, new THREE.MeshBasicMaterial({
            map: t, color, transparent: true, opacity: opts.base ?? 0.85, depthWrite: false,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
        }));
        m.rotation.x = -Math.PI / 2;
        if (opts.rotZ !== undefined)
            m.rotation.z = opts.rotZ;
        m.position.set(x, opts.y ?? 0.12, z);
        m.scale.setScalar(opts.r ?? 1);
        this.track(m, m.material, null, opts);
    }
    spriteFx(key, color, x, z, opts = {}) {
        const t = this.tex.get(key);
        if (!t)
            return;
        const mat = new THREE.SpriteMaterial({
            map: t, color, transparent: true, opacity: opts.base ?? 0.9, depthWrite: false,
            blending: THREE.AdditiveBlending, toneMapped: false,
        });
        const s = new THREE.Sprite(mat);
        s.position.set(x, opts.y ?? 0.9, z);
        s.scale.setScalar(opts.r ?? 1);
        this.track(s, mat, null, opts);
    }
    spawn(kind, color, x, z, opts = {}) {
        const geo = kind === 'ring'
            ? new THREE.RingGeometry(0.75, 1, 26)
            : new THREE.CylinderGeometry(0.35, 0.55, 7, 10, 1, true);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
            blending: THREE.AdditiveBlending,
        }));
        if (kind === 'ring') {
            m.rotation.x = -Math.PI / 2;
            m.position.set(x, opts.y ?? 0.1, z);
        }
        else
            m.position.set(x, opts.y ?? 0.8, z);
        m.scale.setScalar(opts.r ?? 1);
        this.track(m, m.material, geo, { ...opts, grow: this.reduced ? 0 : (opts.grow ?? 2.2) });
    }
    onEvents(events, sim) {
        for (const ev of events) {
            switch (ev.t) {
                case 'skillCast': {
                    const radius = Math.max(1.5, ev.r ?? sim.cls.skillRange);
                    const heavy = ev.s === 'kingbreaker' || ev.s === 'eclipse';
                    const warm = ev.s === 'grave-cleave' || ev.s === 'chain-rend' || ev.s === 'war-cry' || ev.s === 'kingbreaker';
                    const color = warm ? AMBER : FROST;
                    this.spawn('ring', color, ev.x, ev.z, { r: heavy ? 1.2 : 0.65, life: heavy ? 0.65 : 0.34, grow: this.reduced ? 0 : radius });
                    if (heavy)
                        this.quad('glow', color, ev.x, ev.z, { r: radius * 1.15, life: 0.45, grow: this.reduced ? 0 : radius * 0.45, base: 0.9 });
                    break;
                }
                case 'swing': {
                    const ox = sim.atkAimX * sim.cls.range * 0.55, oz = sim.atkAimZ * sim.cls.range * 0.55;
                    this.spriteFx('swing', AMBER, ev.x + ox, ev.z + oz, {
                        r: sim.cls.range * 1.5, life: 0.17, y: 1, grow: this.reduced ? 0 : 3, base: 1,
                    });
                    break;
                }
                case 'cleave': {
                    const ox = sim.faceX * 1.6, oz = sim.faceZ * 1.6;
                    this.spriteFx('cleave', AMBER, ev.x + ox, ev.z + oz, {
                        r: sim.cls.skillRange * 1.6, life: 0.3, y: 1.1, grow: this.reduced ? 0 : 5, base: 1,
                    });
                    this.quad('glow', AMBER, ev.x, ev.z, { r: sim.cls.skillRange * 1.4, life: 0.3, grow: this.reduced ? 0 : 3 });
                    for (let i = 0; i < (this.reduced ? 1 : 3); i++) {
                        this.spriteFx('hit', AMBER, ev.x + Math.sin(i * 2.4) * 1.2, ev.z + Math.cos(i * 2.4) * 1.2, { r: 0.9, life: 0.24, y: 1, rise: 1.4 });
                    }
                    break;
                }
                case 'nova':
                    this.quad('glow', 0xd8f6ff, ev.x, ev.z, { r: sim.cls.skillRange * 1.5, life: 0.22, base: 1 });
                    this.quad('novaRing', 0xbfefff, ev.x, ev.z, {
                        r: 2.2, life: 0.5, grow: this.reduced ? 0 : sim.cls.skillRange * 2.6, base: 1,
                    });
                    this.quad('novaSwirl', FROST, ev.x, ev.z, {
                        r: sim.cls.skillRange * 2.1, life: 0.45, spin: -7, grow: this.reduced ? 0 : 1.5, base: 0.95,
                    });
                    break;
                case 'slam':
                    this.spawn('ring', RED, ev.x, ev.z, { r: 1.2, life: 0.5, grow: 5.5 });
                    this.quad('scorch', 0xff8449, ev.x, ev.z, { r: 6.6, life: 2.4, y: 0.1, base: 0.95 });
                    for (let i = 0; i < (this.reduced ? 1 : 3); i++) {
                        this.spriteFx('smoke', 0xcbb9a6, ev.x + Math.sin(i * 2.1) * 1.6, ev.z + Math.cos(i * 2.1) * 1.6, { r: 2.2, life: 0.7, y: 0.7, rise: 1.6, grow: 1.6, base: 0.55 });
                    }
                    break;
                case 'rush':
                    this.spawn('ring', RED, ev.x, ev.z, { r: 0.7, life: 0.3, grow: 2.4 });
                    break;
                case 'parryStart':
                    this.spawn('ring', CYAN, ev.x, ev.z, { r: 0.45, life: 0.22, grow: 1.2, y: 0.55 });
                    break;
                case 'parry':
                    this.spriteFx('hit', PALE, ev.x, ev.z, {
                        r: 1.7, life: 0.3, grow: this.reduced ? 0 : 3.2, y: 1, base: 1,
                    });
                    this.spawn('ring', CYAN, sim.px, sim.pz, { r: 0.7, life: 0.35, grow: 3 });
                    break;
                case 'reflect':
                    this.spriteFx('spark', CYAN, ev.x, ev.z, {
                        r: 1.45, life: 0.28, grow: this.reduced ? 0 : 2.5, y: 0.8, base: 1,
                    });
                    break;
                case 'hit':
                    this.spriteFx('hit', PALE, ev.x, ev.z, { r: 1.15, life: 0.2, y: 0.95, grow: this.reduced ? 0 : 2 });
                    break;
                case 'projHit':
                    this.spriteFx('spark', AMBER, ev.x, ev.z, { r: 1.1, life: 0.24, y: 0.7, grow: this.reduced ? 0 : 1.6 });
                    break;
                case 'playerHit':
                    this.spriteFx('hit', RED, ev.x, ev.z, { r: 1.4, life: 0.3, y: 0.95, grow: this.reduced ? 0 : 2.4 });
                    break;
                case 'ebolt':
                case 'volley': {
                    const e = sim.enemies.find(en => en.id === ev.id);
                    if (e)
                        this.spriteFx('glow', e.kind === 'barrow' ? 0xc9a2ff : 0x9fe08a, e.x, e.z, { r: 1.5, life: 0.22, y: 1.1 });
                    break;
                }
                case 'kill':
                    this.spriteFx('smoke', 0x9db8a8, ev.x, ev.z, { r: 1.6, life: 0.6, y: 0.8, rise: 1.2, grow: 1.2, base: 0.6 });
                    break;
                case 'levelup':
                    this.spawn('beam', AMBER, sim.px, sim.pz, { life: 0.9, grow: 0.2, y: 3.2 });
                    this.quad('novaRing', AMBER, sim.px, sim.pz, { r: 1, life: 0.7, grow: this.reduced ? 0 : 5 });
                    break;
                case 'itemGain':
                    this.spawn('beam', PALE, sim.px, sim.pz, { life: 0.75, grow: 0.18, y: 3 });
                    this.spawn('ring', AMBER, sim.px, sim.pz, { r: 0.55, life: 0.65, grow: 2.8 });
                    break;
                case 'shrine':
                    this.spawn('beam', CYAN, sim.px, sim.pz, { life: 0.8, grow: 0.15, y: 3 });
                    break;
                case 'victory':
                    this.quad('novaRing', CYAN, sim.px, sim.pz, { r: 2, life: 1.4, grow: this.reduced ? 0 : 8, base: 0.9 });
                    break;
            }
        }
    }
    syncProjectiles(sim, at) {
        const seen = new Set();
        for (const p of sim.projs) {
            seen.add(p.id);
            const pos = at ? at(p) : p;
            let m = this.projMeshes.get(p.id);
            if (!m) {
                const color = p.from === 'player' ? CYAN : 0x9fe08a;
                m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.6 }));
                this.scene.add(m);
                this.projMeshes.set(p.id, m);
            }
            const color = p.from === 'player' ? CYAN : 0x9fe08a;
            const material = m.material;
            material.color.setHex(color);
            material.emissive.setHex(color);
            m.position.set(pos.x, 0.85, pos.z);
        }
        for (const [id, m] of this.projMeshes) {
            if (!seen.has(id)) {
                this.scene.remove(m);
                m.geometry.dispose();
                const materials = Array.isArray(m.material) ? m.material : [m.material];
                for (const material of materials)
                    material.dispose();
                this.projMeshes.delete(id);
            }
        }
    }
    step(dt) {
        for (const f of this.fx) {
            f.t += dt;
            const k = Math.min(1, f.t / f.life);
            f.mat.opacity = f.base * (1 - k);
            if (f.grow !== 0) {
                const s = f.obj.scale.x + f.grow * dt;
                f.obj.scale.setScalar(s);
            }
            if (f.spin !== 0)
                f.obj.rotation.z += f.spin * dt;
            if (f.rise !== 0)
                f.obj.position.y += f.rise * dt;
            if (k >= 1)
                this.disposeFx(f);
        }
        this.fx = this.fx.filter(f => f.t < f.life);
    }
}
