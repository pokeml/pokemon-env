'use strict';
/**
 * Based on https://github.com/Zarel/Pokemon-Showdown/blob/master/sim/battle-stream.js#L221.
 */

require('colors');
const Battle = require('../state-tracking/battle');
const actions = require('./actions');
const splitFirst = require('../../utils/utils').splitFirst;

const MoveAction = actions.MoveAction;
const SwitchAction = actions.SwitchAction;
const TeamAction = actions.TeamAction;

// TODO: add more commands for edge cases
const battleUpdateCommands = new Set(['turn', 'move', 'switch', 'cant', 'teampreview', '-damage']);

/**
 * The base class for all battle agents. Currently only for single player formats.
 */
class Agent {
    /**
     * @param {ObjectReadWriteStream} playerStream
     * @param {boolean} debug
     */
    constructor(playerStream, debug = false) {
        this._stream = playerStream;
        this._currentRequest = null;
        this._receivedBattleUpdate = false;
        this._receivedRequest = false;
        this._battle = new Battle();

        this.log = /** @type {string[]} */ ([]);
        this.debug = debug;

        this._listen();
    }

    /**
     * Listen for incoming messages.
     */
    async _listen() {
        let chunk;
        while ((chunk = await this._stream.read())) {
            this._receive(chunk);
        }
    }

    /**
     * @param {string} chunk
     */
    _receive(chunk) {
        for (const line of chunk.split('\n')) {
            this._receiveLine(line);
        }
        if (this._receivedRequest && this._receivedBattleUpdate) {
            // update battle state
            this._battle.play();
            // reset update flags
            this._receivedBattleUpdate = false;
            this._receivedRequest = false;
            // act
            if (this._currentRequest.wait) return;
            const actionSpace = this._getActionSpace();
            const action = this.act(this._battle, actionSpace, this._currentRequest);
            if (!actionSpace.includes(action)) {
                throw new Error(`invalid action: ${action}`);
            }
            this._choose(action.choice);
        }
    }

    /**
     * @param {string} line
     */
    _receiveLine(line) {
        if (this.debug) console.log(`${line}`.gray);
        if (line.charAt(0) !== '|') return;
        const [cmd, rest] = splitFirst(line.slice(1), '|');
        if (battleUpdateCommands.has(cmd)) {
            this._receivedBattleUpdate = true;
        }
        if (cmd === 'request') {
            if (rest.length !== 0) {
                this._receivedRequest = true;
                this._currentRequest = JSON.parse(rest);
            }
            return;
        } else if (cmd === 'error') {
            throw new Error(rest);
        }
        this._battle.activityQueue.push(line);
        this.log.push(line);
    }

    /**
     * Return a list of all possible actions. Works only for single battles.
     * TODO: adapt for double and triple battles
     *
     * @return {string[]}
     */
    _getActionSpace() {
        const request = this._currentRequest;
        if (request.forceSwitch) {
            const pokemon = request.side.pokemon;
            const switches = [1, 2, 3, 4, 5, 6].filter((i) => (
                // exists
                pokemon[i - 1] &&
                // not active
                !pokemon[i - 1].active &&
                // not fainted
                !pokemon[i - 1].condition.endsWith(' fnt')
            ));
            return switches.map((i) => new SwitchAction(i));
        } else if (request.active) {
            const active = request.active[0];
            const pokemon = request.side.pokemon;
            let actionSpace = [];
            // moves
            const moves = [1, 2, 3, 4].slice(0, active.moves.length).filter((i) => (
                // not disabled
                !active.moves[i - 1].disabled
            ));
            actionSpace.push(...moves.map((i) => new MoveAction(i)));
            // moves + mega evo
            if (active.canMegaEvo) {
                actionSpace.push(...moves.map((i) => new MoveAction(i, {'mega': true})));
            }
            // zmoves
            if (active.canZMove) {
                const zmoves = [1, 2, 3, 4].slice(0, active.canZMove.length).filter((i) =>
                    active.canZMove[i - 1]
                );
                actionSpace.push(...zmoves.map((i) => new MoveAction(i, {'zmove': true})));
            }
            if (!active.trapped) {
                // switches
                const switches = [1, 2, 3, 4, 5, 6].filter((i) => (
                    // exists
                    pokemon[i - 1] &&
                    // not active
                    !pokemon[i - 1].active &&
                    // not fainted
                    !pokemon[i - 1].condition.endsWith(' fnt')
                ));
                actionSpace.push(...switches.map((i) => new SwitchAction(i)));
            }
            return actionSpace;
        } else if (request.teamPreview) {
            // TODO: formats where max team size is limited
            let actionSpace = [];
            const teamSize = request.side.pokemon.length;
            if (teamSize > 6) {
                throw new Error(`team size > 6: ${teamSize}`);
            }
            for (let i = 1; i <= teamSize; i++) {
                let team = [];
                for (let j = 1; j <= teamSize; j++) {
                    if (j == 1) team.push(i);
                    else if (j == i) team.push(1);
                    else team.push(j);
                }
                actionSpace.push(new TeamAction(team.join('')));
            }
            return actionSpace;
        } else if (request.wait) {
            return [];
        }
        return ['default'];
    }

    /**
     * Write a choice to the stream.
     *
     * @param {string} choice
     */
    _choose(choice) {
        this._stream.write(choice);
    }

    /**
     * Choose an action.
     *
     * @param {Battle} battle
     * @param {AnyObject[]} actions
     * @param {Request} info
     */
    act(battle, actions, info) {
        throw new Error('must be overridden by subclass');
    }
}

module.exports = Agent;
