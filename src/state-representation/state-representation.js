const typechart = require('../../Pokemon-Showdown/data/typechart');
const abilityCount = 48;
const abilityMapping = {
    'angerpoint': 0,
    'arenatrap': 1,
    'battlearmor': 2,
    'clearbody': 3,
    'cloudnine': 4,
    'colorchange': 5,
    'comatose': 6,
    'contrary': 7,
    'damp': 8,
    'dancer': 9,
    'deltastream': 10,
    'desolateland': 11,
    'disguise': 12,
    'dryskin': 13,
    'emergencyexit': 14,
    'flashfire': 15,
    'flowergift': 16,
    'immunity': 17,
    'intimidate': 18,
    'klutz': 19,
    'levitate': 20,
    'lightningrod': 21,
    'magicbounce': 22,
    'magicguard': 23,
    'magnetpull': 24,
    'multiscale': 25,
    'mummy': 26,
    'normalize': 27,
    'pickup': 28,
    'prankster': 29,
    'pressure': 30,
    'primordialsea': 31,
    'rockhead': 32,
    'shadowtag': 33,
    'sheerforce': 34,
    'shellarmor': 35,
    'shielddust': 36,
    'simple': 37,
    'stickyhold': 38,
    'stormdrain': 39,
    'sturdy': 40,
    'suctioncups': 41,
    'symbiosis': 42,
    'thickfat': 43,
    'truant': 44,
    'unaware': 45,
    'unburden': 46,
    'wonderguard': 47,
};
const boostableStatNames = ["atk", "def", "spa", "spd", "spe"];
const types = Object.keys(typechart.BattleTypeChart);
const numberOfTypes = types.length;

/**
 * Encode the observable battle state into an array of floats that can be used as a state
 * representation for reinforcement learning algorithms.
 *
 * @param {Battle} battle
 * @return {number[]}
 */
function encodeBattle(battle) {
    return encodePokemon(battle.activePokemon);
}

/**
 * @param {Pokemon} pokemon
 * @return {number[]}
 */
function encodePokemon(pokemon) {
    let encodedPokemon = [];
    return encodedPokemon.concat(encodeAbility(pokemon.ability))
        .concat(encodeAllStats(pokemon));
}

/**
 * @param {Pokemon} pokemon
 * @return {number[]}
 */
function encodeMoves(pokemon) {
    let encodedMoves = [];
    pokemon.moves.forEach(function (move) {
        encodedMoves = encodedMoves.concat(encodeMove(move));
    });
    pokemon.moves
}

/**
 * @param {Move} move
 * @return {number[]}
 */
function encodeMove(move) {
    let encodedMove = [];
    encodedMove.push(move.basePower, encodeAccuracy(move.accuracy));
    return encodedMove.concat(encodeType(move.type));
}

/**
 * @param {boolean | number} accuracy
 * @return {number[]}
 */
function encodeAccuracy(accuracy) {
    if (accuracy === true) {
        return 1000;
    } else {
        return accuracy;
    }
}

/**
 * @param {string} type
 * @return {number[]}
 */
function encodeType(type) {
    return createOneHotEncoding(types.indexOf(type), numberOfTypes);
}

/**
 * @param {Pokemon} pokemon
 * @return {number[]}
 */
function encodeAllStats(pokemon) {
    let encodedStats = [];
    return encodedStats.push(pokemon.maxhp)
        .concat(encodeBoostableStats(pokemon, false, false))
        .concat(encodeBoostableStats(pokemon, true, false))
        .concat(encodeBoostableStats(pokemon, true, true));
}

/**
 * @param {Pokemon} pokemon
 * @param {boolean} [unboosted]
 * @param {boolean} [unmodified]
 * @return {number[]}
 */
function encodeBoostableStats(pokemon, unboosted, unmodified) {
    let encodedStats = [];
    boostableStatNames.forEach(function (statName) {
        encodedStats.push(apokemon.getStat(statName, unboosted, unmodified));
    });
    return encodedStats;
}

/**
 * @param {string} ability
 * @return {number[]}
 */
function encodeAbility(ability) {
    return createOneHotEncoding(abilityMapping[ability], abilityCount);
}

/**
 * @param {int} position
 * @param {int} length
 * @return {number[]}
 */
function createOneHotEncoding(position, length) {
    let oneHotEncoding = new Array(length).fill(0);
    oneHotEncoding[position] = 1;
    return oneHotEncoding;
}

module.exports = {
    encodeBattle,
    encodePokemon,
    encodeAllStats,
    encodeBoostableStats,
    encodeMove,
    encodeAbility,
    createOneHotEncoding,
};
