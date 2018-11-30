'use strict';

require('colors');

const PokemonEnv = require('../src/env');
const RandomAgent = require('./random-agent');
const teams = require('../data/teams');

// parameters
const numEpisodes = 100;
const maxSteps = 1000;

// agents
const p1Agent = new RandomAgent();
const p2Agent = new RandomAgent();

// player specs
const p1Spec = {name: 'Player 1', team: teams[0]};
const p2Spec = {name: 'Player 2', team: teams[1]};

// init environment
const env = new PokemonEnv('gen7randombattle', p1Spec, p2Spec);

// main loop
for (let episode = 1; episode <= numEpisodes; episode++) {
    console.log(`Episode ${episode}`);

    // reset environment
    let observations = env.reset();
    let rewards = [0, 0];
    let done = false;

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

        console.log(`Time step: ${t}`);
        console.log(`${observations[0]}`.gray);

        if (done) {
            console.log(`p1 reward: ${rewards[0]}`);
            console.log(`p2 reward: ${rewards[1]}`);
            break;
        }
    }
}

env.close();
