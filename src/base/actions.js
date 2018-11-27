'use strict';

/**
 * The base class representing any action that can be chosen in a battle.
 */
class Action {
    /**
     * @param {string} type
     * @param {string} choice
     */
    constructor(type, choice) {
        this.type = type;
        this.choice = choice;
    }
}

/**
 * @typedef {Object} MoveActionOptions
 * @property {boolean?} mega
 * @property {boolean?} zmove
 */

/**
 * An action object representing a move, i.e. an attack.
 */
class MoveAction extends Action {
    /**
     * @param {int} moveNum
     * @param {MoveActionOptions} options
     */
    constructor(moveNum, options = {}) {
        let choice = `move ${moveNum}`;
        if (options.mega) {
            choice += ' mega';
        } else if (options.zmove) {
            choice += ' zmove';
        }

        super('move', choice);

        this.moveNum = moveNum;
        this.mega = options.mega | false;
        this.zmove = options.zmove | false;
    }
}

/**
 * An action object representing a switch.
 */
class SwitchAction extends Action {
    /**
     * @param {int} pokeNum
     */
    constructor(pokeNum) {
        super('switch', `switch ${pokeNum}`);
        this.pokeNum = pokeNum;
    }
}

/**
 * An action object representing a team selection at team preview.
 */
class TeamAction extends Action {
    /**
     * @param {string} team
     */
    constructor(team) {
        super('team', `team ${team}`);
        this.team = team;
    }
}

module.exports = {
    MoveAction,
    SwitchAction,
    TeamAction,
};
