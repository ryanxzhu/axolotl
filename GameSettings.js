// one knob to speed up the whole game, e.g. to try later stages quickly. It multiplies how fast the axolotl
// moves, accelerates, bounces and turns, and how many calories each food is worth. Leave at 1 for normal play.
const GAME_SPEED = 1;

// testing mode, only switched on or off here in the code. Leave false for normal play.
// It just changes the starting constants below: lots of calories, and every upgrade revealed at 0 eaten.
const MAP_HACKS = false;

// calories the game starts with
const STARTING_CALORIES = MAP_HACKS ? 1000000 : 0;

// every "appears once N calories have been eaten" threshold goes through this, so map hacks can drop them all to 0
function revealAfterEating(calories) {
    return MAP_HACKS ? 0 : calories;
}
