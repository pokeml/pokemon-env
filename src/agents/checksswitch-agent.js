'use strict';

const BattleAgent = require('./base-agent');
const _ = require('underscore');
var checks = require('../../data/checks.json')

/**
 * An agent that chooses actions based on checks.json
 */
class ChecksSwitchAgent extends BattleAgent {
    /**
     * Choose an action.
     *
     * @param {AnyObject} battle
     * @param {string[]} actions
     * @param {AnyObject} info
     * @return {string}
     */
    act(battle, actions, info) {
        const action = _.sample(actions);
        console.log(`>>CS Agent: ${action}`);
        console.log(checks['keldeo']);
        return action;
    }
}

module.exports = ChecksSwitchAgent;
