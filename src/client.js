'use strict';

require('colors');
const https = require('https');
const url = require('url');
const websocket = require('websocket');
const utils = require('./utils');

const ObjectReadWriteStream = require('../Pokemon-Showdown/lib/streams').ObjectReadWriteStream;
const RandomAgent = require('../examples/agents/random-agent');

const splitFirst = utils.splitFirst;
const toId = utils.toId;

/**
 * @typedef {Object} ClientOptions
 * @property {boolean} [debug]
 * @property {string} actionUrl
 * @property {string} serverUrl
 * @property {string} username
 * @property {string} password
 * @property {number} [avatar]
 */

/**
 * A client that can play on a Pokémon Showdown server.
 */
class Client {
    /**
     * @param {ClientOptions} options
     */
    constructor(options) {
        console.log('-------------------------------');
        console.log('  Pokemon Showdown Bot v0.0.1  ');
        console.log('-------------------------------');

        /** @type {boolean} */
        this.debug = options.debug | false;
        /** @type {string} */
        this.actionUrl = options.actionUrl;
        /** @type {string} */
        this.serverUrl = options.serverUrl;
        /** @type {string} */
        this.username = options.username;
        /** @type {string} */
        this.password = options.password;
        /** @type {number} */
        this.avatar = options.avatar | 0;

        this.connection = null;
        this.ws = null;

        this.battles = {};
    }

    /**
     * Connect to the Pokemon Showdown server.
     */
    connect() {
        // eslint-disable-next-line new-cap
        this.ws = new websocket.client();

        this.ws.on('connectFailed', (error) => {
            console.error('Could not connect to server. ' + error.toString());
        });

        this.ws.on('connect', (connection) => {
            console.log('Connected to server.');
            this.connection = connection;

            connection.on('error', (error) => {
                console.error('Connection error: ' + error.stack);
            });

            connection.on('close', () => {
                console.log('Connection closed.');
            });

            connection.on('message', (message) => {
                if (message.type !== 'utf8' || message.utf8Data.charAt(0) !== 'a') {
                    return false;
                }
                let messageString = message.utf8Data.slice(3, message.utf8Data.length - 2);
                // unescape regex
                messageString = messageString.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                this.receive(messageString);
            });
        });

        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
        let randomId = ~~(Math.random() * 900) + 100;
        let randomString = '';
        for (let i = 0, l = chars.length; i < 8; i++) {
            randomString += chars.charAt(~~(Math.random() * l));
        }
        let connectionUrl = this.serverUrl + randomId + '/' + randomString + '/websocket';
        this.ws.connect(connectionUrl);
    }

    /**
     * Check if the bot is connected to the server.
     *
     * @return {boolean}
     */
    isConnected() {
        return !!this.connection;
    }

    /**
     * Login to an account.
     *
     * @param {string} challId
     * @param {string} challStr
     */
    login(challId, challStr) {
        console.log('Logging in...');

        let requestOptions = {
            hostname: url.parse(this.actionUrl).hostname,
            port: url.parse(this.actionUrl).port,
            path: url.parse(this.actionUrl).pathname,
            agent: false,
        };

        let data = null;
        if (!this.password) {
            requestOptions.method = 'GET';
            // eslint-disable-next-line max-len
            requestOptions.path += `?act=getassertion&userid=${toId(this.username)}&challengekeyid=${toId(challId)}&challenge=${challStr}`;
        } else {
            requestOptions.method = 'POST';
            // eslint-disable-next-line max-len
            data = `act=login&name=${toId(this.username)}&pass=${toId(this.password)}&challengekeyid=${challId}&challenge=${challStr}`;
            requestOptions.headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': data.length,
            };
        }

        let req = https.request(requestOptions, (res) => {
            res.setEncoding('utf8');

            let data = '';
            res.on('data', (d) => {
                data += d;
            });

            res.on('end', () => {
                if (data === ';') {
                    console.error('Failed to log in: Invalid password.');
                } else if (data.length < 50) {
                    console.error('Failed to log in: data.length < 50.');
                } else if (data.indexOf('heavy load') !== -1) {
                    console.error('Failed to log in: The server is under heavy load.');
                } else {
                    let assertion;
                    try {
                        data = JSON.parse(data.substr(1));
                        if (data.actionsuccess) {
                            assertion = data.assertion;
                        } else {
                            console.error('Failed to log in: Action not successful.');
                        }
                    } catch (e) {
                        console.error('Failed to log in: Error parsing data.');
                    }
                    this.sendAssertion(assertion);
                }
            });
        });

