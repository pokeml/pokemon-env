/**
 * An agent that chooses actions uniformly at random.
 */

'use strict';

const BattleAgent = require('./base-agent')
const _ = require('underscore');

class RandomAgent extends BattleAgent {
	act(battle, actionSpace) {
        if (this.debug) console.log(`action space: ${actionSpace.join(', ')}`);
        const action = _.sample(actionSpace);
        if (this.debug) console.log(`>> ${action}`);
        return action;
    }
}

module.exports = RandomAgent;
