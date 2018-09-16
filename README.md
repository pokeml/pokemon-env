[![Build Status](https://travis-ci.com/pokeml/pokemon-battle-ai.svg?branch=master)](https://travis-ci.com/pokeml/pokemon-battle-ai)

# Pokémon Battle AI

This project is an attempt to build a strong Pokémon AI. Check out our [wiki](https://github.com/pokeml/pokemon-battle-ai/wiki) for more info.

## Getting Started

### Installing

To clone this project and Pokemon Showdown as a submodule, simply run

```bash
git clone --recurse-submodules https://github.com/pokeml/pokemon-battle-ai.git
```

This project requires [Node.js](https://nodejs.org/) 8.x or later. From within the project's root directory, run

```bash
npm install
```

to install the necessary dependencies.

### Running

To simulate a battle between two agents, run

```bash
node scripts/run-offline-sim.js
```

and to test an agent on the Pokémon Showdown server online against human players, run

```bash
node scripts/launch-client.js
```

from the project's root directory.

### Contributing

Check out our [projects page](https://github.com/pokeml/pokemon-battle-ai/projects) for getting ideas how you can contribute. Click on the different projects to see the tasks that still need to be done.
