/**
 * The simplest possible agent. Always chooses the default option.
 */

'use strict';

const BattleStreams = require('../../Pokemon-Showdown/sim/battle-stream');

class SimplePlayerAI extends BattleStreams.BattlePlayer {
	/**
	 * @param {AnyObject} request
	 */
	receiveRequest(request) {
        if (!request.wait) {
            this.choose(`default`);
        }
	}
}

module.exports = SimplePlayerAI;
