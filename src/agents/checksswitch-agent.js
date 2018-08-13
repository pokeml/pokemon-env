'use strict';

const BattleAgent = require('./base-agent');
const _ = require('underscore');
const checks = require('../../data/checks.json');
// const actions = require('./actions');

// const MoveAction = actions.MoveAction;
// const SwitchAction = actions.SwitchAction;
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
        // let opponent;
        //
        // if (player === 'p1') {
        //     opponent = 'p2';
        // } else {
        //     opponent = 'p1';
        // }

        // get my active mon
        let myActiveMon;
        let oppActiveMon;

        let myMons = info.side.pokemon;
        for (const pokemon of myMons) {
            if (pokemon.active == true) {
                myActiveMon = pokemon.ident.slice(4).toLowerCase().replace(/\s/g, '');
            }
        }
        // console.log(myActiveMon);

        // get the opponent's active mon
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
        console.log(`>> ${player}: My active ${myActiveMon} is ${typeOfCheck} `
          + `to my opponent's active ${oppActiveMon}`);

        let action;
        // if it's the first turn (team preview), choose lead and return
        if (info.teamPreview) {
            // TODO: choose lead here
            action = _.sample(actions);
            return action;
        }

        // try to find a pokemon on your team that does better against the current opposing pokemon.
        // if the current pokemon is already the best choice, attack.
        // if there is a pokemon that does better against the current opposing pokemon, switch to it

        // random action if below fails
        action = _.sample(actions);
        let stayInActions;
        switch (typeOfCheck) {
        case 'gsi':
            console.log(`>> ${player}: Stay in.`);
            // stay in, remove all switch options from actions
            // check if moveactions available
            let moveIsPossible = false;
            for (const acts of actions) {
                if (acts.type === 'action') {
                    moveIsPossible = true;
                    break;
                }
            }
            if (moveIsPossible) {
                // console.log(actions);
                // console.log(`>> ${player}: ${stayInActions}`);
                stayInActions = actions.filter((e) => (e.type === 'switch'));
                // console.log(stayInActions);
                // TODO: 1v1
                action = _.sample(stayInActions);
            } else {
                // TODO: elaborate situation in which switching is only move, and use a stratgy
                action = _.sample(actions);
            }

            break;
        case 'ssi':
            console.log(`>> ${player}: Search gsi`);
            // check if switch action is possible
            let switchIsPossible = false;
            for (const acts of actions) {
                if (acts.type === 'switch') {
                    switchIsPossible = true;
                    break;
                }
            }
            if (switchIsPossible) {
                // if we are in this case, we already know our active pokemon is not gsi
                let currentPokemon;
                let gsiExists = false;
                // the gsi pokemon's index and name (to which we should switch)
                let gsiIndex;
                let gsiName;
                // check if gsi to the opponent's active exists in own team
                for (const pokemon of info.side.pokemon) {
                    // we want to switch, so skip the own active pokemon
                    if (!pokemon.active) {
                        // get list of own pokemon, and store the first pokemon
                        currentPokemon = pokemon.ident.slice(4).toLowerCase().replace(/\s/g, '');
                        // check if currentPokemon appears in oppActiveMon's gsi list
                        if (oppMonChecks) {
                            gsiIndex = oppMonChecks.gsi.indexOf(`${currentPokemon}`);
                            if (gsiIndex > -1) {
                                gsiExists = true;
                                gsiName = oppMonChecks.gsi[gsiIndex];
                                // found gsi, exit loop
                                break;
                            }
                        }
                    }
                }
                if (gsiExists) {
                    console.log(`>> ${player}: Found gsi, switch to ${gsiName}`);
                    // reset values
                    gsiIndex = -1;
                    gsiExists = false;
                } else {
                    console.log(`>> ${player}: No gsi found, stay in`);
                    stayInActions = actions.filter((e) => (e.type === 'switch'));
                    // TODO: 1v1
                    action = _.sample(stayInActions);
                }
            } else {
                // switching is not a valid choice
                // TODO: 1v1
                console.log(`>> ${player}: Switching not possible, stay in`);
            }
            break;
        case 'nsi':
            console.log(`>> ${player}: Search gsi/ssi`);
            // if gsi/ssi empty, stay in
            break;
        case '--':
            console.log(`>> ${player}: Search gsi/ssi/nsi, or typeResistance`);
            // do random action for now here
            break;
        default:
            console.log('>> ${player}: Unexpected typeOfCheck');
        }
        return action;
    }
}

module.exports = ChecksSwitchAgent;
