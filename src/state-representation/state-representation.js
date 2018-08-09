const Battle = require('../state-tracking/battle');
const Pokemon = require('../state-tracking/battle');


/**
 * Encode the observable battle state into an array of floats that can be used as a state representation
 * for reinforcement learning algorithms
 *
 * @param {Battle} battle
 * @return float[]
 */
function encodeObservableBattleState(battle) {
    return encodeStateOwnPokemon(battle.activePokemon);
}

/**
 * @param {Pokemon} pokemon
 * @return float[]
 */
function encodeStateOwnPokemon(pokemon) {
    return oneHotEncodeAbility(pokemon.ability);
}


const abilityMapping = {
    "angerpoint": 0,
    "arenatrap": 1,
    "battlearmor": 2,
    "clearbody": 3,
    "cloudnine": 4,
    "colorchange": 5,
    "comatose": 6,
    "contrary": 7,
    "damp": 8,
    "dancer": 9,
    "deltastream": 10,
    "desolateland": 11,
    "disguise": 12,
    "dryskin": 13,
    "emergencyexit": 14,
    "flashfire": 15,
    "flowergift": 16,
    "immunity": 17,
    "intimidate": 18,
    "klutz": 19,
    "levitate": 20,
    "lightningrod": 21,
    "magicbounce": 22,
    "magicguard": 23,
    "magnetpull": 24,
    "multiscale": 25,
    "mummy": 26,
    "normalize": 27,
    "pickup": 28,
    "prankster": 29,
    "pressure": 30,
    "primordialsea": 31,
    "rockhead": 32,
    "shadowtag": 33,
    "sheerforce": 34,
    "shellarmor": 35,
    "shielddust": 36,
    "simple": 37,
    "stickyhold": 38,
    "stormdrain": 39,
    "sturdy": 40,
    "suctioncups": 41,
    "symbiosis": 42,
    "thickfat": 43,
    "truant": 44,
    "unaware": 45,
    "unburden": 46,
    "wonderguard": 47
};
const abilityCount = 48;

/**
 * @param {string} ability
 * @return float[]
 */
function oneHotEncodeAbility(ability) {
    return getOneHotEncoding(abilityMapping[ability], abilityCount);
}

/**
 * @param {int} position
 * @param {int} length
 * @return float[]
 */
function getOneHotEncoding(position, length) {
    let oneHotEncoding = new Array(length).fill(0);
    oneHotEncoding[position] = 1;
    return oneHotEncoding;
}

module.exports = {
    getOneHotEncoding,
    oneHotEncodeAbility
};