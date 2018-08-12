'use strict';

const Client = require('../src/online-interface/client');
const config = require('../config/config');

/**
 * Execute actions after connecting to server.
 */
function connectCallback() {
    client.searchBattle('gen7randombattle');
}

const client = new Client(config, connectCallback);
client.connect();
