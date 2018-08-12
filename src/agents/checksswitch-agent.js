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

        // get my active mon
        let myActiveMon;
        let myMons = info.side.pokemon;
        for (const pokemon of myMons) {
            if (pokemon.active == true) {
                myActiveMon = pokemon.ident.slice(4).toLowerCase().replace(/\s/g, '');
            }
        }
        // console.log(myActiveMon);

        // get the opponent's active mon
        let oppActiveMon;
        // if p1, go into Bot 2's pokemon list to search for the active pokemon
        if (player === 'p1') {
            if (battle.sides[1].active[0]) {
                oppActiveMon = battle.sides[1].active[0].species.toLowerCase().replace(/\s/g, '');
            } else {
                oppActiveMon = 'missingno';
                // console.log('Not initialized yet');
            }
        } else {
            if (battle.sides[0].active[0]) {
                oppActiveMon = battle.sides[0].active[0].species.toLowerCase().replace(/\s/g, '');
            } else {
                oppActiveMon = 'missingno';
                // console.log('Not initialized yet');
            }
        }
        // console.log(oppActiveMon);

        // find out from the checks graph how well you deal with it

        // find the opposing active pokemon on the graph and store its checks and counters
        let oppMonChecks = checks[`${oppActiveMon}`];

        // search in lists for the own active pokemon
        let typeOfCheck;
        if (oppMonChecks) {
            if (oppMonChecks.gsi.indexOf(`${myActiveMon}`) > -1) {
                typeOfCheck = 'gsi';
            } else if (oppMonChecks.ssi.indexOf(`${myActiveMon}`) > -1) {
                typeOfCheck = 'ssi';
            } else if (oppMonChecks.nsi.indexOf(`${myActiveMon}`) > -1) {
                typeOfCheck = 'nsi';
            } else {
                // not available in list, not switching probably a bad choice
                typeOfCheck = '--';
            }
        }
        console.log(`>> I'm ${player}, my opponent is ${opponent}.`);
        console.log(`>> My active ${myActiveMon} is ${typeOfCheck} to my opponent's active ${oppActiveMon}`);

        // try to find a pokemon on your team that does better against the current opposing pokemon. if the current pokemon is already the best choice, attack. if there is a pokemon that does better against the current opposing pokemon, switch to it
        // console.log(actions);
        const action = _.sample(actions);

        switch (typeOfCheck) {
        case 'gsi':
            console.log('>> Stay in.');
            break;
        case 'ssi':
            console.log('>> Search gsi.');
            // if gsi empty, stay in
            break;
        case 'nsi':
            console.log('>> Search gsi/ssi.');
            // if gsi/ssi empty, stay in
            break;
        case '--':
            console.log('>> Search gsi/ssi/nsi, if empty switch based on typeResistance ');
            // do random action for now here
            break;
        default:
            console.log('Unexpected typeOfCheck');
        }

        return action;
    }
}

module.exports = ChecksSwitchAgent;
