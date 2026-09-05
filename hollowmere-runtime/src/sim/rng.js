export class Rng {
    s;
    constructor(seed) { this.s = seed >>> 0; }
    next() {
        this.s = (this.s + 0x6d2b79f5) >>> 0;
        let t = this.s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(min, max) { return min + (max - min) * this.next(); }
    state() { return this.s; }
}
export class Hasher {
    h = 0x811c9dc5;
    add(n) {
        const q = Math.round(n * 1000) | 0;
        for (let i = 0; i < 4; i++) {
            this.h ^= (q >>> (i * 8)) & 0xff;
            this.h = Math.imul(this.h, 0x01000193);
        }
    }
    digest() { return this.h >>> 0; }
}
