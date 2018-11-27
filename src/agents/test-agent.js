'use strict';

const BattleAgent = require('../base/agent');
const _ = require('underscore');

/**
 * An agent for testing purposes.
 */
class TestAgent extends BattleAgent {
    /**
     * Choose an action.
     *
     * @param {Battle} state
     * @param {Action[]} actions
     * @param {Request} info
     * @return {string}
     */
    act(state, actions, info) {
        if (this.debug) {
            this.displayBattleState(state);
            console.log(`action space: ${actions.map((a) => a.choice).join(', ')}`);
            console.log(state);
            console.log(info);
        }
        const action = _.sample(actions);
        if (this.debug) console.log(`>> ${action.choice}`);
        return action;
    }

    /**
     * Print a summary of the battle state to the console.
     *
     * @param {Battle} battle
     */
    displayBattleState(battle) {
        console.log(`Turn: ${battle.turn}`);
        if (battle.weather) {
            console.log(`Weather: ${battle.weather}`);
        }
        console.log('-- My side --');
        this.displaySide(battle.mySide);
        console.log('-- Opponent\'s side --');
        this.displaySide(battle.yourSide);
        console.log();
    }

    /**
     * Print a summary of a player's side to the console.
     *
     * @param {Side} side
     */
    displaySide(side) {
        if (side.sideConditions['stealthrock']) {
            console.log('Stealth Rock');
        }
        if (side.sideConditions['spikes']) {
            console.log(`Spikes: ${side.sideConditions['spikes'][1]}`);
        }
        for (const pokemon of side.pokemon) {
            const hp = ' ' + pokemon.hp + '/' + pokemon.maxhp;
            const active = pokemon.isActive() ? ' active' : '';
            const fainted = pokemon.fainted ? ' fnt' : '';
            console.log(`${pokemon.species}${hp}${active}${fainted}`);
        }
    }
}

module.exports = TestAgent;
