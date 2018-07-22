/**
 * An agent that chooses actions uniformly at random.
 */

'use strict';

const BattleAgent = require('./base-agent')
const _ = require('underscore');

class RandomAgent extends BattleAgent {
	act(battle, actionSpace) {
        return _.sample(actionSpace);
    }
}

module.exports = RandomAgent;
