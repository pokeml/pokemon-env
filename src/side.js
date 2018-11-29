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
}

module.exports = Side;
