'use strict';

/**
 * The base class for all battle agents. Currently only for single player formats.
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
