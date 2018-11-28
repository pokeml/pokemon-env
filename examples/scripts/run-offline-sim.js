'use strict';

const Environment = require('../../src/env');
const RandomAgent = require('../agents/random-agent');
const teams = require('../../data/teams');

// Parameters
const numEpisodes = 10;
const maxSteps = 1000;

// Player 1 specs
const p1 = {
    name: 'Player 1',
    team: teams['gen7ou'][0],
};
let p1Agent = new RandomAgent();

// Player 2 specs
const p2 = {
    name: 'Player 2',
    team: teams['gen7ou'][1],
};
let p2Agent = new RandomAgent();

// Init environment
let env = new Environment('gen7ou', p1, p2);

// Main loop
for (let episode = 1; episode <= numEpisodes; episode++) {
    console.log(`Episode ${episode}`);
    var {p1State, p2State} = env.reset();
    for (let t = 1; t <= maxSteps; t++) {
        // Choose actions
        let p1Action = p1Agent.act(p1State, env.getActionSpace('p1'));
        let p2Action = p2Agent.act(p2State, env.getActionSpace('p2'));

        // Advance environment
        var {p1State, p2State, done, info} = env.step(p1Action, p2Action);

        if (done) {
            console.log(`Winner: ${info.winner}`);
            console.log(`Turns: ${info.turns}`);
            break;
        }
    }
}

env.close();
