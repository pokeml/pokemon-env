'use strict';

const BattleAgent = require('../base/agent');
const _ = require('underscore');

/**
 * An agent that chooses actions uniformly at random.
 */
class RandomAgent extends BattleAgent {
    /**
     * Choose an action.
     *
     * @param {State} state
     * @param {Action[]} actions
     * @param {Request} info
     * @return {string}
     */
    act(state, actions, info) {
        return _.sample(actions);
    }
}

module.exports = RandomAgent;
