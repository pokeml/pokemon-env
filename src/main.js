/**
 * Simulates a Pokémon battle between two bots.
 */

'use strict';

const BattleStreams = require('../Pokemon-Showdown/sim/battle-stream');
const Dex = require('../Pokemon-Showdown/sim/dex');
const RandomPlayerAI = require('./agents/random-agent')
const SimplePlayerAI = require('./agents/simple-agent')
const BasePlayerAI = require('./agents/base-agent')

const teams = require('../data/teams')

const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());

const spec = {
	formatid: "gen7ou" // "gen7customgame"
};
const p1spec = {
	name: "Bot 1",
	team: teams['gen7ou'][0] // Dex.packTeam(Dex.generateTeam('gen7randombattle'))
};
const p2spec = {
	name: "Bot 2",
	team: teams['gen7ou'][1] // Dex.packTeam(Dex.generateTeam('gen7randombattle'))
};

const p1 = new BasePlayerAI(streams.p1, true);
const p2 = new RandomPlayerAI(streams.p2);

// (async () => {
// 	let chunk;
// 	while ((chunk = await streams.omniscient.read())) {
// 		console.log(chunk);
// 	}
// })();

streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}`);
