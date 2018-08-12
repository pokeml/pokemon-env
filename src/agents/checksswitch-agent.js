'use strict';

const BattleAgent = require('./base-agent');
const _ = require('underscore');
const checks = require('../../data/checks.json');

/**
 * An agent that chooses actions based on checks.json
 */
class ChecksSwitchAgent extends BattleAgent {
    /**
     * Choose an action.
     *
     * @param {AnyObject} battle
     * @param {string[]} actions
     * @param {AnyObject} info
     * @return {string}
     */
    act(battle, actions, info) {
        // determine player and opponent
        const player = info.side.id;
        let opponent = '';

        if (player === 'p1') {
            opponent = 'p2';
        } else {
            opponent = 'p1';
        }
        console.log(`Players: ${player}, ${opponent}`);

        // get my active mon
        let myActiveMon;
        let myMons = info.side.pokemon;
        for (const pokemon of myMons) {
            if (pokemon.active == true) {
                myActiveMon = pokemon.ident.slice(4);
            }
        }
        // console.log(myActiveMon);

        // get the opponent's active mon
        let oppActiveMon;
        // if p1, go into Bot 2's pokemon list to search for the active pokemon
        if (player === 'p1') {
            if (battle.sides[1].active[0]) {
                oppActiveMon = battle.sides[1].active[0].species;
            } else {
                oppActiveMon = 'Missingno';
                // console.log('Not initialized yet');
            }
        } else {
            if (battle.sides[0].active[0]) {
                oppActiveMon = battle.sides[0].active[0].species;
            } else {
                oppActiveMon = 'Missingno';
                // console.log('Not initialized yet');
            }
        }
        // console.log(oppActiveMon);
        console.log(`My active: ${myActiveMon}, opponent's active: ${oppActiveMon}`);

        // find out from the checks graph how well you deal with it

        // try to find a pokemon on your team that does better against the current opposing pokemon. if the current pokemon is already the best choice, attack. if there is a pokemon that does better against the current opposing pokemon, switch to it

        const action = _.sample(actions);
        // console.log(`>>CS Agent: ${action}`);
        // console.log(checks['keldeo']);
        return action;
    }
}

module.exports = ChecksSwitchAgent;
