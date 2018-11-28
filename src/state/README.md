# Battle state tracking

While the simulator sends each player messages that correspond to updates
about the battle progress, it does not provide a useful representation of the
current battle state. Hence, we adapt the Pokémon Showdown Client's parsing and
battle representation logic here.

The main files we use are [battle.ts](https://github.com/Zarel/Pokemon-Showdown-Client/blob/master/src/battle.ts), [battle-dex.ts](https://github.com/Zarel/Pokemon-Showdown-Client/blob/master/src/battle-dex.ts),
and [battle-dex-data.ts](https://github.com/Zarel/Pokemon-Showdown-Client/blob/master/src/battle-dex-data.ts).
All of these files have been compiled from TypeScript to JavaScript and then
heavily modified to reduce them to the bare essentials needed to a sufficient
state representation.
