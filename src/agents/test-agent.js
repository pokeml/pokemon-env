'use strict';

const BattleAgent = require('./base-agent');
const _ = require('underscore');

/**
 * An agent for testing purposes.
 */
class TestAgent extends BattleAgent {
    /**
     * Choose an action.
     *
     * @param {AnyObject} battle
     * @param {string[]} actions
     * @param {AnyObject} info
     * @return {string}
     */
    act(battle, actions, info) {
        if (this.debug) {
            console.log(`turn: ${battle.turn}`);
            console.log(`action space: ${actions.join(', ')}`);
        }
        const action = _.sample(actions);
        if (this.debug) console.log(`>> ${action}`);
        return action;
    }
}

module.exports = TestAgent;
