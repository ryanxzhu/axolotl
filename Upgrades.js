// upgrades bought with calories, shown under "Spend Calories" beside the map
const UPGRADES_REVEAL_AT = 5; // calories eaten in total before the Spend Calories area appears
// every upgrade follows the same rule: each level makes its effect 20% stronger than the last, and costs
// 1.5× the previous level's price
const UPGRADE_EFFECT_GROWTH = 1.2;
const UPGRADE_COST_GROWTH = 1.5;
const HOOVER_BASE_RADIUS = 36; // Hoover food reach around the head at level 1, in px
const SPEED_DISPLAY_BASE = 10; // what the un-upgraded speed reads as in the Speed readout (display only)

// effect strength at a level: 1× at level 1, then 20% more for each level after
function upgradeStrength(level) {
    return Math.pow(UPGRADE_EFFECT_GROWTH, level - 1);
}

// baseCost is the first level's price. revealAt is how many calories must have been eaten in total before the
// button appears at all. A oneTime upgrade is bought once and then becomes an on/off switch (toggle) that
// looks pressed in while on; buying it switches it on.
const UPGRADES = [
    {
        id: 'swimFaster',
        name: 'Swim faster',
        baseCost: 10,
        revealAt: 5,
        // level 1 is already 20% faster than no upgrade, so speed is 1.2^level
        apply: (meeple, level) => meeple.setSpeedMultiplier(upgradeStrength(level) * UPGRADE_EFFECT_GROWTH),
    },
    {
        id: 'hooverFood',
        name: 'Hoover food',
        baseCost: 20,
        revealAt: 15,
        // pulls nearby food into the mouth; each level reaches 20% further
        apply: (meeple, level) => meeple.setHooverRadius(HOOVER_BASE_RADIUS * upgradeStrength(level)),
    },
    {
        id: 'autoSwim',
        name: 'Auto swim',
        baseCost: 40,
        revealAt: 50,
        oneTime: true,
        // while on, the axolotl swims and turns by itself and ignores W, clicks and the mouse
        toggle: (meeple, on) => meeple.setAutoSwim(on),
    },
];

// price of the next level, rounded up to a whole number (the epsilon keeps float error like 30.0000001 at 30)
function upgradeCost(upgrade, level) {
    return Math.ceil(upgrade.baseCost * Math.pow(UPGRADE_COST_GROWTH, level) - 1e-9);
}

// a random colour, blobby rounded shape and slight tilt, different every time the game loads.
// Eight random corner radii (four horizontal / four vertical) make an irregular pebble-like outline.
function styleRandomly(button) {
    const hue = Math.random() * 360;
    const saturation = randomBetween(40, 60);
    const lightness = randomBetween(27, 35); // dark enough for the pink text to stand out
    button.style.background = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    button.style.borderColor = `hsl(${hue}, ${saturation}%, ${lightness + 14}%)`;

    const across = () => randomBetween(32, 68);
    const top = across();
    const bottom = across();
    const left = across();
    const right = across();
    button.style.borderRadius =
        `${top}% ${100 - top}% ${bottom}% ${100 - bottom}% / ` + `${left}% ${right}% ${100 - right}% ${100 - left}%`;
    button.style.setProperty('--tilt', `${randomBetween(-2, 2)}deg`);
}

class UpgradeShop {
    // score is { calories, eaten }; onSpend is called after a purchase so the counter can update
    constructor(score, meeple, onSpend) {
        this.score = score;
        this.meeple = meeple;
        this.onSpend = onSpend;
        this.panel = document.querySelector('#upgrades');
        this.speedDisplay = document.querySelector('#speed');
        this.levels = {};
        this.buttons = {};
        this.switchedOn = {}; // for oneTime upgrades: whether the switch is currently on (pressed in)

        const list = document.querySelector('#upgrade-buttons');
        for (const upgrade of UPGRADES) {
            this.levels[upgrade.id] = 0;
            const button = document.createElement('button');
            button.className = 'upgrade-button';
            button.innerHTML =
                `<span class="upgrade-name">${upgrade.name}</span>` +
                '<span class="upgrade-level"></span><span class="upgrade-cost"></span>';
            styleRandomly(button);
            button.hidden = true; // shown by refresh() once its unlock condition is met
            button.addEventListener('click', () => this.buy(upgrade));
            list.appendChild(button);
            this.buttons[upgrade.id] = button;
        }

        // clicking in here shouldn't also count as a swim kick on the map
        document.querySelector('#side-panel').addEventListener('mousedown', (e) => e.stopPropagation());
        this.refresh();
    }

