/**
 * An agent with basic state tracking. Intended to serve as a template for
 * future agents.
 */

'use strict';

const BattleStreams = require('../../Pokemon-Showdown/sim/battle-stream');

/**
 * @param {number[]} array
 */
function randomElem(array) {
	return array[Math.floor(Math.random() * array.length)];
}

class TemplatePlayerAI extends BattleStreams.BattlePlayer {
    /**
	 * @param {ObjectReadWriteStream} playerStream
	 */
	constructor(playerStream, debug = false) {
		super(playerStream, debug);
	}

	/**
     * @param {AnyObject} request
	 */
	receiveRequest(request) {
        if (!request.wait) {
            this.choose(`default`);
        }
	}

    /**
     * @param {string} line
     */
    receiveLine(line) {
		super.receiveLine(line);
    }
}

module.exports = TemplatePlayerAI;
