[![Build Status](https://travis-ci.com/pokeml/pokemon-env.svg?branch=master)](https://travis-ci.com/pokeml/pokemon-env)

# Pokémon Environment

This project is an environment built for the development of Pokémon battle agents, based on the [Pokémon Showdown](https://github.com/Zarel/Pokemon-Showdown) simulator. Check out our [wiki](https://github.com/pokeml/pokemon-env/wiki) for more info.

## Getting Started

### Installing

To clone this project and Pokémon Showdown as a submodule, simply run

```bash
git clone --recurse-submodules https://github.com/pokeml/pokemon-env.git
```

This project requires [Node.js](https://nodejs.org/) 8.x or later. From within the project's root directory, run

```bash
npm install
```

to install the necessary dependencies.

### Running

For an example of how to simulate a battle between two agents, run

```bash
node examples/scripts/run-offline-sim.js
```

and to test an agent on the Pokémon Showdown server online against human players, run

```bash
node examples/scripts/launch-client.js
```

from the project's root directory.

### Contributing

Check out our [projects page](https://github.com/pokeml/pokemon-env/projects) for getting ideas how you can contribute. Click on the different projects to see the tasks that still need to be done.
