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
        // TODO: if opponent chose uturn/voltswitch/etc. skip computing
        // determine player and opponent
        // console.log(actions);
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
                // not available in list (Not In List), not switching probably a bad choice
                typeOfCheck = 'na';
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
            // in this case the goal is to not switch
            console.log(`>> ${player}: Stay in.`);
            // stay in, remove all switch options from actions
            // check if moveactions available
            let moveIsPossible = this._actionTypePossible(actions, 'move');

            if (moveIsPossible) {
                // only keep MoveActions
                stayInActions = actions.filter((e) => (e.type === 'move'));
                // TODO: 1v1
                action = _.sample(stayInActions);
            } else {
                // TODO: elaborate situation in which switching is only move, and use a strategy
                // action = _.sample(actions);
            }

            break;
        case 'ssi':
            // in this case the goal is to switch into a gsi
            console.log(`>> ${player}: Search gsi`);
            // check if switch action is possible
            let switchIsPossibleSsi = this._actionTypePossible(actions, 'switch');

            if (switchIsPossibleSsi) {
                console.log(`>> ${player}: Switching is possible`);
                // if we are in this case, we already know our active pokemon is not gsi
                // if only one choice in switching then no need to continue
                if (actions.length == 1) {
                    // TODO: set action
                    console.log(`>> ${player}: Only one option to switch`);
                    break;
                }

                // check if we have gsi to the opponent's active pokemon in own team
                // returns [gsiExists, gsiName, gsiIndexInTeam]
                let gsiData = this._inXsi(info, oppMonChecks.gsi);
                // whether we have a gsi in the team
                let gsiExists = gsiData[0];
                // pokemon name (to which we should switch)
                let gsiName = gsiData[1];
                // index of the pokemon we should switch to (in own pokemon list)
                let gsiIndexInTeam = gsiData[2];

                if (gsiExists) {
                    console.log(`>> ${player}: Found gsi, switch to ${gsiName}`);
                    // do the switch to gsi
                    // console.log(`Action: ${action}`);
                    // search for correct switch action in actions object
                    for (const act of actions) {
                        if ((act.type === 'switch') && (act.pokeNum == (gsiIndexInTeam + 1))) {
                            action = act;
                            console.log(`>> ${player}: Switchaction index ${gsiIndexInTeam+1}`);
                            break;
                        }
                    }
                    // action = new SwitchAction(gsiIndexInTeam+1);
                } else {
                    console.log(`>> ${player}: No gsi found, stay in`);
                    // make sure a MoveAction is possible, else switch anyway
                    let moveIsPossibleSsi = this._actionTypePossible(actions, 'move');

                    if (moveIsPossibleSsi) {
                        console.log(`>> ${player}: Move is possible, stay in`);
                        stayInActions = actions.filter((e) => (e.type === 'move'));
                        // console.log(stayInActions);
                        // TODO: 1v1
                        action = _.sample(stayInActions);
                    } else {
                        // switch anyway
                        console.log(`>> ${player}: Move is not possible, switch`);
                    }
                }
            } else {
                // switching is not a valid choice
                // TODO: 1v1
                console.log(`>> ${player}: Switching not possible, stay in`);
            }
            break;
        case 'nsi':
            console.log(`>> ${player}: Search gsi/ssi`);
            // in this case the goal is to search gsi first and then ssi
            let switchIsPossibleNsi = this._actionTypePossible(actions, 'switch');

            if (switchIsPossibleNsi) {
                console.log(`>> ${player}: Switching is possible`);
                // if we are in this case, we already know our active pokemon is not gsi
                // if only one choice in switching then no need to continue
                if (actions.length == 1) {
                    // TODO: set action
                    console.log(`>> ${player}: Only one option to switch`);
                    break;
                }
                // check if we have gsi to the opponent's active pokemon in own team
                let gsiDataNsi = this._inXsi(info, oppMonChecks.gsi);
                let gsiExistsNsi = gsiDataNsi[0];
                let gsiNameNsi = gsiDataNsi[1];
                let gsiIndexInTeamNsi = gsiDataNsi[2];

                if (gsiExistsNsi) {
                    console.log(`>> ${player}: Found gsi, switch to ${gsiNameNsi}`);
                    // do the switch to gsi
                    // console.log(`Action: ${action}`);
                    // search for correct switch action in actions object
                    for (const act of actions) {
                        if ((act.type === 'switch') && (act.pokeNum == (gsiIndexInTeamNsi + 1))) {
                            action = act;
                            console.log(`>> ${player}: Switchaction index ${gsiIndexInTeamNsi+1}`);
                            break;
                        }
                    }
                } else {
                    console.log(`>> ${player}: No gsi found, search for ssi`);
                    let ssiDataNsi = this._inXsi(info, oppMonChecks.ssi);
                    let ssiExistsNsi = ssiDataNsi[0];
                    let ssiNameNsi = ssiDataNsi[1];
                    let ssiIndexInTeamNsi = ssiDataNsi[2];

                    if (ssiExistsNsi) {
                        console.log(`>> ${player}: Found ssi, switch to ${ssiNameNsi}`);
                        // do the switch to gsi
                        // console.log(`Action: ${action}`);
                        // search for correct switch action in actions object
                        for (const act of actions) {
                            if ((act.type === 'switch') && (act.pokeNum == (ssiIndexInTeamNsi+1))) {
                                action = act;
                                console.log(`>> ${player}: Switchaction index`
                                  + `${ssiIndexInTeamNsi+1}`);
                                break;
                            }
                        }
                    } else {
                        console.log(`>> ${player}: No ssi found, stay in`);
                        // make sure a MoveAction is possible, else switch anyway
                        let moveIsPossibleNsi = this._actionTypePossible(actions, 'move');

                        if (moveIsPossibleNsi) {
                            console.log(`>> ${player}: Move is possible, stay in`);
                            stayInActions = actions.filter((e) => (e.type === 'move'));
                            // console.log(stayInActions);
                            // TODO: 1v1
                            action = _.sample(stayInActions);
                        } else {
                            // switch anyway
                            console.log(`>> ${player}: Move is not possible, switch`);
                        }
                    }
                }
            } else {
                // switching is not a valid choice
                // TODO: 1v1
                console.log(`>> ${player}: Switching not possible, stay in`);
            }

            break;
        case 'na':
            console.log(`>> ${player}: Search gsi/ssi/nsi, or typeResistance`);
            // in this case the goal is to search gsi first then ssi then nsi
            let switchIsPossibleNa = this._actionTypePossible(actions, 'switch');

            if (switchIsPossibleNa) {
                console.log(`>> ${player}: Switching is possible`);
                // if only one choice in switching then no need to continue
                if (actions.length == 1) {
                    // TODO: set action
                    console.log(`>> ${player}: Only one option to switch`);
                    break;
                }
                // check if we have gsi to the opponent's active pokemon in own team
                let gsiDataNa = this._inXsi(info, oppMonChecks.gsi);
                let gsiExistsNa = gsiDataNa[0];
                let gsiNameNa = gsiDataNa[1];
                let gsiIndexInTeamNa = gsiDataNa[2];

                if (gsiExistsNa) {
                    console.log(`>> ${player}: Found gsi, switch to ${gsiNameNa}`);
                    for (const act of actions) {
                        if ((act.type === 'switch') && (act.pokeNum == (gsiIndexInTeamNa + 1))) {
                            action = act;
                            console.log(`>> ${player}: Switchaction index ${gsiIndexInTeamNa+1}`);
                            break;
                        }
                    }
                } else {
                    console.log(`>> ${player}: No gsi found, search for ssi`);
                    let ssiDataNa = this._inXsi(info, oppMonChecks.ssi);
                    let ssiExistsNa = ssiDataNa[0];
                    let ssiNameNa = ssiDataNa[1];
                    let ssiIndexInTeamNa = ssiDataNa[2];

                    if (ssiExistsNa) {
                        console.log(`>> ${player}: Found ssi, switch to ${ssiNameNa}`);
                        // do the switch to gsi
                        // console.log(`Action: ${action}`);
                        // search for correct switch action in actions object
                        for (const act of actions) {
                            if ((act.type === 'switch') && (act.pokeNum == (ssiIndexInTeamNa+1))) {
                                action = act;
                                console.log(`>> ${player}: Switchaction index`
                                  + `${ssiIndexInTeamNa+1}`);
                                break;
                            }
                        }
                    } else {
                        console.log(`>> ${player}: No ssi found, search for nsi`);
                        let nsiDataNa = this._inXsi(info, oppMonChecks.nsi);
                        let nsiExistsNa = nsiDataNa[0];
                        let nsiNameNa = nsiDataNa[1];
                        let nsiIndexInTeamNa = nsiDataNa[2];

                        if (nsiExistsNa) {
                            console.log(`>> ${player}: Found nsi, switch to ${nsiNameNa}`);
                            // do the switch to nsi
                            // console.log(`Action: ${action}`);
                            // search for correct switch action in actions object
                            for (const act of actions) {
                                if ((act.type === 'switch')
                                && (act.pokeNum == (nsiIndexInTeamNa+1))) {
                                    action = act;
                                    console.log(`>> ${player}: Switchaction index`
                                      + `${nsiIndexInTeamNa+1}`);
                                    break;
                                }
                            }
                        } else {
                            console.log(`>> ${player}: No nsi found, check typeResistance (TODO)`);
                        }
                    }
                }
            } else {
                // switching is not a valid choice
                // TODO: 1v1
                console.log(`>> ${player}: Switching not possible, stay in`);
            }
            break;
        default:
            console.log(`>> ${player}: Unexpected typeOfCheck`);
        }
        return action;
    }


    /**
     * return whether the action specified in actionType is present in the actions object
     *
     * @param {actions} actions
     * @param {string} actionType
     * @return {bool}
     */
    _actionTypePossible(actions, actionType) {
        let actionPossible = false;
        for (const acts of actions) {
            if (acts.type === actionType) {
                actionPossible = true;
                break;
            }
        }
        return actionPossible;
    }

    /**
     * returns xsi (gsi or ssi or nsi) data
     *
     * @param {info} info
     * @param {string[]} oppMonChecks //.xsi, array which should be searched
     * @return {[]}
     */
    _inXsi(info, oppMonChecks) {
        // keeps current pokemon during iterating our teamlist
        let currentPokemon;
        // whether we have a xsi in the team
        let xsiExists = false;
        // the xsi pokemon's index in oppActiveMon's xsi list
        let xsiIndex;
        // pokemon name (to which we should switch)
        let xsiName;
        // index of the pokemon we should switch to (in own pokemon list)
        let xsiIndexInTeam = 0;
        // check if we have xsi to the opponent's active pokemon in own team
        for (const pokemon of info.side.pokemon) {
            // we want to switch, so skip the own active pokemon
            if (!pokemon.active) {
                currentPokemon = pokemon.ident.slice(4).toLowerCase().replace(/\s/g, '');
                // check if currentPokemon appears in oppActiveMon's xsi list
                if (oppMonChecks) {
                    xsiIndex = oppMonChecks.indexOf(`${currentPokemon}`);
                    if (xsiIndex > -1) {
                        xsiExists = true;
                        xsiName = oppMonChecks[xsiIndex];
                        // found xsi, exit loop
                        break;
                    }
                }
            }
            xsiIndexInTeam++;
        }
        return [xsiExists, xsiName, xsiIndexInTeam];
    }
}

module.exports = ChecksSwitchAgent;
