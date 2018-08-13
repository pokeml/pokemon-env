'use strict';

const BattleAgent = require('./base-agent');
const _ = require('underscore');
const checks = require('../../data/checks.json');
const actions = require('./actions');

const MoveAction = actions.MoveAction;
const SwitchAction = actions.SwitchAction;
// const TeamAction = actions.TeamAction;

/**
 * An agent that chooses actions based on checks.json
 */
class ChecksSwitchAgent extends BattleAgent {
    /**
     * @param {ObjectReadWriteStream} playerStream
     * @param {boolean} debug
     */
    constructor(playerStream, debug) {
        super(playerStream, debug);
    }

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
        let opponent;

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
        // console.log(`>> ${player}: I'm ${player}, my opponent is ${opponent}.`);
        console.log(`>> ${player}: My active ${myActiveMon} is ${typeOfCheck} to my opponent's active ${oppActiveMon}`);

        let action;
        // if it's the first turn (team preview), choose lead and return
        if (info.teamPreview) {
            // TODO: choose lead here
            action = _.sample(actions);
            return action;
        }

        // try to find a pokemon on your team that does better against the current opposing pokemon. if the current pokemon is already the best choice, attack. if there is a pokemon that does better against the current opposing pokemon, switch to it

        // random action if below fails
        action = _.sample(actions);
        // console.log(actions);
        let stayInActions;
        switch (typeOfCheck) {
        case 'gsi':
            console.log(`>> ${player}: Stay in.`);
            // stay in, remove all switch options from actions
            // check if moveactions available
            let moveIsPossible = false;
            for (const acts of actions) {
                if (acts instanceof MoveAction) {
                    moveIsPossible = true;
                    break;
                }
            }
            if (moveIsPossible) {
                // console.log(actions);
                // console.log(`>> ${player}: ${stayInActions}`);
                // TODO: chose optimal move
                stayInActions = actions.filter((e) => (e instanceof SwitchAction) != true);
                // console.log(stayInActions);
                action = _.sample(stayInActions);
            } else {
                // TODO: elaborate situation in which switching is only move, and use a stratgy
                action = _.sample(actions);
            }

            break;
        case 'ssi':
            console.log(`>> ${player}: Search gsi.`);
            // if gsi empty, stay in
            break;
        case 'nsi':
            console.log(`>> ${player}: Search gsi/ssi.`);
            // if gsi/ssi empty, stay in
            break;
        case '--':
            console.log(`>> ${player}: Search gsi/ssi/nsi, if empty switch based on typeResistance`);
            // do random action for now here
            break;
        default:
            console.log('>> ${player}: Unexpected typeOfCheck');
        }
        return action;
    }
}

module.exports = ChecksSwitchAgent;
