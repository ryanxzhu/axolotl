// saving the game in the browser's local storage, protected against tampering.
//
// A save is scrambled (so it isn't readable, editable JSON) and signed with HMAC-SHA-256. Changing even one
// character breaks the signature and the save is refused. On top of that, a save's calories must add up:
// starting calories + calories eaten - calories spent = calories left.
//
// Honest limit: everything here runs in the player's own browser, including the secret key, so a determined
// developer who reads this code can still forge a save or edit values while playing. Only a server can fully
// stop that. This stops anyone short of reverse-engineering the game.

const SAVE_STORAGE_KEY = 'axolotl-save';
const SAVE_OLD_STORAGE_KEY = 'axolotl-dungeon-save'; // the name used before the game was renamed
const SAVE_VERSION = 1;
const SAVE_SECRET = 'ax0l0tl-dungeon::caves-are-deep::d1d-y0u-r3ad-th1s?';

const SHA256_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(x, n) {
    return (x >>> n) | (x << (32 - n));
}

// SHA-256 of a byte array, returning 32 bytes. Synchronous, so a save can be checked as the game starts.
function sha256(bytes) {
    const hash = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    const paddedLength = ((bytes.length + 9 + 63) >> 6) << 6;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    const bitLength = bytes.length * 8;
    view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
    view.setUint32(paddedLength - 4, bitLength >>> 0);

    const w = new Uint32Array(64);
    for (let offset = 0; offset < paddedLength; offset += 64) {
        for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
        for (let i = 16; i < 64; i++) {
            const s0 = rotateRight(w[i - 15], 7) ^ rotateRight(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rotateRight(w[i - 2], 17) ^ rotateRight(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        let [a, b, c, d, e, f, g, h] = hash;
        for (let i = 0; i < 64; i++) {
            const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
            const choose = (e & f) ^ (~e & g);
            const t1 = (h + s1 + choose + SHA256_K[i] + w[i]) | 0;
            const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
            const majority = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (s0 + majority) | 0;
            h = g;
            g = f;
            f = e;
            e = (d + t1) | 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) | 0;
        }
        hash[0] += a;
        hash[1] += b;
        hash[2] += c;
        hash[3] += d;
        hash[4] += e;
        hash[5] += f;
        hash[6] += g;
        hash[7] += h;
    }

    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) outView.setUint32(i * 4, hash[i]);
    return out;
}

function concatBytes(...parts) {
    const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let at = 0;
    for (const part of parts) {
        out.set(part, at);
        at += part.length;
    }
    return out;
}

function hmacSha256(keyBytes, messageBytes) {
    let key = keyBytes.length > 64 ? sha256(keyBytes) : keyBytes;
    const block = new Uint8Array(64);
    block.set(key);
    const inner = block.map((byte) => byte ^ 0x36);
    const outer = block.map((byte) => byte ^ 0x5c);
    return sha256(concatBytes(outer, sha256(concatBytes(inner, messageBytes))));
}

function bytesToBase64(bytes) {
    let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text);
}

function base64ToBytes(base64) {
    const text = atob(base64);
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    return bytes;
}

function bytesEqual(a, b) {
    if (a.length !== b.length) return false;
    let difference = 0;
    for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
    return difference === 0;
}

// XORs the bytes with a keystream from the secret and a per-save nonce. Doing it twice undoes it.
function scramble(bytes, nonce) {
    const seedBytes = sha256(concatBytes(new TextEncoder().encode(SAVE_SECRET), nonce));
    let seed = new DataView(seedBytes.buffer).getUint32(0);
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
        // mulberry32: a small fast pseudo-random generator
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        out[i] = bytes[i] ^ ((t ^ (t >>> 14)) & 0xff);
    }
    return out;
}

// scrambles and signs a save state into the text that goes into local storage
function encodeSave(state) {
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    const body = concatBytes(nonce, scramble(new TextEncoder().encode(JSON.stringify(state)), nonce));
    const signature = hmacSha256(new TextEncoder().encode(SAVE_SECRET), body);
    return `${bytesToBase64(body)}.${bytesToBase64(signature)}`;
}

// checks and unscrambles saved text. Returns { state } or { problem } explaining why it can't be used.
function decodeSave(text) {
    try {
        const [bodyText, signatureText] = text.split('.');
        const body = base64ToBytes(bodyText);
        const signature = base64ToBytes(signatureText);
        if (!bytesEqual(signature, hmacSha256(new TextEncoder().encode(SAVE_SECRET), body))) {
            return { problem: 'tampered' };
        }
        const nonce = body.subarray(0, 16);
        const state = JSON.parse(new TextDecoder().decode(scramble(body.subarray(16), nonce)));
        return isValidSave(state) ? { state } : { problem: 'tampered' };
    } catch (error) {
        return { problem: 'tampered' };
    }
}

// a save's numbers have to make sense, and its calories have to add up
function isValidSave(state) {
    const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
    if (!state || state.version !== SAVE_VERSION) return false;
    if (![state.calories, state.eaten, state.spent, state.startingCalories].every(isNumber)) return false;
    if (state.eaten < 0 || state.spent < 0) return false;
    if (Math.abs(state.startingCalories + state.eaten - state.spent - state.calories) > 1e-6) return false;
    if (!Number.isInteger(state.mapSeed)) return false;
    if (state.away != null) {
        const { rate, since, unseen } = state.away;
        if (!(isNumber(rate) && rate >= 0 && isNumber(since))) return false;
        if (unseen !== undefined && !(isNumber(unseen) && unseen >= 0)) return false;
    }
    for (const level of Object.values(state.levels || {})) {
        if (!Number.isInteger(level) || level < 0) return false;
    }
    return true;
}

// moves something stored under an old name to its new name (once), so renaming a key doesn't lose it
function moveStoredItem(oldKey, newKey) {
    try {
        const old = localStorage.getItem(oldKey);
        if (old === null) return;
        if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, old);
        localStorage.removeItem(oldKey);
    } catch (error) {
        // storage blocked: nothing to move
    }
}

// the stored save: { state }, { problem: 'none' } when there isn't one, or { problem: 'tampered' }
function readSavedGame() {
    moveStoredItem(SAVE_OLD_STORAGE_KEY, SAVE_STORAGE_KEY);
    let text = null;
    try {
        text = localStorage.getItem(SAVE_STORAGE_KEY);
    } catch (error) {
        return { problem: 'unavailable' };
    }
    if (!text) return { problem: 'none' };
    return decodeSave(text);
}

// returns true if it was saved
function writeSavedGame(state) {
    try {
        localStorage.setItem(SAVE_STORAGE_KEY, encodeSave(state));
        return true;
    } catch (error) {
        return false;
    }
}

function wipeSavedGame() {
    try {
        localStorage.removeItem(SAVE_STORAGE_KEY);
    } catch (error) {
        // nothing stored, or storage blocked: either way there's no save left
    }
}
