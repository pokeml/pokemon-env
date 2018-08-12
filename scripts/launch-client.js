'use strict';

const Client = require('../src/online-interface/client');
const config = require('../config/config');

const client = new Client(config);
client.connect();
