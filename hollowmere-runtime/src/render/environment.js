import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSET_BASE } from '../assetBase.js';
const MODEL_BASE = `${ASSET_BASE}models/env/`;
const PILLAR_FILES = ['pillar.gltf.glb', 'pillar_decorated.gltf.glb'];
const GRAVE_FILES = ['gravestone.gltf', 'gravemarker_A.gltf', 'gravemarker_B.gltf'];
const STONE_FILES = ['rubble_large.gltf.glb', 'rubble_half.gltf.glb'];
const ARCH_FILE = 'arch.gltf';
const LANTERN_FILE = 'post_lantern.gltf';
const SCATTER_FILES = ['bone_A.gltf', 'ribcage.gltf', 'coffin.gltf', 'skull.gltf', 'fence_seperate.gltf', 'tree_dead_small.gltf'];
const TARGET_HEIGHT_PILLAR = 2.8;
const TARGET_HEIGHT_GRAVE = 1.2;
const TARGET_HEIGHT_STONE = 0.9;
const TARGET_HEIGHT_ARCH = 3.8;
const TARGET_ARCH_OPENING = 2.5;
const TARGET_HEIGHT_LANTERN = 2.1;
function measureBox(object) {
    object.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(object);
}
function estimateOpeningWidth(root) {
    const box = measureBox(root);
    const bandLo = box.min.y + (box.max.y - box.min.y) * 0.3;
    const bandHi = box.min.y + (box.max.y - box.min.y) * 0.75;
    const xs = [];
    const v = new THREE.Vector3();
    root.traverse((obj) => {
        const mesh = obj;
        if (!mesh.isMesh)
            return;
        mesh.updateMatrixWorld(true);
        const pos = mesh.geometry.getAttribute('position');
        if (!pos)
            return;
        for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            v.applyMatrix4(mesh.matrixWorld);
            if (v.y >= bandLo && v.y <= bandHi)
                xs.push(v.x);
        }
    });
    xs.sort((a, b) => a - b);
    let maxGap = 0;
    for (let i = 1; i < xs.length; i++) {
        const gap = xs[i] - xs[i - 1];
        if (gap > maxGap)
            maxGap = gap;
    }
    return maxGap;
}
function bakeTemplate(scene, scaleX, scaleY, scaleZ) {
    const box = measureBox(scene);
    const center = box.getCenter(new THREE.Vector3());
    scene.position.set(scene.position.x - center.x, scene.position.y - box.min.y, scene.position.z - center.z);
    const root = new THREE.Group();
    root.add(scene);
    root.scale.set(scaleX, scaleY, scaleZ);
    return { root };
}
function bakeUniform(scene, targetHeight) {
    const box = measureBox(scene);
    const nativeHeight = box.max.y - box.min.y || 1;
    const scale = targetHeight / nativeHeight;
    return bakeTemplate(scene, scale, scale, scale);
}
function pickIndex(seed, count) {
    const n = Math.floor(Math.abs(seed));
    return count > 0 ? n % count : 0;
}
export class EnvKit {
    pillars;
    graves;
    stones;
    arch;
    lanternTemplate;
    lanternLightY;
    scatter;
    constructor(pillars, graves, stones, arch, lanternTemplate, lanternLightY, scatter) {
        this.pillars = pillars;
        this.graves = graves;
        this.stones = stones;
        this.arch = arch;
        this.lanternTemplate = lanternTemplate;
        this.lanternLightY = lanternLightY;
        this.scatter = scatter;
    }
    static async load() {
        const loader = new GLTFLoader();
        const loadScene = (file) => loader.loadAsync(MODEL_BASE + file).then((gltf) => gltf.scene);
        const [pillarScenes, graveScenes, stoneScenes, archScene, lanternScene, scatterScenes] = await Promise.all([
            Promise.all(PILLAR_FILES.map(loadScene)),
            Promise.all(GRAVE_FILES.map(loadScene)),
            Promise.all(STONE_FILES.map(loadScene)),
            loadScene(ARCH_FILE),
            loadScene(LANTERN_FILE),
            Promise.all(SCATTER_FILES.map(loadScene)),
        ]);
        const pillars = pillarScenes.map((s) => bakeUniform(s, TARGET_HEIGHT_PILLAR));
        const graves = graveScenes.map((s) => bakeUniform(s, TARGET_HEIGHT_GRAVE));
        const stones = stoneScenes.map((s) => bakeUniform(s, TARGET_HEIGHT_STONE));
        const archBox = measureBox(archScene);
        const archNativeHeight = archBox.max.y - archBox.min.y || 1;
        const archNativeOpening = estimateOpeningWidth(archScene) || archNativeHeight;
        const archScaleY = TARGET_HEIGHT_ARCH / archNativeHeight;
        const archScaleXZ = TARGET_ARCH_OPENING / archNativeOpening;
        const arch = bakeTemplate(archScene, archScaleXZ, archScaleY, archScaleXZ);
        const lanternBox = measureBox(lanternScene);
        const lanternNativeHeight = lanternBox.max.y - lanternBox.min.y || 1;
        const lanternScale = TARGET_HEIGHT_LANTERN / lanternNativeHeight;
        let cageBox = null;
        lanternScene.traverse((obj) => {
            if (/lantern/i.test(obj.name)) {
                const b = measureBox(obj);
                cageBox = cageBox ? cageBox.union(b) : b;
            }
        });
        const cageCenterYNative = cageBox ? (cageBox.min.y + cageBox.max.y) / 2 : lanternNativeHeight * 0.9;
        const lanternLightY = (cageCenterYNative - lanternBox.min.y) * lanternScale;
        const lanternTemplate = bakeUniform(lanternScene, TARGET_HEIGHT_LANTERN);
        const scatter = scatterScenes.map((s) => bakeTemplate(s, 1, 1, 1));
        return new EnvKit(pillars, graves, stones, arch, lanternTemplate, lanternLightY, scatter);
    }
    makeObstacle(kind, variantSeed) {
        if (kind === 'arch')
            return this.arch.root.clone(true);
        const pool = kind === 'pillar' ? this.pillars : kind === 'grave' ? this.graves : this.stones;
        const idx = pickIndex(variantSeed, pool.length);
        const template = pool[idx] ?? pool[0];
        return template.root.clone(true);
    }
    makeLanternPost() {
        return { group: this.lanternTemplate.root.clone(true), lightY: this.lanternLightY };
    }
    makeScatter(kindIndex) {
        const idx = pickIndex(kindIndex, this.scatter.length);
        const template = this.scatter[idx] ?? this.scatter[0];
        return template.root.clone(true);
    }
    listScatterKinds() {
        return this.scatter.length;
    }
}
