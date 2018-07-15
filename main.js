/**
 * Simulates a Pokémon battle between two bots.
 */

'use strict';

const BattleStreams = require('./Pokemon-Showdown/sim/battle-stream');
const Dex = require('./Pokemon-Showdown/sim/dex');
const RandomPlayerAI = require('./agents/random-agent.js')

const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());

const spec = {
	formatid: "gen7customgame",
};
const p1spec = {
	name: "Bot 1",
	team: Dex.packTeam(Dex.generateTeam('gen7randombattle')),
};
const p2spec = {
	name: "Bot 2",
	team: Dex.packTeam(Dex.generateTeam('gen7randombattle')),
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
