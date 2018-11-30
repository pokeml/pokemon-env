'use strict';

const Battle = require('../Pokemon-Showdown/sim/battle');
const {Action, MoveAction, SwitchAction, TeamAction} = require('./actions');
const splitFirst = require('./utils').splitFirst;

/**
 * @typedef {Object} PlayerSpec
 * @property {string} name
 * @property {string} team
 */

/**
 * @typedef {Object} Player
 * @property {Object} observation
 * @property {Object} request
 */

/**
 * A gym-like environment that simulates a Pokémon battle between two agents.
 */
class PokemonEnv {
    /**
     * @param {string} format
     * @param {PlayerSpec} p1Spec
     * @param {PlayerSpec} p2Spec
     * @param {number} [seed]
     */
    constructor(format, p1Spec, p2Spec, seed = null) {
        this.format = format;
        this.p1Spec = p1Spec;
        this.p2Spec = p2Spec;
        this.seed = seed;

        this.battle = /** @type {Battle} */ null;
        this.p1 = /** @type {Player} */ {};
        this.p2 = /** @type {Player} */ {};
    }

    /**
     * Get the action space for the current battle state, which includes both player's spaces.
     *
     * @return {Array}
     */
    get actionSpace() {
        return [
            this._getActionSpace('p1'),
            this._getActionSpace('p2'),
        ];
    }

    /**
     * Start a new battle.
     *
     * @return {Observation}
     */
    reset() {
        // destroy battle
        if (this.battle) this.battle.destroy();

        // reset players
        this.p1 = {'observation': [], 'request': null};
        this.p2 = {'observation': [], 'request': null};

        // create new battle
        const battleOptions = {
            formatid: this.format,
            seed: this.seed ? Array(4).fill(this.seed) : null,
            send: (type, data) => this._receiveBattleUpdate(type, data),
        };
        const p1Options = {
            name: this.p1.name,
            team: this.p1.team,
        };
        const p2Options = {
            name: this.p2.name,
            team: this.p2.team,
        };

        this.battle = new Battle(battleOptions);
        this.battle.setPlayer('p1', p1Options);
        this.battle.setPlayer('p2', p2Options);
        this.battle.sendUpdates();

        return this._getObservations();
    }

    /**
     * Advance the battle by executing actions for both players.
     *
     * @param {Action[]} actions
     * @return {Object}
     */
    step(actions) {
        // error handling
        if (!Array.isArray(actions) || actions.length !== 2) {
            throw new Error('Must provide an array of two actions.');
        }
        if (!(actions[0] instanceof Action) && !(actions[1] instanceof Action)) {
            throw new Error('Must specify at least one valid action.');
        }

        // advance simulator
        if (actions[0]) this.battle.choose('p1', actions[0].choice);
        if (actions[1]) this.battle.choose('p2', actions[1].choice);

        this.battle.sendUpdates();

        return {
            'observations': this._getObservations(),
            'rewards': this._getRewards(),
            'done': this._isDone(),
            'info': this._getInfo(),
        };
    }

    /**
     * Get the observations for both players.
     *
     * @return {Array}
     */
    _getObservations() {
        const observations = [
            this.p1.observation.join('\n'),
            this.p2.observation.join('\n'),
        ];
        this.p1.observation = [];
        this.p2.observation = [];
        return observations;
    }

    /**
     * Get the rewards for both players.
     *
     * @return {Array}
     */
    _getRewards() {
        let rewards = [0, 0];
        if (this.battle.ended && this.battle.winner) {
            rewards = this.battle.winner === this.battle.p1.name ? [1, -1] : [-1, 1];
        }
        return rewards;
    }

    /**
     * Check if the battle is done.
     *
     * @return {boolean}
     */
    _isDone() {
        return this.battle.ended;
    }

    /**
     * @return {?Object}
     */
    _getInfo() {
        return null;
    }

    /**
     * Return a list of all possible actions in the current battle state for the
     * given side. Currently only works for single battles.
     *
     * TODO: adapt for double and triple battles.
     *
     * @param {'p1' | 'p2'} side
     * @return {string[]}
     */
    _getActionSpace(side) {
        if (side !== 'p1' && side !== 'p2') {
            throw new Error(`Cannot get action space for side: ${side}`);
        }
        const request = (side === 'p1' ? this.p1 : this.p2).request;
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
            // switches
            if (!active.trapped) {
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
        } else {
            // wait request
            return [];
        }
    }

    /**
     * Handle update messages from the battle simulator.
     *
     * @param {string} type
     * @param {Array | string} data
     */
    _receiveBattleUpdate(type, data) {
        if (Array.isArray(data)) data = data.join('\n');
        switch (type) {
        case 'update':
            /* eslint-disable max-len */
            const p1Update = data.replace(/\n\|split\n[^\n]*\n([^\n]*)\n[^\n]*\n[^\n]*/g, '\n$1');
            const p2Update = data.replace(/\n\|split\n[^\n]*\n[^\n]*\n([^\n]*)\n[^\n]*/g, '\n$1');
            // const specUpdate = data.replace(/\n\|split\n([^\n]*)\n[^\n]*\n[^\n]*\n[^\n]*/g, '\n$1');
            // const omniUpdate = data.replace(/\n\|split\n[^\n]*\n[^\n]*\n[^\n]*/g, '');
            this.p1.observation.push(p1Update);
            this.p2.observation.push(p2Update);
            /* eslint-enable max-len */
            break;
        case 'sideupdate':
            const [side, sideData] = splitFirst(data, `\n`);
            const [cmd, rest] = splitFirst(sideData.slice(1), '|');
            if (cmd === 'request' && rest.length !== 0) {
                // store action request
                (side === 'p1' ? this.p1 : this.p2).request = JSON.parse(rest);
            } else if (cmd === 'callback') {
                const [type, ...args] = rest.split('|');
                switch (type) {
                case 'trapped':
                    this[side].request.active[0].trapped = true;
                    break;
                case 'cant':
                    const moves = this[side].request.active[0].moves;
                    for (let i = 0; i < moves.length; i++) {
                        if (moves[i].id === args[2]) {
                            moves[i].disabled = true;
                        }
                    }
                    break;
                }
            }
            this[side].observation.push(sideData);
            break;
        case 'end':
            // ignore
            break;
        }
    }

    /**
     * Display the current battle state.
     */
    render() {
        throw new Error('Not implemented.');
    }

    /**
     * Clean up the environment.
     */
    close() {
        if (this.battle) this.battle.destroy();
    }
}

module.exports = PokemonEnv;
