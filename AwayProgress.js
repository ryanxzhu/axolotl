// "away calories": while Auto swim is on, the game keeps earning when the player looks away.
//
// When the page is hidden (window covered or minimised, or another tab shown), the browser stops drawing frames,
// which would freeze the game. So with Auto swim on, a background worker keeps the game ticking, without
// drawing, for AWAY_SAMPLE_MINUTES. The calories eaten in that time, per minute, become the away-rate.
// When the player comes back, minutes away since then × away-rate is paid out. With Auto swim off, nothing
// runs and nothing is paid.
//
// The away-rate and its start time also go into the save, so closing the tab still pays out on the next load.

const AWAY_SAMPLE_MINUTES = 3;
const AWAY_SAMPLE_FRAMES = AWAY_SAMPLE_MINUTES * 60 * FRAMES_PER_SECOND;
const AWAY_MAX_MS = 7 * 24 * 60 * 60 * 1000; // pay for at most 7 days away
const AWAY_PARTIAL_SAMPLE_FRAMES = 30 * FRAMES_PER_SECOND; // shortest sample worth using if the tab closes mid-way
const AWAY_MAX_STEPS_PER_TICK = 600; // caps catch-up per worker tick, so one tick never holds up the page too long
const FRAME_MS = 1000 / FRAMES_PER_SECOND;

// a tiny worker that just ticks. Workers keep running smoothly in hidden pages, unlike the page's own timers.
const AWAY_TICKER_SOURCE = `setInterval(() => postMessage(0), ${FRAME_MS});`;

class AwayProgress {
    // step(): one game step without drawing. autoSwimOn(): whether Auto swim is on. eatenSoFar(): total
    // calories eaten. recentRate(): calories eaten in the last minute of play. setBackground(on): marks the game
    // as running unseen. award(calories): pays out away calories. showTotal(calories): tells the player
    // everything gained while they weren't watching (meals during the background run plus the payout).
    constructor({ step, autoSwimOn, eatenSoFar, recentRate, setBackground, award, showTotal }) {
        this.step = step;
        this.autoSwimOn = autoSwimOn;
        this.eatenSoFar = eatenSoFar;
        this.recentRate = recentRate;
        this.setBackground = setBackground;
        this.award = award;
        this.showTotal = showTotal;

        this.worker = null;
        this.sampling = false;
        this.sampleStart = 0; // performance.now() when the background run started
        this.sampleStartEaten = 0;
        this.framesDone = 0;
        this.measured = null; // { rate, since }: the away-rate and when it started counting
    }

    pageHidden() {
        if (!this.autoSwimOn() || this.sampling) return;
        this.sampling = true;
        this.measured = null;
        this.sampleStart = performance.now();
        this.sampleStartEaten = this.eatenSoFar();
        this.framesDone = 0;
        this.setBackground(true);
        this.worker = new Worker(URL.createObjectURL(new Blob([AWAY_TICKER_SOURCE], { type: 'text/javascript' })));
        this.worker.onmessage = () => this.tick();
    }

    // runs the game steps that are due by now (catching up if ticks arrived late), ending after the sample
    tick() {
        if (!this.sampling) return;
        const due = Math.min(AWAY_SAMPLE_FRAMES, Math.floor((performance.now() - this.sampleStart) / FRAME_MS));
        let steps = 0;
        while (this.framesDone < due && steps < AWAY_MAX_STEPS_PER_TICK) {
            this.step();
            this.framesDone++;
            steps++;
        }
        if (this.framesDone >= AWAY_SAMPLE_FRAMES) {
            this.measured = { rate: this.sampleRate(), since: Date.now() };
            this.stopSampling();
        }
    }

    // calories per minute eaten during the background run so far
    sampleRate() {
        const minutes = this.framesDone / (60 * FRAMES_PER_SECOND);
        return minutes > 0 ? (this.eatenSoFar() - this.sampleStartEaten) / minutes : 0;
    }

    stopSampling() {
        this.sampling = false;
        if (this.worker) this.worker.terminate();
        this.worker = null;
        this.setBackground(false);
    }

    // calories really eaten during the background run, which the player didn't see
    unseenMeals() {
        return this.sampling || this.measured ? this.eatenSoFar() - this.sampleStartEaten : 0;
    }

    // back within the sample, the background run already covered the time; after it, pay for the time since.
    // Either way, show everything gained while they weren't watching.
    pageVisible() {
        const unseen = this.unseenMeals();
        if (this.sampling) this.stopSampling();
        let payout = 0;
        if (this.measured) {
            payout = this.payOut(this.measured);
            this.measured = null;
        }
        if (unseen + payout > 0) this.showTotal(unseen + payout);
    }

    // the game was closed while away: pay for the time since the save, and show it together with any meals the
    // background run had already eaten before the tab closed
    resumeFromSave(away) {
        const total = this.payOut(away) + (away.unseen || 0);
        if (total > 0) this.showTotal(total);
    }

    // pays rate × minutes since `since`, ignoring clocks that went backwards and capping at AWAY_MAX_MS
    payOut({ rate, since }) {
        const elapsed = Math.min(Date.now() - since, AWAY_MAX_MS);
        if (!(elapsed > 0) || !(rate > 0)) return 0;
        const calories = Math.floor((rate * elapsed) / 60000);
        if (calories > 0) this.award(calories);
        return calories;
    }

    // what goes in the save, so time with the game closed pays out on the next load: the finished sample if
    // there is one, else a partial sample of at least 30 seconds, else (playing with Auto swim on) the last
    // minute's live rate. Nothing when Auto swim is off. `unseen` carries meals already eaten in the background,
    // so the next load's popup can include them.
    forSave() {
        const unseen = this.unseenMeals();
        if (this.measured) return { ...this.measured, unseen };
        if (!this.autoSwimOn()) return null;
        const rate = this.sampling && this.framesDone >= AWAY_PARTIAL_SAMPLE_FRAMES ? this.sampleRate() : this.recentRate();
        return { rate, since: Date.now(), unseen };
    }
}
