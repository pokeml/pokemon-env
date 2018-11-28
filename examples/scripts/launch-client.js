'use strict';

const Client = require('../../src/client');
const config = require('../../config/config');

const client = new Client(config);
client.connect();

setTimeout(() => {
    client.searchBattle('gen7randombattle');
}, 2000);
