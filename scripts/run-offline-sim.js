/**
 * Simulates a Pokémon battle between two bots.
 */

'use strict';

const BattleStreams = require('../Pokemon-Showdown/sim/battle-stream');
// const RandomAgent = require('../src/agents/random-agent');
// const TestAgent = require('../src/agents/test-agent');
const ChecksSwitchAgent = require('../src/agents/checksswitch-agent');
// const teams = require('../data/teams');

// get 2v2 team
const teams2v2 = require('../data/teams2v2');

const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());

const spec = {
    formatid: 'gen7ou',
};
// offense bot
const p1spec = {
    name: 'Bot 1',
    team: teams2v2['gen7ou'][0],
};
// stall bot
const p2spec = {
    name: 'Bot 2',
    team: teams2v2['gen7ou'][1],
};

console.log(p1spec);
console.log(p2spec);
// eslint-disable-next-line no-unused-vars
const p1 = new ChecksSwitchAgent(streams.p1, true);
// eslint-disable-next-line no-unused-vars
const p2 = new ChecksSwitchAgent(streams.p2);

// (async () => {
// 	let chunk;
// 	while ((chunk = await streams.omniscient.read())) {
// 		console.log(chunk);
// 	}
// })();

streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}`);
