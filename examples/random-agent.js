'use strict';

const _ = require('underscore');

/**
 * An agent that chooses actions uniformly at random.
 */
class RandomAgent {
    /**
     * Choose an action at random.
     *
     * @param {Array} actionSpace
     * @return {Action}
     */
    act(actionSpace) {
        return _.sample(actionSpace);
    }
}

module.exports = RandomAgent;
