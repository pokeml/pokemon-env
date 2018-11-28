'use strict';

/**
 * The base class for all battle agents.
 */
class Agent {
    /**
     * Choose an action.
     *
     * @param {State} state
     * @param {Action[]} actions
     */
    act(state, actions) {
        throw new Error('must be overridden by subclass');
    }
}

module.exports = Agent;