    buy(upgrade) {
        const cost = upgradeCost(upgrade, this.levels[upgrade.id]);
        const button = this.buttons[upgrade.id];
        button.blur();

        // an owned one-time upgrade is a free on/off switch from then on
        if (upgrade.oneTime && this.levels[upgrade.id] > 0) {
            this.setSwitch(upgrade, !this.switchedOn[upgrade.id]);
            return;
        }

        if (this.score.calories < cost) {
            // a small shake to say "not enough calories"
            button.animate(
                [
                    { transform: `rotate(var(--tilt)) translateX(0)` },
                    { transform: `rotate(var(--tilt)) translateX(-5px)` },
                    { transform: `rotate(var(--tilt)) translateX(5px)` },
                    { transform: `rotate(var(--tilt)) translateX(0)` },
                ],
                { duration: 220 }
            );
            return;
        }

        this.score.calories -= cost;
        this.levels[upgrade.id]++;
        if (upgrade.oneTime) {
            // buying a switch turns it on straight away
            this.onSpend();
            this.setSwitch(upgrade, true);
            return;
        }
        upgrade.apply(this.meeple, this.levels[upgrade.id]);
        button.animate(
            [
                { transform: 'rotate(var(--tilt)) scale(1)' },
                { transform: 'rotate(var(--tilt)) scale(1.08)' },
                { transform: 'rotate(var(--tilt)) scale(1)' },
            ],
            { duration: 220, easing: 'ease-out' }
        );
        this.onSpend();
        this.refresh();
    }

    setSwitch(upgrade, on) {
        this.switchedOn[upgrade.id] = on;
        upgrade.toggle(this.meeple, on);
        this.refresh();
    }

    // called whenever calories change (eating or spending), never every frame
    refresh() {
        if (this.panel.hidden && this.score.eaten >= UPGRADES_REVEAL_AT) {
            this.panel.hidden = false;
            this.panel.animate(
                [
                    { opacity: 0, transform: 'translateY(-10px)' },
                    { opacity: 1, transform: 'translateY(0)' },
                ],
                { duration: 400, easing: 'ease-out' }
            );
        }

        // speed readout appears after the first Swim faster upgrade. It's display only: the base speed shows as
        // SPEED_DISPLAY_BASE (10), so the first upgrade reads 12, rounded down to a whole number
        // (the tiny epsilon stops float error like 11.9999999 showing as 11)
        if (this.levels.swimFaster > 0) {
            const speed = Math.floor(this.meeple.speedMultiplier * SPEED_DISPLAY_BASE + 1e-9);
            this.speedDisplay.textContent = `Speed: ${speed}`;
            if (this.speedDisplay.hidden) {
                this.speedDisplay.hidden = false;
                this.speedDisplay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
            }
        }

        for (const upgrade of UPGRADES) {
            const level = this.levels[upgrade.id];
            const cost = upgradeCost(upgrade, level);
            const button = this.buttons[upgrade.id];
            if (button.hidden && this.score.eaten >= upgrade.revealAt) {
                button.hidden = false;
                button.animate(
                    [
                        { opacity: 0, transform: 'rotate(var(--tilt)) scale(0.85)' },
                        { opacity: 1, transform: 'rotate(var(--tilt)) scale(1)' },
                    ],
                    { duration: 350, easing: 'ease-out' }
                );
            }
            if (upgrade.oneTime && level > 0) {
                // owned switch: shows on/off instead of a price, and looks pressed in while on
                const on = this.switchedOn[upgrade.id];
                button.querySelector('.upgrade-cost').textContent = on ? 'on' : 'off';
                button.querySelector('.upgrade-level').textContent = '';
                button.classList.toggle('pressed', on);
                button.classList.remove('cant-afford');
                continue;
            }
            button.querySelector('.upgrade-cost').textContent = `${cost} cal`;
            button.querySelector('.upgrade-level').textContent = level > 0 ? `Lv ${level}` : '';
            button.classList.toggle('cant-afford', this.score.calories < cost);
        }
    }
}
