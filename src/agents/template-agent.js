/**
 * An agent with basic state tracking. Intended to serve as a template for
 * future agents.
 */

'use strict';

const Battle = require('../state-tracking/battle')
const BattleStreams = require('../../Pokemon-Showdown/sim/battle-stream');

const utils = require('../../utils/utils');
const randomElem = utils.randomElem;
const splitFirst = utils.splitFirst;

class TemplatePlayerAI extends BattleStreams.BattlePlayer {
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
            this.choose(`default`);
        }
	}

    /**
     * @param {string} line
     */
    receiveLine(line) {
        // console.log(this.log);
        console.log(line);
        // this.battle.run(line);
        if (this.debug) console.log(line);
		if (line.charAt(0) !== '|') return;
		const [cmd, rest] = splitFirst(line.slice(1), '|');
		if (cmd === 'request') {
            // wait until we received more battle information until we act
            // TODO: implement properly
            setTimeout(() => {this.receiveRequest(JSON.parse(rest));}, 10);
            return;
		}
		if (cmd === 'error') {
			throw new Error(rest);
		}
        this.battle.activityQueue.push(line);
		this.log.push(line);
    }
}

module.exports = TemplatePlayerAI;
