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
const agent1 = new RandomAgent();

// Player 2 specs
const p2 = {
    name: 'Player 2',
    team: teams['gen7ou'][1],
};
const agent2 = new RandomAgent();

// Init environment
const env = new Environment('gen7ou', p1, p2);

// Main loop
for (let episode = 1; episode <= numEpisodes; episode++) {
    console.log(`-- Episode ${episode} --`);
    var {state1, state2} = env.reset();
    for (let t = 1; t <= maxSteps; t++) {
        // Choose actions
        const action1 = agent1.act(state1, env.getActionSpace('p1'));
        const action2 = agent2.act(state2, env.getActionSpace('p2'));

        // Advance environment
        var {state1, state2, done, info} = env.step(action1, action2);

        if (done) {
            console.log(`Winner: ${info.winner}`);
            console.log(`Turns: ${info.turns}`);
            break;
        }
    }
}

env.close();
