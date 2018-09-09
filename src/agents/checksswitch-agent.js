'use strict';

const BattleAgent = require('./base-agent');
const _ = require('underscore');
const checks = require('../../data/compTest.json');
const types = require('../../data/types.js');
const pokedex = require('../../Pokemon-Showdown/data/pokedex.js');
// TODO: create custom pokedex. rm unnecessary info to make search faster

// const actions = require('./actions');

// const MoveAction = actions.MoveAction;
// const SwitchAction = actions.SwitchAction;
// const TeamAction = actions.TeamAction;
const BattleTypeChart = types.BattleTypeChart;
const BattlePokedex = pokedex.BattlePokedex;

/**
 * An agent that chooses actions based on checks.json and types.js
 */
class ChecksSwitchAgent extends BattleAgent {
    /**
     * @param {ObjectReadWriteStream} playerStream
     * @param {boolean} debug
     */
    constructor(playerStream, debug) {
        super(playerStream, debug);
        // this._xsiMatchupMatrix = new Array(6).fill(new Array(6)); // didn't work
        this._faintedList = null;
        this._xsiMatchupMatrix = null;
        this._typesMatchupMatrix = null;
        this._myMonsList = null;
        this._oppMonsList = null;
        this._myMonsKeys = null;
        this._oppMonsKeys = null;
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
        const player = info.side.id;
        console.log('----');
        console.log(BattleTypeChart['Fire'].damageTaken['Bug']);
        console.log(BattlePokedex['ninetalesalola'].types);

        // console.log(info.side.pokemon);

        // only in first turn
        // if (info.teamPreview) {
        //     let xsiMatrix = new Array(6);
        //     for (let i = 0; i < x.length; i++) {
        //         xsiMatrix[i] = new Array(6);
        //     }
        //     console.log(xsiMatrix);
        // }

        if (info.teamPreview) {
            // console.log(this._xsiMatrix);
            // console.log(info.side.pokemon);
            // get own team
            // list of all own pokemon
            this._myMonsList = new Array(6);
            let arrayIndex = 0;
            for (const pokemon of info.side.pokemon) {
                this._myMonsList[arrayIndex] = this._normName(pokemon.details);
                arrayIndex++;
            }
            // get list of opposing pokemon
            let oppMons;
            if (player === 'p1') {
                oppMons = battle.sides[1].pokemon;
            } else {
                oppMons = battle.sides[0].pokemon;
            }

            this._oppMonsList = new Array(6);
            arrayIndex = 0;
            for (const pokemon of oppMons) {
                this._oppMonsList[arrayIndex] = this._normName(pokemon.details);
                arrayIndex++;
            }
            console.log(`>> ${player}: My team: ${this._myMonsList}`);
            console.log(`>> ${player}: My opponents team: ${this._oppMonsList}`);

            //              mon1 mon2 mon3 ...(opponent)
            // mon 1      |
            // mon 2      |
            // (own mons) |

            // set keys. "slowbro" : 0
            this._myMonsKeys = {
                [this._myMonsList[0]]: 0,
                [this._myMonsList[1]]: 1,
                [this._myMonsList[2]]: 2,
                [this._myMonsList[3]]: 3,
                [this._myMonsList[4]]: 4,
                [this._myMonsList[5]]: 5,
            };

            this._oppMonsKeys = {
                [this._oppMonsList[0]]: 0,
                [this._oppMonsList[1]]: 1,
                [this._oppMonsList[2]]: 2,
                [this._oppMonsList[3]]: 3,
                [this._oppMonsList[4]]: 4,
                [this._oppMonsList[5]]: 5,
            };
            // console.log(oppMonsKeys);
            // console.log(myMonsKeys);

            // calculate the xsiMatchupMatrix
            // for all pokemon in the opposing team
            // determine whether it is gsi, ssi, nsi, or na
            // insert 3, 2, 1, or 0 in matchupMatrix
            // columns i (oppMons), rows j (myMons)
            this._xsiMatchupMatrix = new Array(6);
            for (let i = 0; i < this._xsiMatchupMatrix.length; i++) {
                this._xsiMatchupMatrix[i] = new Array(6);
            }
            let oppMonW;
            for (let i = 0; i < 6; i++) {
                oppMonW = this._oppMonsList[i];
                for (let j = 0; j < 6; j++) {
                    // console.log(`>> ${player}: Search in ${oppMonW} for ${myMonsList[j]}`);
                    this._xsiMatchupMatrix[j][i] =
                     this._xsiMatchupValue(oppMonW, this._myMonsList[j]);
                    // console.log(`>> ${player}: ${xsiMatchupMatrix[j][i]}`);
                }
            }

            // calculate the typesMatchupMatrix
            this._typesMatchupMatrix = new Array(6);
            for (let i = 0; i < this._typesMatchupMatrix.length; i++) {
                this._typesMatchupMatrix[i] = new Array(6);
            }
            for (let i = 0; i < 6; i++) {
                oppMonW = this._oppMonsList[i];
                for (let j = 0; j < 6; j++) {
                    // console.log(`>> ${player}: Search in ${oppMonW} for ${myMonsList[j]}`);
                    this._typesMatchupMatrix[j][i] =
                     this._typesMatchupValue(oppMonW, this._myMonsList[j]);
                    // console.log(`>> ${player}: ${xsiMatchupMatrix[j][i]}`);
                }
            }

            // for all missing values (-1) in xsi matchup matrix, take values from typeMUMatrix
            for (let i = 0; i < 6; i++) {
                for (let j = 0; j < 6; j++) {
                    if (this._xsiMatchupMatrix[i][j] == -1) {
                        // to convert from typeMatrix to checksmatrix do: (8-value)*(3/8)
                        this._xsiMatchupMatrix[i][j] = (8-this._typesMatchupMatrix[i][j])*(0.375);
                    }
                }
            }
            console.log(`>> ${player}: xsiMatchupMatrix`);
            console.log(this._xsiMatchupMatrix);
            // console.log(`>> ${player}: typesMatchupMatrix`);
            // console.log(this._typesMatchupMatrix);

            // TODO: calc most threatening mon based on checks and type + the opponnents.
        }

        // get my active mon
        let myActiveMon;
        let oppActiveMon;
        let myMons = info.side.pokemon;
        for (const pokemon of myMons) {
            if (pokemon.active == true) {
                myActiveMon = this._normName(pokemon.details);
            }
        }

        // get the opponent's active mon
        // if p1, go into Bot 2's pokemon list to search for the active pokemon
        if (player === 'p1') {
            if (battle.sides[1].active[0]) {
                oppActiveMon = this._normName(battle.sides[1].active[0].details);
            } else {
                oppActiveMon = 'missingno';
                // console.log('Not initialized yet');
            }
        } else {
            if (battle.sides[0].active[0]) {
                oppActiveMon = this._normName(battle.sides[0].active[0].details);
            } else {
                oppActiveMon = 'missingno';
                // console.log('Not initialized yet');
            }
        }

        // get the current matchup based on checksgraph
        let activeMatchup = this._lookUpInMatchupMatrix(myActiveMon, oppActiveMon);
        // find the opposing active pokemon on the graph and store its checks and counters
        let oppMonChecks = checks[oppActiveMon];
        // search in lists for the own active pokemon
        let typeOfCheck;
        if (oppMonChecks) {
            typeOfCheck = this._matchUpValueToXsi(activeMatchup);
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
        let bestSwitch = this._xsiGetBestSwitch(battle, actions, info,
            activeMatchup, myActiveMon, oppActiveMon, player);
        if (bestSwitch) {
            console.log(`>> ${player}: Best switch`);
            console.log(bestSwitch);
            action = bestSwitch;
        } else {
            let moveIsPossible = this._actionTypePossible(actions, 'move');
            if (moveIsPossible) {
                // only keep MoveActions
                let stayInActions = actions.filter((e) => (e.type === 'move'));
                // TODO: 1v1
                action = _.sample(stayInActions);
            } else {
                console.log(`>> ${player}: No switch was recommended.`);
                console.log(actions);
                action = _.sample(actions);
            }
        }
        // TODO: both mons fainted: random choice for now
        // TODO: opponent used uturn or similar, and our mon fainted: random choice for now
        // old impl
        // let bestSwitchOLD = this._getBestSwitchOLD(battle, actions, info,
        //     activeMatchup, myActiveMon, oppActiveMon, player, typeOfCheck, oppMonChecks);
        // console.log(bestSwitchOLD);

        return action;
    }

    /**
     * calculates the best switch possible in current turn
     * when only one switch option possible in actions (length==1). this function returns it
     *
     * @param {battle} battle
     * @param {actions} actions
     * @param {info} info
     * @param {int} activeMatchup current matchup Value of myActiveMon vs. oppActiveMon
     * @param {string} myActiveMon
     * @param {string} oppActiveMon
     * @param {player} player
     * @return {action} if null, it signals to caller that no switch shall be done
     */
    _xsiGetBestSwitch(battle, actions, info, activeMatchup, myActiveMon, oppActiveMon, player) {
        let returnAction = null;
        // check if bigger value exists in matchupMatrix compared to activeMatchup
        // look at opposing mon's column and determine max
        // TODO: integrate static max for every column into MUMatrix, maybe in a MUMatrix object
        // TODO: but current code makes fainted-skips easier

        // maximum Matchup Value in column of oppActiveMon in MUMatrix, active and fainted excluded
        let maxMatchupValue = -2;
        let currentMatchupValue;
        // index of oppMon in MUMatrix
        let oppMonIndex = this._oppMonsKeys[oppActiveMon];
        // let switchToName;
        let switchToNameBest;
        let switchToNameBestOld;
        let oldMax;
        for (let i = 0; i < 6; i++) {
            currentMatchupValue = this._xsiMatchupMatrix[i][oppMonIndex];
            if (currentMatchupValue > maxMatchupValue) {
                oldMax = maxMatchupValue;
                maxMatchupValue = currentMatchupValue;
                switchToNameBestOld = switchToNameBest;
                switchToNameBest = this._myMonsList[i];
                if (this._isFainted(this._myMonsList[i], info)) {
                    console.log(`>> ${player}(GBS): ${this._myMonsList[i]} fainted`);
                    maxMatchupValue = oldMax;
                    switchToNameBest = switchToNameBestOld;
                }
                if (this._isActive(this._myMonsList[i], info)) {
                    console.log(`>> ${player}(GBS): ${this._myMonsList[i]} is already active`);
                    maxMatchupValue = oldMax;
                    switchToNameBest = switchToNameBestOld;
                    // console.log(`>> ${player}(GBS): Next best switch is ${switchToNameBest}`);
                }
            }
        }
        console.log(`>> ${player}(GBS): activeMatchup ${activeMatchup}, `
          + `maxMatchupValue ${maxMatchupValue}`);
        console.log(`>> ${player}(GBS): Besides staying in, `
          + `best switch would be ${switchToNameBest}`);

        if (maxMatchupValue <= activeMatchup) {
            // don't switch, a best check already active
            console.log(`>> ${player}(GBS): A best check already active`);
            // if no moveactions possible, recommend switch anyway with a best switch
            let moveIsPossible = this._actionTypePossible(actions, 'move');
            if (!moveIsPossible) {
                console.log(`>> ${player}(GBS): No move is possible, recommend switch anyway.`);
                let switchIsPossible = this._actionTypePossible(actions, 'switch');
                if (switchIsPossible) {
                    console.log(`>> ${player}(GBS): Switching is possible`);
                    // if only one choice in switching then no need to continue
                    if (actions.length == 1) {
                        console.log(`>> ${player}(GBS): Only one option to switch`);
                        returnAction = _.sample(actions);
                        return returnAction;
                    }
                    // TODO: find out when switchactions can not be found in actions
                    // returnAction = _.sample(actions);
                    let indexInOwnTeam = this._getIndexInOwnTeam(switchToNameBest, info);
                    // search for correct switch action in actions object
                    for (const act of actions) {
                        if ((act.type === 'switch') && (act.pokeNum == (indexInOwnTeam))) {
                            console.log(`>> ${player}(GBS): Switchaction index ${indexInOwnTeam}`);
                            returnAction = act;
                            console.log(`>> ${player}(GBS): Switching to ${switchToNameBest}`);
                            break;
                        }
                    }
                } else {
                    console.log(`>> ${player}(GBS): Switching not possible, move not possible`);
                }
            }
        } else {
            // better check found than active, switch to switchToName
            console.log(`>> ${player}(GBS): switching to ${switchToNameBest}`);
            let switchIsPossible = this._actionTypePossible(actions, 'switch');
            if (switchIsPossible) {
                console.log(`>> ${player}(GBS): Switching is possible`);
                // if only one choice in switching then no need to continue
                if (actions.length == 1) {
                    console.log(`>> ${player}(GBS): Only one option to switch`);
                    returnAction = _.sample(actions);
                    return returnAction;
                }
                // TODO: find out when switchactions can not be found in actions
                // returnAction = _.sample(actions);
                let indexInOwnTeam = this._getIndexInOwnTeam(switchToNameBest, info);
                // search for correct switch action in actions object
                for (const act of actions) {
                    if ((act.type === 'switch') && (act.pokeNum == (indexInOwnTeam))) {
                        console.log(`>> ${player}(GBS): Switchaction index ${indexInOwnTeam}`);
                        returnAction = act;
                        console.log(`>> ${player}(GBS): switching to ${switchToNameBest}`);
                        break;
                    }
                }
            } else {
                console.log(`>> ${player}(GBS): Switching not possible`);
            }
        }
        return returnAction;
    }

    /**
     * gets the index of the pokemon in own pokemon list for switching
     *
     * @param {string} switchTo pokemon name, to switch to
     * @param {info} info
     * @return {int}
     */
    _getIndexInOwnTeam(switchTo, info) {
        // keeps current pokemon during iterating our teamlist
        let currentPokemon;
        let idx = 0;
        // index of the pokemon we should switch to (in own pokemon list)
        let indexInTeam = 0;
        // check if we have xsi to the opponent's active pokemon in own team
        for (const pokemon of info.side.pokemon) {
            // we want to switch, skip the own active pokemon
            if (!pokemon.active) {
                currentPokemon = this._normName(pokemon.details);
                if (switchTo === currentPokemon) {
                    indexInTeam = idx;
                    break;
                }
            }
            idx++;
        }
        return indexInTeam+1;
    }

    // TODO
    /**
     * teamPreview computations and choosing lead
     *
     * @param {string} pokemon
     * @return {bool}
     */
    _handleTeamPreview(pokemon) {
        return false;
    }

    /**
     * returns the current matchup value based on the checksgraph
     *
     * @param {int} matchupValue
     * @return {string}
     */
    _matchUpValueToXsi(matchupValue) {
        let xsi;
        switch (matchupValue) {
        case 3:
            xsi = 'gsi';
            break;
        case 2:
            xsi = 'ssi';
            break;
        case 1:
            xsi = 'nsi';
            break;
        case 0:
            xsi = 'na';
            break;
        default:
            console.log('Wrong matchupValue');
        }
        return xsi;
    }

    /**
     * returns the current matchup value based on the checksgraph
     *
     * @param {string} myMon
     * @param {string} oppMon
     * @return {int}
     */
    _lookUpInMatchupMatrix(myMon, oppMon) {
        let matchupValue;
        matchupValue = this._xsiMatchupMatrix[this._myMonsKeys[myMon]][this._oppMonsKeys[oppMon]];
        return matchupValue;
    }

    /**
     * returns whether the pokemon is active or not
     * in own team
     *
     * @param {string} isActiveMon the pokemon of which we want to know if it is active
     * @param {info} info
     * @return {bool}
     */
    _isActive(isActiveMon, info) {
        let currentPokemon;
        let isActive = false;
        for (const pokemon of info.side.pokemon) {
            currentPokemon = this._normName(pokemon.details);
            if ((isActiveMon === currentPokemon) && (pokemon.active == true)) {
                isActive = true;
                break;
            }
        }
        return isActive;
    }

    /**
     * returns whether the pokemon is fainted or not
     * in own team
     *
     * @param {string} faintedMon
     * @param {info} info
     * @return {bool}
     */
    _isFainted(faintedMon, info) {
        let currentPokemon;
        let isFainted = false;
        for (const pokemon of info.side.pokemon) {
            currentPokemon = this._normName(pokemon.details);
            // condition[0] === '0'
            if ((faintedMon === currentPokemon) && (pokemon.condition === '0 fnt')) {
                isFainted = true;
                break;
            }
        }
        return isFainted;
    }

    /**
     * used to convert pokemon names in an internal standard format
     * returns the normalized pokemon name
     *
     * @param {string} pokemon
     * @return {string}
     */
    _normName(pokemon) {
        // lower case and remove spaces
        let myMon = pokemon.toLowerCase().replace(/\s/g, '');
        // remove all "-" (tapu-koko)
        myMon = myMon.replace(/-/, '');
        // remove "," and everything after that (landorustherian, M)
        myMon = myMon.split(',')[0];

        return myMon;
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
     * Used to generate xsimatchupMatrix entries
     * Returns the matchup value for two specified pokemon
     * Determine whether it is gsi, ssi, nsi, or na
     * We check in pokemonWithList's list what type of check pokemonInList is to it
     *
     * @param {string} pokemonWithList
     * @param {string} pokemonInList
     * @return {int}
     */
    _xsiMatchupValue(pokemonWithList, pokemonInList) {
        let matchupValue;
        let xsiIndex;
        let xsiLists = checks[pokemonWithList];

        if (xsiLists) {
            // check in gsi
            xsiIndex = xsiLists.gsi.indexOf(pokemonInList);
            if (xsiIndex > -1) {
                // found gsi
                matchupValue = 3;
                return matchupValue;
            }
            // check ssi
            xsiIndex = xsiLists.ssi.indexOf(pokemonInList);
            if (xsiIndex > -1) {
                // found ssi
                matchupValue = 2;
                return matchupValue;
            }
            // check nsi
            xsiIndex = xsiLists.nsi.indexOf(pokemonInList);
            if (xsiIndex > -1) {
                // found nsi
                matchupValue = 1;
                return matchupValue;
            } else {
                // pokemon cannot be found in lists, it is set to na
                matchupValue = 0;
            }
        } else {
            // pokemon not found in the checksgraph, xsiLists is null
            matchupValue = -1;
        }
        return matchupValue;
    }

    /**
     * Used to generate typesmatchupMatrix entries
     * provides answer to: how well does myMon do against oppMon in terms of type
     * Returns the matchup value for two specified pokemon
     *
     * @param {string} myMon
     * @param {string} oppMon
     * @return {int}
     */
    _typesMatchupValue(myMon, oppMon) {
        let matchupValue = 0;
        // get types of both pokemon from pokedex
        let myMonTypes = BattlePokedex[myMon].types;
        let oppMonTypes = BattlePokedex[oppMon].types;

        // dublicate types of mons with only one type
        if (myMonTypes.length == 1) {
            myMonTypes = [myMonTypes[0], myMonTypes[0]];
        }

        if (oppMonTypes.length == 1) {
            oppMonTypes = [oppMonTypes[0], oppMonTypes[0]];
        }

        // console.log(`${myMon}: ${myMonTypes}`);
        // console.log(`${oppMon}: ${oppMonTypes}`);
        let currentOppMonType;
        let currentMyMonType;
        let currentTypeVal;
        for (let i = 0; i < 2; i++) {
            currentOppMonType = oppMonTypes[i];
            for (let j = 0; j < 2; j++) {
                currentMyMonType = myMonTypes[j];
                currentTypeVal = BattleTypeChart[currentOppMonType].damageTaken[currentMyMonType];
                matchupValue += this._getMappedTypeValue(currentTypeVal);
                // console.log(`${currentMyMonType} -> ${currentOppMonType}:`
                //    + `${this._getMappedTypeValue(currentTypeVal)}`);
            }
        }
        return matchupValue;
    }

    /**
     * return mapped typeValue
     * // 0 -> 1, 1 -> 2, 2 -> 1/2, and 3 -> 0
     *
     * @param {int} typeValue
     * @return {int}
     */
    _getMappedTypeValue(typeValue) {
        let mappedTypeValue;
        switch (typeValue) {
        case 0:
            mappedTypeValue = 1;
            break;
        case 1:
            mappedTypeValue = 2;
            break;
        case 2:
            mappedTypeValue = 0.5;
            break;
        case 3:
            mappedTypeValue = 0;
            break;
        default:
            console.log('Error in _getMappedTypeValue');
        }
        return mappedTypeValue;
    }

    /**
     * calculates the best switch possible in current turn
     * when only one switch option possible in actions (length==1). this function returns it
     *
     * @param {battle} battle
     * @param {actions} actions
     * @param {info} info
     * @param {int} activeMatchup current matchup Value of myActiveMon vs. oppActiveMon
     * @param {string} myActiveMon
     * @param {string} oppActiveMon
     * @param {player} player
     * @param {typeOfCheck} typeOfCheck
     * @param {string[]} oppMonChecks
     * @return {action} if null, it signals to caller that no switch shall be done
     */
    _getBestSwitchOLD(battle, actions, info, activeMatchup, myActiveMon, oppActiveMon, player,
        typeOfCheck, oppMonChecks) {
        // random action if below fails
        let action = _.sample(actions);
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
            // in this case the goal is to switch into a gsi, if not found stay in
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
            console.log(`>> ${player}: Pokemon not known, check for typeResistance (TODO)`);
        }
        return action;
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
                currentPokemon = this._normName(pokemon.details);
                // check if currentPokemon appears in oppActiveMon's xsi list
                if (oppMonChecks) {
                    xsiIndex = oppMonChecks.indexOf(currentPokemon);
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
