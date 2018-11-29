'use strict';

require('colors');
const _ = require('underscore');
const Battle = require('./state/battle');
const splitFirst = require('./utils').splitFirst;

/**
 * @typedef {Object} PlayerSpec
 * @property {string} name
 * @property {string} team
 */

/**
 * A side of a Pokémon battle.
 */
class Side {
    /**
     * @param {'p1' | 'p2'} number
     * @param {PlayerSpec} spec
     * @param {boolean} [debug]
     */
    constructor(number, spec, debug = false) {
        this.debug = debug;
        this.number = number;
        this.name = spec.name | 'Player';
        this.team = spec.team;

        this.request = null;
        this.battle = new Battle();
        this.battle.customCallback = (battle, type, args, kwargs) => {
            switch (type) {
            case 'trapped':
                this.request.active[0].trapped = true;
                break;
            case 'cant':
                for (var i = 0; i < this.request.active[0].moves.length; i++) {
                    if (this.request.active[0].moves[i].id === args[3]) {
                        this.request.active[0].moves[i].disabled = true;
                    }
                }
                break;
            }
        };
    }

    /**
     * Handle a battle update message.
     * @param {string} chunk
     */
    receive(chunk) {
        for (const line of chunk.split('\n')) {
            if (this.debug) console.log(`${line}`.gray);
            if (line.charAt(0) !== '|') return;
            const [cmd, rest] = splitFirst(line.slice(1), '|');
            if (cmd === 'error' && rest.substring(0, 16) !== '[Invalid choice]') {
                throw new Error(rest);
            }
            this.battle.activityQueue.push(line);
        }
        this.battle.update();
    }

    /**
     * Returns the subset of properties of the partially observed battle state
     * that might be useful information for the player.
     *
     * @return {Object}
     */
    get state() {
        const battleKeys = [
            'turn', 'weather', 'pseudoWeather', 'weatherTimeLeft', 'weatherMinTimeLeft', 'lastMove',
            'gen', 'teamPreviewCount', 'speciesClause', 'tier', 'gameType', 'endLastTurnPending',
        ];
        const sideKeys = [
            'name', 'id', 'totalPokemon', 'missedPokemon', 'wisher', 'sideConditions', 'n',
        ];
        const omittedPokemonKeys = ['side', 'spriteid'];

        const pickBattleKeys = (battle) => _.pick(battle, battleKeys);
        const pickSideKeys = (side) => _.pick(side, sideKeys);
        const omitPokemonKeys = (pokemon) => _.omit(pokemon, omittedPokemonKeys);

        const state = pickBattleKeys(this.battle);
        state.mySide = pickSideKeys(this.battle.mySide);
        state.mySide.lastPokemon = omitPokemonKeys(this.battle.mySide.lastPokemon);
        state.mySide.active = this.battle.mySide.active.map(omitPokemonKeys);
        state.mySide.pokemon = this.battle.mySide.pokemon.map(omitPokemonKeys);
        state.yourSide = pickSideKeys(this.battle.yourSide);
        state.yourSide.lastPokemon = omitPokemonKeys(this.battle.yourSide.lastPokemon);
        state.yourSide.active = this.battle.yourSide.active.map(omitPokemonKeys);
        state.yourSide.pokemon = this.battle.yourSide.pokemon.map(omitPokemonKeys);

        return state;
    }
}

module.exports = Side;
