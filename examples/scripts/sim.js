'use strict';

const Environment = require('../../src/env');
const RandomAgent = require('../agents/random-agent');

const teams = require('../../data/teams');

// parameters
const numEpisodes = 10;
const maxSteps = 1000;

// agents
const p1Agent = new RandomAgent();
const p2Agent = new RandomAgent();

// player specs
const p1Spec = {name: 'Player 1', team: teams['gen7ou'][0]};
const p2Spec = {name: 'Player 2', team: teams['gen7ou'][1]};

// init environment
const env = new Environment('gen7ou', p1Spec, p2Spec);

// main loop
for (let episode = 1; episode <= numEpisodes; episode++) {
    console.log(`Episode ${episode}`);
    var states = env.reset();
    for (let t = 1; t <= maxSteps; t++) {
        // choose actions
        const actions = [
            p1Agent.act(states[0], env.actionSpace[0]),
            p2Agent.act(states[1], env.actionSpace[1]),
        ];

        // advance environment
        var {states, rewards, done} = env.step(actions);

        console.log(states[0]);

        if (done) {
            console.log(`p1 reward: ${rewards[0]}`);
            console.log(`p2 reward: ${rewards[1]}`);
            break;
        }
    }
}

env.close();
