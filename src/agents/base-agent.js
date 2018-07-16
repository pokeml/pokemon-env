/**
 * An agent with basic state tracking. Intended to serve as a basis for
 * future agents.
 */

'use strict';

const colors = require('colors');

const Battle = require('../state-tracking/battle')
const BattleStreams = require('../../Pokemon-Showdown/sim/battle-stream');

const utils = require('../../utils/utils');
const randomElem = utils.randomElem;
const splitFirst = utils.splitFirst;

class BasePlayerAI extends BattleStreams.BattlePlayer {
    /**
	 * @param {ObjectReadWriteStream} playerStream
	 */
	constructor(playerStream, debug = false) {
		super(playerStream, debug);
        this.battle = new Battle(null, null);
	}

	/**
     * @param {AnyObject} request
	 */
	receiveRequest(request) {
        this.battle.play();
        if (!request.wait) {
            console.log(`Currently on turn ${this.battle.turn}`);
            this.choose(`default`);
        }
	}

    /**
     * @param {string} line
     */
    receiveLine(line) {
		if (line.charAt(0) !== '|') return;
		const [cmd, rest] = splitFirst(line.slice(1), '|');
		if (cmd === 'request') {
            // wait until we received more battle information until we act
            // TODO: implement properly with callbacks
            setTimeout(() => {this.receiveRequest(JSON.parse(rest));}, 25);
            return;
		}
		else if (cmd === 'error') {
			throw new Error(rest);
		}
        this.battle.activityQueue.push(line);
		this.log.push(line);
        if (this.debug) console.log(`${line}`.gray);
    }
}

module.exports = BasePlayerAI;
