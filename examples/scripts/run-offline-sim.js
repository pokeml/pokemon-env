'use strict';
/**
 * Simulates a Pokémon battle between two bots.
 */

/* eslint no-unused-vars: "off" */

const BattleStreams = require('../../Pokemon-Showdown/sim/battle-stream');
const RandomAgent = require('../agents/random-agent');
const TestAgent = require('../agents/test-agent');
const teams = require('../../data/teams');

const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());

const spec = {
    formatid: 'gen7ou',
};
const p1spec = {
    name: 'Bot 1',
    team: teams['gen7ou'][1],
};
const p2spec = {
    name: 'Bot 2',
    team: teams['gen7ou'][2],
};

const p1 = new RandomAgent(streams.p1);
const p2 = new RandomAgent(streams.p2);

(async () => {
    let chunk;
    while ((chunk = await streams.omniscient.read())) {
        console.log(chunk);
    }
})();

streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}`);
