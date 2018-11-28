# Agents

Each agent should inherit from the `Agent` class provided by
[agent.js](../base/agent.js). This will require it to implement a function `act`
that takes three parameters:

* `state`: A description of the current state of the battle.
* `actions`: A list of possible actions.
* `info`: Additional information about the action request.

A simple implementation of a random agent can be found in [random-agent.js](random-agent.js).