        req.on('error', (error) => {
            console.error('Failed to log in: ' + error.stack);
        });

        if (data) {
            req.write(data);
        }
        req.end();
    }

    /**
     * Send a message to the server.
     *
     * @param {string} message
     * @param {string} roomId
     * @return {boolean | null}
     */
    send(message, roomId) {
        if (!message || !this.connection.connected) {
            return false;
        }
        if (!(message instanceof Array)) {
            message = [message.toString()];
        }
        roomId = roomId || '';
        if (this.debug) console.log('>> %s'.green, message);
        this.connection.send(JSON.stringify(roomId + '|' + message));
    }

    /**
     * Handle an incoming message from the server.
     *
	 * @param {string} chunk
	 */
    receive(chunk) {
        const lines = chunk.split('\n');
        let roomId = '';
        if (lines.length !== 0 && lines[0].startsWith('>')) {
            roomId = lines[0].slice(1);
        }
        for (const line of lines) {
            this.receiveLine(line, roomId);
        }
        if (this.battles[roomId] && this.battles[roomId].agent) {
            this.battles[roomId].agent._receive(chunk);
        }
    }

    /**
     * Parse a line of text received from the server.
     *
	 * @param {string} line
     * @param {string} roomId
	 */
    receiveLine(line, roomId) {
        if (line.length <= 1) return;
        if (this.debug) console.log('<< %s'.gray, line);
        if (line.charAt(0) !== '|') return;
        const [cmd, rest] = splitFirst(line.slice(1), '|');
        switch (cmd) {
        case 'challstr':
            const [challId, challStr] = rest.split('|');
            this.login(challId, challStr);
            break;
        case 'init':
            if (rest === 'battle' && !(roomId in this.battles)) {
                let write = (data) => this.choose(data, roomId);
                let stream = new ObjectReadWriteStream({write});
                let agent = new RandomAgent(stream, true);
                this.battles[roomId] = {
                    'stream': stream,
                    'agent': agent,
                };
            }
            break;
        case 'win':
            if (!(roomId in this.battles)) break;
            const winner = rest;
            const outcome = winner === this.username ? 'win' : 'loss';
            console.log(`Outcome: ${outcome}`);
            delete this.battles[roomId];
            break;
        case 'tie':
            if (!(roomId in this.battles)) break;
            console.log('Outcome: tie');
            delete this.battles[roomId];
            break;
        case 'error':
            throw new Error(rest);
        }
    }

    /**
     * @param {string} assertion
     */
    sendAssertion(assertion) {
        this.send('/trn ' + this.username + ',0,' + assertion);
    }

    /**
     * @param {string} team
     */
    useTeam(team) {
        this.send('/useteam ' + team);
    }

    /**
     * @param {string} tier
     */
    searchBattle(tier) {
        this.send('/search ' + tier);
    }

    /**
     * @param {string} username
     * @param {string} tier
     */
    challengeUser(username, tier) {
        this.send('/challenge ' + username + ', ' + tier);
    }

    /**
     * @param {string} user
     */
    acceptChallenge(user) {
        this.send('/accept ' + user);
    }

    /**
     * @param {string} roomId
     */
    setHiddenRoom(roomId) {
        this.send('/hiddenroom', roomId);
    }

    /**
     * @param {string} roomId
     */
    turnTimerOn(roomId) {
        this.send('/timer on', roomId);
    }

    /**
     * @param {string} roomId
     */
    turnTimerOff(roomId) {
        this.send('/timer off', roomId);
    }

    /**
     * @param {string} choices
     * @param {string} roomId
     */
    choose(choices, roomId) {
        this.send('/choose ' + choices, roomId);
    }

    /**
     * @param {string} roomId
     */
    forfeitBattle(roomId) {
        if (!roomId) return;
        this.send('/forfeit', roomId);
    }

    /**
     * @param {string} roomId
     */
    saveReplay(roomId) {
        if (!roomId) return;
        this.send('/savereplay', roomId);
    }
}

module.exports = Client;
