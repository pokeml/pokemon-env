'use strict';

/* eslint-disable no-unused-vars */

require('colors');
const _ = require('underscore');

const PokemonEnv = require('../src/env');
const teams = require('../data/teams');

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

// parameters
const numEpisodes = 10;
const maxSteps = 1000;

// agents
const p1Agent = new RandomAgent();
const p2Agent = new RandomAgent();

// player specs
const p1Spec = {name: 'Player 1', team: teams[0]};
const p2Spec = {name: 'Player 2', team: teams[1]};

// init environment
const env = new PokemonEnv('gen7ou', p1Spec, p2Spec);

// main loop
for (let episode = 1; episode <= numEpisodes; episode++) {
    console.log(`Episode ${episode}`);

    // reset environment
    let observations = env.reset();
    let rewards = [0, 0];
    let done = false;

    // show observation
    console.log('Time step: 0');
    console.log(`${observations[0]}`.gray);

    for (let t = 1; t <= maxSteps; t++) {
        // choose actions
        const actions = [
            p1Agent.act(env.actionSpace[0]),
            p2Agent.act(env.actionSpace[1]),
        ];

        // advance environment
        ({observations, rewards, done} = env.step(actions));

        // show observation
        console.log(`Time step: ${t}`);
        console.log(`${observations[0]}`.gray);

        if (done) {
            break;
        }
    }
}

env.close();
