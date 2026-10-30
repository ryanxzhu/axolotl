// the bubble pop played whenever food is eaten, synthesized once in the browser (no sound files to load)
const BITE_VOLUME = 0.5;
const POP_SOUND_HZ = 450; // starting pitch of the bubble
const POP_SOUND_RISE = 1.8; // how far the pitch climbs, as a multiple of the starting pitch
const POP_SOUND_SECONDS = 0.09;

// a single underwater bubble: a sine that rises in pitch and dies away fast
function synthesizeBubble(sampleRate) {
    const length = Math.floor(sampleRate * POP_SOUND_SECONDS);
    const samples = new Float32Array(length);
    let phase = 0;
    let peak = 0;
    for (let i = 0; i < length; i++) {
        const u = i / length;
        const t = i / sampleRate;
        phase += (2 * Math.PI * POP_SOUND_HZ * (1 + POP_SOUND_RISE * u)) / sampleRate;
        samples[i] = Math.sin(phase) * Math.min(t / 0.002, 1) * Math.exp(-u * 4);
        peak = Math.max(peak, Math.abs(samples[i]));
    }
    for (let i = 0; i < length; i++) samples[i] *= 0.9 / peak;
    return samples;
}

class BiteSounds {
    constructor() {
        this.context = null;
        this.bubble = null;
        this.enabled = true; // switched by the sound button in the top-right corner
    }

    // browsers only allow audio after the player has clicked or pressed a key, so this is called from those
    unlock() {
        if (!this.context) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            this.context = new AudioContextClass();

            const samples = synthesizeBubble(this.context.sampleRate);
            this.bubble = this.context.createBuffer(1, samples.length, this.context.sampleRate);
            this.bubble.copyToChannel(samples, 0);
        }
        if (this.context.state === 'suspended') this.context.resume();
    }

    play() {
        if (!this.enabled || !this.context || this.context.state !== 'running') return;
        const source = this.context.createBufferSource();
        source.buffer = this.bubble;
        const gain = this.context.createGain();
        gain.gain.value = BITE_VOLUME;
        source.connect(gain).connect(this.context.destination);
        source.start();
    }
}
