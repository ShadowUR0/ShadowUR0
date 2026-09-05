import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { ASSET_BASE } from '../assetBase.js';
const MODEL_URL = {
    Knight: `${ASSET_BASE}models/char/Knight.glb`,
    Mage: `${ASSET_BASE}models/char/Mage.glb`,
    Skeleton_Minion: `${ASSET_BASE}models/char/Skeleton_Minion.glb`,
    Skeleton_Mage: `${ASSET_BASE}models/char/Skeleton_Mage.glb`,
    Skeleton_Warrior: `${ASSET_BASE}models/char/Skeleton_Warrior.glb`,
    Skeleton_Rogue: `${ASSET_BASE}models/char/Skeleton_Rogue.glb`,
};
const STAND_HEIGHT = {
    Knight: 1.85,
    Mage: 1.85,
    Skeleton_Minion: 1.5,
    Skeleton_Mage: 1.75,
    Skeleton_Warrior: 1.9,
    Skeleton_Rogue: 1.65,
};
const FACING_YAW_OFFSET = {
    Knight: 0,
    Mage: 0,
    Skeleton_Minion: 0,
    Skeleton_Mage: 0,
    Skeleton_Warrior: 0,
    Skeleton_Rogue: 0,
};
const HIDE_NODES = {
    Knight: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '2H_Sword'],
    Mage: ['Spellbook', 'Spellbook_open', '1H_Wand'],
};
const WEAPON_ATTACH = {
    Skeleton_Warrior: { file: 'Skeleton_Blade.gltf', socket: 'handslotr' },
    Skeleton_Mage: { file: 'Skeleton_Staff.gltf', socket: 'handslotr' },
};
const weaponScenes = new Map();
const REQUIRED_CLIPS = {
    Knight: ['Idle', 'Running_A', 'Dodge_Forward', 'Block', 'Block_Hit', '1H_Melee_Attack_Slice_Diagonal', 'Use_Item', 'Death_A'],
    Mage: ['Idle', 'Running_A', 'Dodge_Forward', 'Block', 'Block_Hit', 'Spellcast_Shoot', 'Use_Item', 'Death_A'],
    Skeleton_Minion: ['Idle', 'Running_A', 'Unarmed_Melee_Attack_Punch_A', 'Death_A'],
    Skeleton_Mage: ['Idle', 'Walking_A', 'Spellcast_Shoot', 'Death_A'],
    Skeleton_Warrior: ['Idle', 'Running_A', '1H_Melee_Attack_Slice_Horizontal', '2H_Melee_Attack_Chop', 'Spellcast_Shoot', 'Death_A'],
    Skeleton_Rogue: ['Idle', 'Running_A', 'Unarmed_Melee_Attack_Punch_A', 'Death_A'],
};
const resolved = new Map();
let loader = null;
function getLoader() {
    if (!loader)
        loader = new GLTFLoader();
    return loader;
}
function loadOne(kind) {
    return new Promise((res) => {
        getLoader().load(MODEL_URL[kind], (gltf) => {
            const scene = gltf.scene;
            const hide = HIDE_NODES[kind];
            if (hide)
                scene.traverse((o) => { if (hide.includes(o.name))
                    o.visible = false; });
            const box = new THREE.Box3().setFromObject(scene);
            const height = box.max.y - box.min.y;
            const normScale = height > 1e-4 ? STAND_HEIGHT[kind] / height : 1;
            if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                const names = [];
                scene.traverse((o) => names.push(o.name || o.type));
                console.log(`[avatar] ${kind} loaded — height=${height.toFixed(2)}m clips=${gltf.animations.length} nodes:`, names);
            }
            const clipNames = new Set(gltf.animations.map((c) => c.name));
            const missing = REQUIRED_CLIPS[kind].filter((n) => !clipNames.has(n));
            if (missing.length)
                console.error(`[avatar] ${kind} is missing required clips: ${missing.join(', ')}`);
            resolved.set(kind, { scene, animations: gltf.animations, normScale });
            res();
        }, undefined, (err) => {
            console.error(`[avatar] failed to load ${kind} from ${MODEL_URL[kind]}`, err);
            resolved.set(kind, null);
            res();
        });
    });
}
function loadWeapon(file) {
    return new Promise((res) => {
        getLoader().load(`${ASSET_BASE}models/char/${file}`, (gltf) => { weaponScenes.set(file, gltf.scene); res(); }, undefined, (err) => {
            console.error(`[avatar] failed to load weapon ${file}`, err);
            weaponScenes.set(file, null);
            res();
        });
    });
}
let preloadPromise = null;
export function preloadAvatars() {
    if (!preloadPromise) {
        const weaponFiles = [...new Set(Object.values(WEAPON_ATTACH).map((w) => w.file))];
        preloadPromise = Promise.all([
            ...Object.keys(MODEL_URL).map(loadOne),
            ...weaponFiles.map(loadWeapon),
        ]).then(() => undefined);
    }
    return preloadPromise;
}
export class Avatar {
    root = new THREE.Group();
    yawGroup = new THREE.Group();
    mixer = null;
    clips = new Map();
    currentAction = null;
    currentClip = null;
    materials = [];
    offset;
    isPlaceholder;
    constructor(kind, scaleMul = 1) {
        this.root.add(this.yawGroup);
        this.offset = FACING_YAW_OFFSET[kind];
        const loaded = resolved.get(kind);
        if (loaded) {
            this.isPlaceholder = false;
            const inst = skeletonClone(loaded.scene);
            inst.traverse((o) => {
                const mesh = o;
                if (!mesh.isMesh)
                    return;
                const src = mesh.material;
                if (Array.isArray(src)) {
                    mesh.material = src.map((m) => this.cloneMat(m));
                }
                else {
                    mesh.material = this.cloneMat(src);
                }
            });
            inst.scale.setScalar(loaded.normScale * scaleMul);
            const attach = WEAPON_ATTACH[kind];
            if (attach) {
                const weapon = weaponScenes.get(attach.file);
                const socket = weapon ? inst.getObjectByName(attach.socket) : null;
                if (weapon && socket) {
                    const w = weapon.clone(true);
                    w.traverse((o) => {
                        const mesh = o;
                        if (!mesh.isMesh)
                            return;
                        const src = mesh.material;
                        mesh.material = Array.isArray(src)
                            ? src.map((m) => this.cloneMat(m))
                            : this.cloneMat(src);
                    });
                    socket.add(w);
                }
            }
            this.yawGroup.add(inst);
            this.mixer = new THREE.AnimationMixer(inst);
            for (const c of loaded.animations)
                this.clips.set(c.name, c);
        }
        else {
            this.isPlaceholder = true;
            const mat = new THREE.MeshStandardMaterial({ color: 0x8892a0, roughness: 0.9 });
            this.materials.push(mat);
            const h = STAND_HEIGHT[kind] * scaleMul;
            const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.19, h * 0.62, 4, 8), mat);
            mesh.position.y = h * 0.5;
            this.yawGroup.add(mesh);
        }
    }
    cloneMat(src) {
        const c = src.clone();
        this.materials.push(c);
        return c;
    }
    hasClip(name) { return this.clips.has(name); }
    clipDuration(name) { return this.clips.get(name)?.duration ?? 1; }
    currentClipName() { return this.currentClip; }
    setFacing(angleRad) {
        this.yawGroup.rotation.y = angleRad + this.offset;
    }
    play(name, opts = {}) {
        if (!this.mixer)
            return;
        const clip = this.clips.get(name);
        if (!clip)
            return;
        if (this.currentClip === name && this.currentAction) {
            if (opts.timeScale !== undefined)
                this.currentAction.timeScale = opts.timeScale;
            return;
        }
        const fade = opts.fadeSec ?? 0.12;
        const action = this.mixer.clipAction(clip);
        action.reset();
        action.setLoop(opts.once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = !!opts.clampWhenFinished;
        if (opts.timeScale !== undefined)
            action.timeScale = opts.timeScale;
        action.fadeIn(fade);
        action.play();
        if (this.currentAction && this.currentAction !== action)
            this.currentAction.fadeOut(fade);
        this.currentAction = action;
        this.currentClip = name;
    }
    update(dt) { this.mixer?.update(dt); }
    flash(on) {
        for (const m of this.materials) {
            m.emissive.setHex(on ? 0xff5040 : 0x000000);
            m.emissiveIntensity = on ? 0.9 : 0;
        }
    }
    dispose() {
        this.root.removeFromParent();
        for (const m of this.materials)
            m.dispose();
    }
}
