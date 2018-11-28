'use strict';

require('colors');
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

        this.battle = new Battle();
        this.request = null;
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
            if (cmd === 'error') {
                throw new Error(rest);
            }
            this.battle.activityQueue.push(line);
        }
        this.battle.update();
    }
}

module.exports = Side;
