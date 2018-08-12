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
 * An action object representing a move, i.e. an attack.
 */
class MoveAction extends Action {
    /**
     * @param {int} moveNum
     * @param {boolean} mega
     * @param {boolean} zmove
     */
    constructor(moveNum, mega, zmove) {
        let choice = `move ${moveNum}`;
        if (mega) {
            choice += ' mega';
        } else if (zmove) {
            choice += ' zmove';
        }

        super('move', choice);

        this.moveNum = moveNum;
        this.mega = mega | false;
        this.zmove = zmove | false;
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
