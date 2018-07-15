/**
 * Simulates a Pokémon battle between two bots.
 */

'use strict';

const BattleStreams = require('./Pokemon-Showdown/sim/battle-stream');
const Dex = require('./Pokemon-Showdown/sim/dex');
const RandomPlayerAI = require('./agents/random-agent.js')
const teams = require('./data/teams')

const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());

const spec = {
	formatid: "gen7ou",
};
const p1spec = {
	name: "Bot 1",
	team: teams['gen7ou'][0],
};
const p2spec = {
	name: "Bot 2",
	team: teams['gen7ou'][1],
};

const p1 = new RandomPlayerAI(streams.p1);
const p2 = new RandomPlayerAI(streams.p2);

(async () => {
	let chunk;
	while ((chunk = await streams.omniscient.read())) {
		console.log(chunk);
	}
})();

streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}`);
