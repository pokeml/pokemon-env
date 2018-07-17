/**
 * An agent with basic state tracking. Intended to serve as a basis for
 * developing smart agents.
 */

'use strict';

const colors = require('colors');

const Battle = require('../state-tracking/battle')
const BattleStreams = require('../../Pokemon-Showdown/sim/battle-stream');

const utils = require('../../utils/utils');
const splitFirst = utils.splitFirst;

class BasePlayerAI extends BattleStreams.BattlePlayer {
    /**
	 * @param {ObjectReadWriteStream} playerStream
	 */
	constructor(playerStream, debug = false) {
		super(playerStream, debug);
        this.battle = new Battle();
	}

	/**
     * Choose an action given a request.
     *
     * @param {AnyObject} request
	 */
	receiveRequest(request) {
        this.battle.play();
        if (!request.wait) {
            if (this.debug)
                this.displayBattleState();
            this.choose(`default`);
        }
	}

    /**
     * Receive an observation.
     *
     * @param {string} line
     */
    receiveLine(line) {
        if (this.debug) console.log(`${line}`.gray);
		if (line.charAt(0) !== '|') return;
		const [cmd, rest] = splitFirst(line.slice(1), '|');
		if (cmd === 'request') {
            // wait until we received more battle information until we act
            // TODO: implement properly with callbacks
            setTimeout(() => {this.receiveRequest(JSON.parse(rest));}, 50);
		}
		else if (cmd === 'error') {
			throw new Error(rest);
		}
        this.battle.activityQueue.push(line);
		this.log.push(line);
    }

    /**
     * Display a brief summary of the current battle state in the console.
     */
    displayBattleState() {
        // Battle info
        console.log(`Turn ${this.battle.turn}`);
        if (this.battle.weather)
            console.log(`Weather: ${this.battle.weather}`);
        if (this.battle.pseudoWeather && this.battle.pseudoWeather.length)
            console.log(`Pseudo weather: ${this.battle.pseudoWeather}`);
        console.log('---');
        // Own side info
        if (this.battle.mySide.sideCondition)
            console.log(this.battle.mySide.sideCondition);
        this.battle.mySide.pokemon.map(poke => {
            console.log(poke.name + ' ' + poke.hp + '/' + poke.maxhp +
                (poke.status ? (' ' + poke.status) : '') +
                (poke.isActive() ? ' active' : ''));
        });
        console.log('---');
        // Opponent side info
        if (this.battle.yourSide.sideCondition)
            console.log(this.battle.yourSide.sideCondition);
        this.battle.yourSide.pokemon.map(poke => {
            console.log(poke.name + ' ' + poke.hp + '/' + poke.maxhp +
                (poke.status ? (' ' + poke.status) : '') +
                (poke.isActive() ? ' active' : ''));
        });
    }
}

module.exports = BasePlayerAI;
