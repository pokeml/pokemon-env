'use strict';
/**
 * Simulates a Pokémon battle between two bots.
 */

const Battle = require('../Pokemon-Showdown/sim/battle');
const Side = require('./side');
const {MoveAction, SwitchAction, TeamAction} = require('./actions');
const splitFirst = require('./utils').splitFirst;

/**
 * @typedef {Object} PlayerSpec
 * @property {string} name
 * @property {string} team
 */

/**
 * @typedef {Object} Observation
 * @property {Battle} p1State
 * @property {Battle} p2State
 * @property {boolean} done
 * @property {Object} info
 */

/**
 * A gym-like environment that simulates a Pokémon battle between two agents.
 */
class Environment {
    /**
     * @param {string} format
     * @param {PlayerSpec} spec1
     * @param {PlayerSpec} spec2
     * @param {number} [seed]
     */
    constructor(format, spec1, spec2, seed = null) {
        this.format = format;
        this.spec1 = spec1;
        this.spec2 = spec2;
        this.seed = seed;

        this.p1 = null;
        this.p2 = null;
        this.battle = null;
    }

    /**
     * Start a new battle.
     *
     * @return {Observation}
     */
    reset() {
        if (this.p1) this.p1.battle.destroy();
        if (this.p2) this.p2.battle.destroy();
        if (this.battle) this.battle.destroy();

        this.p1 = new Side('p1', this.spec1);
        this.p2 = new Side('p2', this.spec2);

        const battleOptions = {
            formatid: this.format,
            seed: Array(4).fill(this.seed),
            send: (type, data) => {
                if (Array.isArray(data)) data = data.join('\n');
                switch (type) {
                case 'update':
                    /* eslint-disable max-len */
                    const p1Update = data.replace(/\n\|split\n[^\n]*\n([^\n]*)\n[^\n]*\n[^\n]*/g, '\n$1');
                    this.p1.receive(p1Update);
                    const p2Update = data.replace(/\n\|split\n[^\n]*\n[^\n]*\n([^\n]*)\n[^\n]*/g, '\n$1');
                    this.p2.receive(p2Update);
                    // const specUpdate = data.replace(/\n\|split\n([^\n]*)\n[^\n]*\n[^\n]*\n[^\n]*/g, '\n$1');
                    // const omniUpdate = data.replace(/\n\|split\n[^\n]*\n[^\n]*\n[^\n]*/g, '');
                    /* eslint-enable max-len */
                    break;
                case 'sideupdate':
                    const [side, sideData] = splitFirst(data, `\n`);
                    const [cmd, rest] = splitFirst(sideData.slice(1), '|');
                    if (cmd === 'request' && rest.length !== 0) {
                        // store action request
                        (side === 'p1' ? this.p1 : this.p2).request = JSON.parse(rest);
                    } else {
                        // send battle updates to player
                        (side === 'p1' ? this.p1 : this.p2).receive(sideData);
                    }
                    break;
                case 'end':
                    // ignore
                    break;
                }
            },
        };
        const options1 = {
            name: this.p1.name,
            team: this.p1.team,
        };
        const options2 = {
            name: this.p2.name,
            team: this.p2.team,
        };

        this.battle = new Battle(battleOptions);
        this.battle.setPlayer('p1', options1);
        this.battle.setPlayer('p2', options2);
        this.battle.sendUpdates();

        return {
            'state1': this.p1.state,
            'state2': this.p2.state,
        };
    }

    /**
     * Advance the battle by executing actions for both players.
     *
     * @param {Action} action1
     * @param {Action} action2
     *
     * @return {Observation}
     */
    step(action1, action2) {
        if (action1 == null && action2 == null) {
            throw new Error('Must specify at least one action.');
        }

        if (action1) this.battle.choose('p1', action1.choice);
        if (action2) this.battle.choose('p2', action2.choice);

        this.battle.sendUpdates();

        let done = this.battle.ended;
        let info = done ? {
            'turns': this.battle.turn,
            'winner': this.battle.winner,
        } : null;

        return {
            'state1': this.p1.state,
            'state2': this.p2.state,
            'done': done,
            'info': info,
        };
    }

    /**
     * Return a list of all possible actions in the current battle state for the
     * given side. Currently only works for single battles.
     *
     * TODO: adapt for double and triple battles.
     *
     * @param {string} side
     * @return {string[]}
     */
    getActionSpace(side) {
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
     * Clean up the environment.
     */
    close() {
        if (this.p1) this.p1.battle.destroy();
        if (this.p2) this.p2.battle.destroy();
        if (this.battle) this.battle.destroy();
    }
}

module.exports = Environment;
