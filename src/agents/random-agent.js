'use strict';

const BattleAgent = require('./base-agent');
const _ = require('underscore');

/**
 * An agent that chooses actions uniformly at random.
 */
class RandomAgent extends BattleAgent {
    /**
     * Choose an action.
     *
     * @param {AnyObject} battle
     * @param {string[]} actions
     * @param {AnyObject} info
     * @return {string}
     */
    act(battle, actions, info) {
        return _.sample(actions);
    }
}

module.exports = RandomAgent;
