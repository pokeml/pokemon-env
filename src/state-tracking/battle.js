/* eslint require-jsdoc: "off" */

/**
 * Pokemon Showdown Battle
 *
 * This is the main file for handling battle animations
 *
 * Licensing note: PS's client has complicated licensing:
 * - The client as a whole is AGPLv3
 * - The battle replay/animation engine (battle-*.ts) by itself is MIT
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */

const BattleItems = require('../../Pokemon-Showdown/data/items').BattleItems;
const BattlePokedex = require('../../Pokemon-Showdown/data/pokedex').BattlePokedex;
const Tools = require('./battle-dex');
const BattleDexData = require('./battle-dex-data');
const BattleStats = BattleDexData.BattleStats;

class Pokemon {
    constructor(data, side) {
        this.name = '';
        this.species = '';
        /**
         * A string representing information extractable from textual
         * messages: side, nickname.
         *
         * Will be the empty string between Team Preview and the first
         * switch-in.
         *
         * Examples: `p1: Unown` or `p2: Sparky`
         */
        this.ident = '';
        /**
         * A string representing visible information not included in
         * ident: species, level, gender, shininess. Level is left off
         * if it's 100; gender is left off if it's genderless.
         *
         * Note: Can be partially filled out in Team Preview, because certain
         * forme information and shininess isn't visible there. In those
         * cases, details can change during the first switch-in, but will
         * otherwise not change over the course of a game.
         *
         * Examples: `Mimikyu, L50, F`, `Steelix, M, shiny`
         */
        this.details = '';
        /**
         * `` `${ident}|${details}` ``. Tracked for ease of searching.
         *
         * As with ident and details, will only change during the first
         * switch-in.
         */
        this.searchid = '';
        this.slot = 0;
        this.fainted = false;
        this.hp = 0;
        this.maxhp = 1000;
        this.level = 100;
        this.gender = '';
        this.shiny = false;
        this.hpcolor = 'g';
        this.moves = [];
        this.ability = '';
        this.baseAbility = '';
        this.item = '';
        this.itemEffect = '';
        this.prevItem = '';
        this.prevItemEffect = '';
        this.boosts = {};
        this.status = '';
        this.statusStage = 0;
        this.volatiles = {};
        this.turnstatuses = {};
        this.movestatuses = {};
        this.weightkg = 0;
        this.lastMove = '';
        /** [[moveName, ppUsed]] */
        this.moveTrack = [];
        this.statusData = {sleepTurns: 0, toxicTurns: 0};
        this.side = side;
        this.species = data.species;
        // TODO: stop doing this
        Object.assign(this, Tools.getTemplate(data.species));
        Object.assign(this, data);
    }
    isActive() {
        return this.side.active.includes(this);
    }
    getPixelRange(pixels, color) {
        let epsilon = 0.5 / 714;
        if (pixels === 0) {
            return [0, 0];
        }
        if (pixels === 1) {
            return [0 + epsilon, 2 / 48 - epsilon];
        }
        if (pixels === 9) {
            if (color === 'y') { // ratio is > 0.2
                return [0.2 + epsilon, 10 / 48 - epsilon];
            } else { // ratio is <= 0.2
                return [9 / 48, 0.2];
            }
        }
        if (pixels === 24) {
            if (color === 'g') { // ratio is > 0.5
                return [0.5 + epsilon, 25 / 48 - epsilon];
            } else { // ratio is exactly 0.5
                return [0.5, 0.5];
            }
        }
        if (pixels === 48) {
            return [1, 1];
        }
        return [pixels / 48, (pixels + 1) / 48 - epsilon];
    }
    getFormattedRange(range, precision, separator) {
        if (range[0] === range[1]) {
            let percentage = Math.abs(range[0] * 100);
            if (Math.floor(percentage) === percentage) {
                return percentage + '%';
            }
            return percentage.toFixed(precision) + '%';
        }
        let lower; let upper;
        if (precision === 0) {
            lower = Math.floor(range[0] * 100);
            upper = Math.ceil(range[1] * 100);
        } else {
            lower = (range[0] * 100).toFixed(precision);
            upper = (range[1] * 100).toFixed(precision);
        }
        return lower + separator + upper + '%';
    }
    // Returns [min, max] damage dealt as a proportion of total HP from 0 to 1
    getDamageRange(damage) {
        if (damage[1] !== 48) {
            let ratio = damage[0] / damage[1];
            return [ratio, ratio];
        } else if (damage.length === undefined) {
            // wrong pixel damage.
            // this case exists for backward compatibility only.
            return [damage[2] / 100, damage[2] / 100];
        }
        // pixel damage
        let oldrange = this.getPixelRange(damage[3], damage[4]);
        let newrange = this.getPixelRange(damage[3] + damage[0], this.hpcolor);
        if (damage[0] === 0) {
            // no change in displayed pixel width
            return [0, newrange[1] - newrange[0]];
        }
        if (oldrange[0] < newrange[0]) { // swap order
            let r = oldrange;
            oldrange = newrange;
            newrange = r;
        }
        return [oldrange[0] - newrange[1], oldrange[1] - newrange[0]];
    }
    healthParse(hpstring, parsedamage, heal) {
        // returns [delta, denominator, percent(, oldnum, oldcolor)] or null
        if (!hpstring || !hpstring.length) {
            return null;
        }
        let parenIndex = hpstring.lastIndexOf('(');
        if (parenIndex >= 0) {
            // old style damage and health reporting
            if (parsedamage) {
                let damage = parseFloat(hpstring);
                // unusual check preseved for backward compatbility
                if (isNaN(damage)) {
                    damage = 50;
                }
                if (heal) {
                    this.hp += this.maxhp * damage / 100;
                    if (this.hp > this.maxhp) {
                        this.hp = this.maxhp;
                    }
                } else {
                    this.hp -= this.maxhp * damage / 100;
                }
                // parse the absolute health information
                let ret = this.healthParse(hpstring);
                if (ret && (ret[1] === 100)) {
                    // support for old replays with nearest-100th damage and health
                    return [damage, 100, damage];
                }
                // complicated expressions preserved for backward compatibility
                let percent = Math.round(Math.ceil(damage * 48 / 100) / 48 * 100);
                let pixels = Math.ceil(damage * 48 / 100);
                return [pixels, 48, percent];
            }
            if (hpstring.substr(hpstring.length - 1) !== ')') {
                return null;
            }
            hpstring = hpstring.substr(parenIndex + 1, hpstring.length - parenIndex - 2);
        }
        let oldhp = this.fainted ? 0 : (this.hp || 1);
        let oldmaxhp = this.maxhp;
        let oldwidth = this.hpWidth(100);
        let oldcolor = this.hpcolor;
        this.side.battle.parseHealth(hpstring, this);
        if (oldmaxhp === 0) { // max hp not known before parsing this message
            oldmaxhp = oldhp = this.maxhp;
        }
        let oldnum = oldhp ? (Math.floor(oldhp / oldmaxhp * this.maxhp) || 1) : 0;
        let delta = this.hp - oldnum;
        let deltawidth = this.hpWidth(100) - oldwidth;
        return [delta, this.maxhp, deltawidth, oldnum, oldcolor];
    }
    checkDetails(details) {
        if (!details) {
            return false;
        }
        if (details === this.details) {
            return true;
        }
        if (this.searchid) {
            return false;
        }
        if (details.indexOf(', shiny') >= 0) {
            if (this.checkDetails(details.replace(', shiny', ''))) {
                return true;
            }
        }
        // the actual forme was hidden on Team Preview
        details = details.replace(/(-[A-Za-z0-9]+)?(, |$)/, '-*$2');
        return (details === this.details);
    }
    getIdent() {
        let slots = ['a', 'b', 'c', 'd', 'e', 'f'];
        return this.ident.substr(0, 2) + slots[this.slot] + this.ident.substr(2);
    }
    removeVolatile(volatile) {
        if (!this.hasVolatile(volatile)) {
            return;
        }
        delete this.volatiles[volatile];
    }
    addVolatile(volatile, ...args) {
        if (this.hasVolatile(volatile) && !args.length) {
            return;
        }
        this.volatiles[volatile] = [volatile, ...args];
    }
    hasVolatile(volatile) {
        return !!this.volatiles[volatile];
    }
    removeTurnstatus(volatile) {
        if (!this.hasTurnstatus(volatile)) {
            return;
        }
        delete this.turnstatuses[volatile];
    }
    addTurnstatus(volatile) {
        volatile = toId(volatile);
        if (this.hasTurnstatus(volatile)) {
            return;
        }
        this.turnstatuses[volatile] = [volatile];
    }
    hasTurnstatus(volatile) {
        return !!this.turnstatuses[volatile];
    }
    clearTurnstatuses() {
        // eslint-disable-next-line guard-for-in
        for (let id in this.turnstatuses) {
            this.removeTurnstatus(id);
        }
        this.turnstatuses = {};
    }
    removeMovestatus(volatile) {
        if (!this.hasMovestatus(volatile)) {
            return;
        }
        delete this.movestatuses[volatile];
    }
    addMovestatus(volatile) {
        volatile = toId(volatile);
        if (this.hasMovestatus(volatile)) {
            return;
        }
        this.movestatuses[volatile] = [volatile];
    }
    hasMovestatus(volatile) {
        return !!this.movestatuses[volatile];
    }
    clearMovestatuses() {
        // eslint-disable-next-line guard-for-in
        for (let id in this.movestatuses) {
            this.removeMovestatus(id);
        }
        this.movestatuses = {};
    }
    clearVolatiles() {
        this.volatiles = {};
        this.clearTurnstatuses();
        this.clearMovestatuses();
    }
    markMove(moveName, pp, recursionSource) {
        if (recursionSource === this.ident) {
            return;
        }
        if (pp === undefined) {
            pp = 1;
        }
        moveName = Tools.getMove(moveName).name;
        if (moveName === 'Struggle') {
            return;
        }
        if (this.volatiles.transform) {
            // make sure there is no infinite recursion if both Pokemon are transformed into each
            // other
            if (!recursionSource) {
                recursionSource = this.ident;
            }
            this.volatiles.transform[1].markMove(moveName, 0, recursionSource);
            moveName = '*' + moveName;
        }
        for (let i = 0; i < this.moveTrack.length; i++) {
            if (moveName === this.moveTrack[i][0]) {
                this.moveTrack[i][1] += pp;
                if (this.moveTrack[i][1] < 0) {
                    this.moveTrack[i][1] = 0;
                }
                return;
            }
        }
        this.moveTrack.push([moveName, pp]);
    }
    markAbility(ability, isNotBase) {
        ability = Tools.getAbility(ability).name;
        this.ability = ability;
        if (!this.baseAbility && !isNotBase) {
            this.baseAbility = ability;
        }
    }
    htmlName() {
        return '<span class="battle-nickname' + (this.side.n === 0 ? '' : '-foe') + '" title="' + this.species + '">' + Tools.escapeHTML(this.name) + '</span>';
    }
    getName(shortName) {
        if (this.side.n === 0) {
            return this.htmlName();
        } else {
            return (shortName ? 'Opposing ' : 'The opposing ') + this.htmlName();
        }
    }
    getLowerName(shortName) {
        if (this.side.n === 0) {
            return this.htmlName();
        } else {
            return (shortName ? 'opposing ' : 'the opposing ') + this.htmlName();
        }
    }
    getTitle() {
        let titlestring = '(' + this.ability + ') ';
        for (let i = 0; i < this.moves.length; i++) {
            if (i != 0) {
                titlestring += ' / ';
            }
            titlestring += Tools.getMove(this.moves[i]).name;
        }
        return titlestring;
    }
    getFullName(plaintext) {
        let name = this.side && this.side.n && (this.side.battle.ignoreOpponent || this.side.battle.ignoreNicks) ? this.species : Tools.escapeHTML(this.name);
        if (name !== this.species) {
            if (plaintext) {
                name += ' (' + this.species + ')';
            } else {
                name = '<span class="battle-nickname' + (this.side && this.side.n === 0 ? '' : '-foe') + '" title="' + this.species + '">' + name + ' <small>(' + this.species + ')</small>' + '</span>';
            }
        }
        if (plaintext) {
            if (this === this.side.active[0]) {
                name += ' (active)';
            } else if (this.fainted) {
                name += ' (fainted)';
            } else {
                let statustext = '';
                if (this.hp !== this.maxhp) {
                    statustext += this.hpDisplay();
                }
                if (this.status) {
                    if (statustext) {
                        statustext += '|';
                    }
                    statustext += this.status;
                }
                if (statustext) {
                    name += ' (' + statustext + ')';
                }
            }
        }
        return name;
    }
    getBoost(boostStat) {
        let boostStatTable = {
            atk: 'Atk',
            def: 'Def',
            spa: 'SpA',
            spd: 'SpD',
            spe: 'Spe',
            accuracy: 'Accuracy',
            evasion: 'Evasion',
            spc: 'Spc',
        };
        if (!this.boosts[boostStat]) {
            return '1&times;&nbsp;' + boostStatTable[boostStat];
        }
        if (this.boosts[boostStat] > 6) {
            this.boosts[boostStat] = 6;
        }
        if (this.boosts[boostStat] < -6) {
            this.boosts[boostStat] = -6;
        }
        if (boostStat === 'accuracy' || boostStat === 'evasion') {
            if (this.boosts[boostStat] > 0) {
                let goodBoostTable = ['1&times;', '1.33&times;', '1.67&times;', '2&times;', '2.33&times;', '2.67&times;', '3&times;'];
                // let goodBoostTable = ['Normal', '+1', '+2', '+3', '+4', '+5', '+6'];
                return '' + goodBoostTable[this.boosts[boostStat]] + '&nbsp;' + boostStatTable[boostStat];
            }
            let badBoostTable = ['1&times;', '0.75&times;', '0.6&times;', '0.5&times;', '0.43&times;', '0.38&times;', '0.33&times;'];
            // let badBoostTable = ['Normal', '&minus;1', '&minus;2', '&minus;3', '&minus;4', '&minus;5', '&minus;6'];
            return '' + badBoostTable[-this.boosts[boostStat]] + '&nbsp;' + boostStatTable[boostStat];
        }
        if (this.boosts[boostStat] > 0) {
            let goodBoostTable = ['1&times;', '1.5&times;', '2&times;', '2.5&times;', '3&times;', '3.5&times;', '4&times;'];
            // let goodBoostTable = ['Normal', '+1', '+2', '+3', '+4', '+5', '+6'];
            return '' + goodBoostTable[this.boosts[boostStat]] + '&nbsp;' + boostStatTable[boostStat];
        }
        let badBoostTable = ['1&times;', '0.67&times;', '0.5&times;', '0.4&times;', '0.33&times;', '0.29&times;', '0.25&times;'];
        // let badBoostTable = ['Normal', '&minus;1', '&minus;2', '&minus;3', '&minus;4', '&minus;5', '&minus;6'];
        return '' + badBoostTable[-this.boosts[boostStat]] + '&nbsp;' + boostStatTable[boostStat];
    }
    getBoostType(boostStat) {
        if (!this.boosts[boostStat]) {
            return 'neutral';
        }
        if (this.boosts[boostStat] > 0) {
            return 'good';
        }
        return 'bad';
    }
    clearVolatile() {
        this.ability = this.baseAbility;
        if (BattlePokedex && BattlePokedex[this.species] && BattlePokedex[this.species].weightkg) {
            this.weightkg = BattlePokedex[this.species].weightkg;
        }
        this.boosts = {};
        this.clearVolatiles();
        for (let i = 0; i < this.moveTrack.length; i++) {
            if (this.moveTrack[i][0].charAt(0) === '*') {
                this.moveTrack.splice(i, 1);
                i--;
            }
        }
        // this.lastMove = '';
        this.statusStage = 0;
    }
    /**
     * copyAll = false means Baton Pass,
     * copyAll = true means Illusion breaking
     */
    copyVolatileFrom(pokemon, copyAll) {
        this.boosts = pokemon.boosts;
        this.volatiles = pokemon.volatiles;
        // this.lastMove = pokemon.lastMove; // I think
        if (!copyAll) {
            delete this.volatiles['airballoon'];
            delete this.volatiles['attract'];
            delete this.volatiles['autotomize'];
            delete this.volatiles['disable'];
            delete this.volatiles['encore'];
            delete this.volatiles['foresight'];
            delete this.volatiles['imprison'];
            delete this.volatiles['mimic'];
            delete this.volatiles['miracleeye'];
            delete this.volatiles['nightmare'];
            delete this.volatiles['smackdown'];
            delete this.volatiles['stockpile1'];
            delete this.volatiles['stockpile2'];
            delete this.volatiles['stockpile3'];
            delete this.volatiles['torment'];
            delete this.volatiles['typeadd'];
            delete this.volatiles['typechange'];
            delete this.volatiles['yawn'];
        }
        delete this.volatiles['transform'];
        delete this.volatiles['formechange'];
        pokemon.boosts = {};
        pokemon.volatiles = {};
        pokemon.statusStage = 0;
    }
    copyTypesFrom(pokemon) {
        const [types, addedType] = pokemon.getTypes();
        this.addVolatile('typechange', types.join('/'));
        if (addedType) {
            this.addVolatile('typeadd', addedType);
        } else {
            this.removeVolatile('typeadd');
        }
    }
    getTypes() {
        let types;
        if (this.volatiles.typechange) {
            types = this.volatiles.typechange[1].split('/');
        } else {
            const species = this.getSpecies();
            types = Tools.getTemplate(species).types || [];
        }
        const addedType = (this.volatiles.typeadd ? this.volatiles.typeadd[1] : '');
        return [types, addedType];
    }
    getSpecies() {
        return this.volatiles.formechange ? this.volatiles.formechange[1] : this.species;
    }
    reset() {
        this.clearVolatile();
        this.hp = this.maxhp;
        this.fainted = false;
        this.status = '';
        this.moveTrack = [];
        this.name = this.name || this.species;
    }
    // This function is used for two things:
    //   1) The percentage to display beside the HP bar.
    //   2) The width to draw an HP bar.
    //
    // This function is NOT used in the calculation of any other displayed
    // percentages or ranges, which have their own, more complex, formulae.
    hpWidth(maxWidth) {
        if (this.fainted || !this.hp) {
            return 0;
        }
        // special case for low health...
        if (this.hp == 1 && this.maxhp > 45) {
            return 1;
        }
        if (this.maxhp === 48) {
            // Draw the health bar to the middle of the range.
            // This affects the width of the visual health bar *only*; it
            // does not affect the ranges displayed in any way.
            let range = this.getPixelRange(this.hp, this.hpcolor);
            let ratio = (range[0] + range[1]) / 2;
            return Math.round(maxWidth * ratio) || 1;
        }
        let percentage = Math.ceil(100 * this.hp / this.maxhp);
        if ((percentage === 100) && (this.hp < this.maxhp)) {
            percentage = 99;
        }
        return percentage * maxWidth / 100;
    }
    hpDisplay(precision = 1) {
        if (this.maxhp === 100) {
            return this.hp + '%';
        }
        if (this.maxhp !== 48) {
            return (this.hp / this.maxhp * 100).toFixed(precision) + '%';
        }
        let range = this.getPixelRange(this.hp, this.hpcolor);
        return this.getFormattedRange(range, precision, '–');
    }
    destroy() {
        this.side = null;
    }
}
class Side {
    constructor(battle, n) {
        this.name = '';
        this.id = '';
        this.foe = null;
        this.spriteid = 262;
        this.totalPokemon = 6;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.missedPokemon = null;
        this.wisher = null;
        this.active = [null];
        this.lastPokemon = null;
        this.pokemon = [];
        /** [effectName, levels, minDuration, maxDuration] */
        this.sideConditions = {};
        this.battle = battle;
        this.n = n;
    }
    rollTrainerSprites() {
        let sprites = [1, 2, 101, 102, 169, 170];
        this.spriteid = sprites[Math.floor(Math.random() * sprites.length)];
    }
    behindx(offset) {
        return this.x + (!this.n ? -1 : 1) * offset;
    }
    behindy(offset) {
        return this.y + (!this.n ? 1 : -1) * offset;
    }
    leftof(offset) {
        return (!this.n ? -1 : 1) * offset;
    }
    behind(offset) {
        return this.z + (!this.n ? -1 : 1) * offset;
    }
    clearPokemon() {
        for (const pokemon of this.pokemon) {
            pokemon.destroy();
        }
        this.pokemon = [];
        for (let i = 0; i < this.active.length; i++) {
            this.active[i] = null;
        }
        this.lastPokemon = null;
    }
    reset() {
        this.clearPokemon();
        this.sideConditions = {};
    }
    setAvatar(spriteid) {
        this.spriteid = spriteid;
    }
    setName(name, spriteid) {
        if (name) {
            this.name = (name || '');
        }
        this.id = toId(this.name);
        if (spriteid) {
            this.spriteid = spriteid;
        } else {
            this.rollTrainerSprites();
            if (this.foe && this.spriteid === this.foe.spriteid) {
                this.rollTrainerSprites();
            }
        }
        if (this.battle.stagnateCallback) {
            this.battle.stagnateCallback(this.battle);
        }
    }
    getTeamName() {
        if (this === this.battle.mySide) {
            return 'Your team';
        }
        return 'The opposing team';
    }
    getLowerTeamName() {
        if (this === this.battle.mySide) {
            return 'your team';
        }
        return 'the opposing team';
    }
    addSideCondition(effect) {
        let elem; let curelem;
        let condition = effect.id;
        if (this.sideConditions[condition]) {
            if (condition === 'spikes' || condition === 'toxicspikes') {
                this.sideConditions[condition][1]++;
            }
            return;
        }
        // Side conditions work as: [effectName, levels, minDuration, maxDuration]
        switch (condition) {
        case 'auroraveil':
            this.sideConditions[condition] = [effect.name, 1, 5, 8];
            break;
        case 'reflect':
            this.sideConditions[condition] = [effect.name, 1, 5, this.battle.gen >= 4 ? 8 : 0];
            break;
        case 'safeguard':
            this.sideConditions[condition] = [effect.name, 1, 5, 0];
            break;
        case 'lightscreen':
            this.sideConditions[condition] = [effect.name, 1, 5, this.battle.gen >= 4 ? 8 : 0];
            break;
        case 'mist':
            this.sideConditions[condition] = [effect.name, 1, 5, 0];
            break;
        case 'tailwind':
            this.sideConditions[condition] = [effect.name, 1, this.battle.gen >= 5 ? 4 : 3, 0];
            break;
        case 'luckychant':
            this.sideConditions[condition] = [effect.name, 1, 5, 0];
            break;
        case 'stealthrock':
            this.sideConditions[condition] = [effect.name, 1, 0, 0];
            break;
        case 'spikes':
            this.sideConditions[condition] = [effect.name, 1, 0, 0];
            break;
        case 'toxicspikes':
            this.sideConditions[condition] = [effect.name, 1, 0, 0];
            break;
        case 'stickyweb':
            this.sideConditions[condition] = [effect.name, 1, 0, 0];
            break;
        default:
            this.sideConditions[condition] = [effect.name, 1, 0, 0];
            break;
        }
    }
    removeSideCondition(condition) {
        const id = toId(condition);
        if (!this.sideConditions[id]) {
            return;
        }
        delete this.sideConditions[id];
    }
    newPokemon(data, replaceSlot = -1) {
        let pokeobj;
        let poke = new Pokemon(data, this);
        if (!poke.ability && poke.baseAbility) {
            poke.ability = poke.baseAbility;
        }
        poke.reset();
        if (replaceSlot >= 0) {
            this.pokemon[replaceSlot] = poke;
        } else {
            this.pokemon.push(poke);
        }
        if (this.pokemon.length > this.totalPokemon || this.battle.speciesClause) {
            // check for Illusion
            let existingTable = {};
            let toRemove = -1;
            for (let poke1i = 0; poke1i < this.pokemon.length; poke1i++) {
                let poke1 = this.pokemon[poke1i];
                if (!poke1.searchid) {
                    continue;
                }
                if (poke1.searchid in existingTable) {
                    let poke2i = existingTable[poke1.searchid];
                    let poke2 = this.pokemon[poke2i];
                    if (poke === poke1) {
                        toRemove = poke2i;
                    } else if (poke === poke2) {
                        toRemove = poke1i;
                    } else if (this.active.indexOf(poke1) >= 0) {
                        toRemove = poke2i;
                    } else if (this.active.indexOf(poke2) >= 0) {
                        toRemove = poke1i;
                    } else if (poke1.fainted && !poke2.fainted) {
                        toRemove = poke2i;
                    } else {
                        toRemove = poke1i;
                    }
                    break;
                }
                existingTable[poke1.searchid] = poke1i;
            }
            if (toRemove >= 0) {
                if (this.pokemon[toRemove].fainted) {
                    // A fainted Pokemon was actually a Zoroark
                    let illusionFound = null;
                    for (let i = 0; i < this.pokemon.length; i++) {
                        let curPoke = this.pokemon[i];
                        if (curPoke === poke) {
                            continue;
                        }
                        if (curPoke.fainted) {
                            continue;
                        }
                        if (this.active.indexOf(curPoke) >= 0) {
                            continue;
                        }
                        if (curPoke.species === 'Zoroark' || curPoke.species === 'Zorua' || curPoke.ability === 'Illusion') {
                            illusionFound = curPoke;
                            break;
                        }
                    }
                    if (!illusionFound) {
                        // This is Hackmons; we'll just guess a random unfainted Pokemon.
                        // This will keep the fainted Pokemon count correct, and will
                        // eventually become correct as incorrect guesses are switched in
                        // and reguessed.
                        for (let i = 0; i < this.pokemon.length; i++) {
                            let curPoke = this.pokemon[i];
                            if (curPoke === poke) {
                                continue;
                            }
                            if (curPoke.fainted) {
                                continue;
                            }
                            if (this.active.indexOf(curPoke) >= 0) {
                                continue;
                            }
                            illusionFound = curPoke;
                            break;
                        }
                    }
                    if (illusionFound) {
                        illusionFound.fainted = true;
                        illusionFound.hp = 0;
                        illusionFound.status = '';
                    }
                }
                this.pokemon.splice(toRemove, 1);
            }
        }
        return poke;
    }
    switchIn(pokemon, slot) {
        if (slot === undefined) {
            slot = pokemon.slot;
        }
        this.active[slot] = pokemon;
        pokemon.slot = slot;
        pokemon.clearVolatile();
        pokemon.lastMove = '';
        this.battle.lastMove = 'switch-in';
        if (this.lastPokemon && (this.lastPokemon.lastMove === 'batonpass' || this.lastPokemon.lastMove === 'zbatonpass')) {
            pokemon.copyVolatileFrom(this.lastPokemon);
        }
        if (pokemon.side.n === 0) {
            this.battle.message('Go! ' + pokemon.getFullName() + '!');
        } else {
            this.battle.message('' + Tools.escapeHTML(pokemon.side.name) + ' sent out ' + pokemon.getFullName() + '!');
        }
        if (this.battle.switchCallback) {
            this.battle.switchCallback(this.battle, this);
        }
    }
    dragIn(pokemon, slot = pokemon.slot) {
        this.battle.message('' + pokemon.getFullName() + ' was dragged out!');
        let oldpokemon = this.active[slot];
        if (oldpokemon === pokemon) {
            return;
        }
        this.lastPokemon = oldpokemon;
        if (oldpokemon) {
            oldpokemon.clearVolatile();
        }
        pokemon.clearVolatile();
        pokemon.lastMove = '';
        this.battle.lastMove = 'switch-in';
        this.active[slot] = pokemon;
        pokemon.slot = slot;
        if (this.battle.dragCallback) {
            this.battle.dragCallback(this.battle, this);
        }
    }
    replace(pokemon, slot = pokemon.slot) {
        let oldpokemon = this.active[slot];
        if (pokemon === oldpokemon) {
            return;
        }
        this.lastPokemon = oldpokemon;
        pokemon.clearVolatile();
        if (oldpokemon) {
            pokemon.lastMove = oldpokemon.lastMove;
            pokemon.hp = oldpokemon.hp;
            pokemon.maxhp = oldpokemon.maxhp;
            pokemon.hpcolor = oldpokemon.hpcolor;
            pokemon.status = oldpokemon.status;
            pokemon.copyVolatileFrom(oldpokemon, true);
            // we don't know anything about the illusioned pokemon except that it's not fainted
            // technically we also know its status but only at the end of the turn, not here
            oldpokemon.fainted = false;
            oldpokemon.hp = oldpokemon.maxhp;
            oldpokemon.status = '???';
        }
        this.active[slot] = pokemon;
        pokemon.slot = slot;
        // not sure if we want a different callback
        if (this.battle.dragCallback) {
            this.battle.dragCallback(this.battle, this);
        }
    }
    switchOut(pokemon, slot = pokemon.slot) {
        if (pokemon.lastMove !== 'batonpass' && pokemon.lastMove !== 'zbatonpass') {
            pokemon.clearVolatile();
        } else {
            pokemon.removeVolatile('transform');
            pokemon.removeVolatile('formechange');
        }
        if (pokemon.lastMove === 'uturn' || pokemon.lastMove === 'voltswitch') {
            this.battle.message('' + pokemon.getName() + ' went back to ' + Tools.escapeHTML(pokemon.side.name) + '!');
        } else if (pokemon.lastMove !== 'batonpass' && pokemon.lastMove !== 'zbatonpass') {
            if (pokemon.side.n === 0) {
                this.battle.message('' + pokemon.getName() + ', come back!');
            } else {
                this.battle.message('' + Tools.escapeHTML(pokemon.side.name) + ' withdrew ' + pokemon.getFullName() + '!');
            }
        }
        if (pokemon.statusData.toxicTurns) {
            pokemon.statusData.toxicTurns = 1;
        }
        if (this.battle.gen === 5) {
            pokemon.statusData.sleepTurns = 0;
        }
        this.lastPokemon = pokemon;
        this.active[slot] = null;
    }
    swapTo(pokemon, slot, kwargs) {
        if (pokemon.slot === slot) {
            return;
        }
        let target = this.active[slot];
        if (!kwargs.silent) {
            let fromeffect = Tools.getEffect(kwargs.from);
            switch (fromeffect.id) {
            case 'allyswitch':
                this.battle.message('<small>' + pokemon.getName() + ' and ' + target.getLowerName() + ' switched places.</small>');
                break;
            default:
                this.battle.message('<small>' + pokemon.getName() + ' moved to the center!</small>');
                break;
            }
        }
        let oslot = pokemon.slot;
        pokemon.slot = slot;
        if (target) {
            target.slot = oslot;
        }
        this.active[slot] = pokemon;
        this.active[oslot] = target;
    }
    swapWith(pokemon, target, kwargs) {
        // method provided for backwards compatibility only
        if (pokemon === target) {
            return;
        }
        if (!kwargs.silent) {
            let fromeffect = Tools.getEffect(kwargs.from);
            switch (fromeffect.id) {
            case 'allyswitch':
                this.battle.message('<small>' + pokemon.getName() + ' and ' + target.getLowerName() + ' switched places.</small>');
                break;
            }
        }
        let oslot = pokemon.slot;
        let nslot = target.slot;
        pokemon.slot = nslot;
        target.slot = oslot;
        this.active[nslot] = pokemon;
        this.active[oslot] = target;
    }
    faint(pokemon, slot = pokemon.slot) {
        pokemon.clearVolatile();
        this.lastPokemon = pokemon;
        this.active[slot] = null;
        this.battle.message('' + pokemon.getName() + ' fainted!');
        pokemon.fainted = true;
        pokemon.hp = 0;
        if (this.battle.faintCallback) {
            this.battle.faintCallback(this.battle, this);
        }
    }
    destroy() {
        this.clearPokemon();
        this.battle = null;
        this.foe = null;
    }
}
var Playback;
(function(Playback) {
    Playback[Playback['Uninitialized'] = 0] = 'Uninitialized';
    Playback[Playback['Ready'] = 1] = 'Ready';
    Playback[Playback['Playing'] = 2] = 'Playing';
    Playback[Playback['Paused'] = 3] = 'Paused';
    Playback[Playback['Finished'] = 4] = 'Finished';
    Playback[Playback['Seeking'] = 5] = 'Seeking';
})(Playback || (Playback = {}));
class Battle {
    constructor(id = '') {
        this.sidesSwitched = false;
        // activity queue
        this.activityQueue = [];
        this.minorQueue = [];
        this.activityStep = 0;
        this.fastForward = 0;
        this.fastForwardWillScroll = false;
        this.resultWaiting = false;
        this.activeMoveIsSpread = null;
        // callback
        this.faintCallback = null;
        this.switchCallback = null;
        this.dragCallback = null;
        this.turnCallback = null;
        this.startCallback = null;
        this.stagnateCallback = null;
        this.endCallback = null;
        this.customCallback = null;
        this.errorCallback = null;
        this.messageFadeTime = 300;
        this.messageShownTime = 1;
        this.turnsSinceMoved = 0;
        this.hasPreMoveMessage = false;
        this.turn = 0;
        /**
         * Has playback gotten to the point where a player has won or tied?
         * (Affects whether BGM is playing)
         */
        this.ended = false;
        this.usesUpkeep = false;
        this.weather = '';
        this.pseudoWeather = [];
        this.weatherTimeLeft = 0;
        this.weatherMinTimeLeft = 0;
        this.mySide = null;
        this.yourSide = null;
        this.p1 = null;
        this.p2 = null;
        this.sides = [null, null];
        this.lastMove = '';
        this.gen = 7;
        this.teamPreviewCount = 0;
        this.speciesClause = false;
        this.tier = '';
        this.gameType = 'singles';
        this.rated = false;
        this.endLastTurnPending = false;
        this.totalTimeLeft = 0;
        this.kickingInactive = false;
        // options
        this.id = '';
        this.roomid = '';
        this.hardcoreMode = false;
        this.ignoreNicks = false;
        this.ignoreOpponent = false;
        this.ignoreSpects = false;
        this.debug = false;
        this.joinButtons = false;
        this.paused = true;
        this.playbackState = Playback.Uninitialized;
        // external
        this.resumeButton = null;
        this.id = id;
        this.init();
    }
    removePseudoWeather(weather) {
        for (let i = 0; i < this.pseudoWeather.length; i++) {
            if (this.pseudoWeather[i][0] === weather) {
                this.pseudoWeather.splice(i, 1);
                return;
            }
        }
    }
    addPseudoWeather(weather, minTimeLeft, timeLeft) {
        this.pseudoWeather.push([weather, minTimeLeft, timeLeft]);
    }
    hasPseudoWeather(weather) {
        for (let i = 0; i < this.pseudoWeather.length; i++) {
            if (this.pseudoWeather[i][0] === weather) {
                return true;
            }
        }
        return false;
    }
    init() {
        this.mySide = new Side(this, 0);
        this.yourSide = new Side(this, 1);
        this.mySide.foe = this.yourSide;
        this.yourSide.foe = this.mySide;
        this.sides = [this.mySide, this.yourSide];
        this.p1 = this.mySide;
        this.p2 = this.yourSide;
        this.gen = 7;
        this.reset();
    }
    reset(dontResetSound) {
        // battle state
        this.turn = 0;
        this.ended = false;
        this.weather = '';
        this.weatherTimeLeft = 0;
        this.weatherMinTimeLeft = 0;
        this.pseudoWeather = [];
        this.lastMove = '';
        // DOM state
        for (const side of this.sides) {
            if (side) {
                side.reset();
            }
        }
        if (this.ignoreNicks) {
            let $log = $('.battle-log .inner');
            if ($log.length) {
                $log.addClass('hidenicks');
            }
            let $message = $('.battle .message');
            if ($message.length) {
                $message.addClass('hidenicks');
            }
        }
        // activity queue state
        this.activeMoveIsSpread = null;
        this.activityStep = 0;
        this.minorQueue = [];
        this.resultWaiting = false;
        this.paused = true;
        this.resetTurnsSinceMoved();
    }
    destroy() {
        for (let i = 0; i < this.sides.length; i++) {
            if (this.sides[i]) {
                this.sides[i].destroy();
            }
            this.sides[i] = null;
        }
        this.mySide = null;
        this.yourSide = null;
        this.p1 = null;
        this.p2 = null;
    }
    message(message, hiddenMessage) {}
    switchSides(replay) {
        if (this.ended) {
            this.reset(true);
            this.setSidesSwitched(!this.sidesSwitched);
            this.fastForwardTo(-1);
        } else {
            let turn = this.turn;
            let paused = this.paused;
            this.reset(true);
            this.paused = paused;
            this.setSidesSwitched(!this.sidesSwitched);
            if (turn) {
                this.fastForwardTo(turn);
            }
            if (!paused) {
                this.play();
            } else {
                this.pause();
            }
        }
    }
    setSidesSwitched(sidesSwitched) {
        this.sidesSwitched = sidesSwitched;
        if (this.sidesSwitched) {
            this.mySide = this.p2;
            this.yourSide = this.p1;
        } else {
            this.mySide = this.p1;
            this.yourSide = this.p2;
        }
        this.sides[0] = this.mySide;
        this.sides[1] = this.yourSide;
        this.sides[0].n = 0;
        this.sides[1].n = 1;
    }
    //
    // activities
    //
    start() {
        if (this.startCallback) {
            this.startCallback(this);
        }
    }
    winner(winner) {
        if (winner) {
            this.message('' + Tools.escapeHTML(winner) + ' won the battle!');
        } else {
            this.message('Tie between ' + Tools.escapeHTML(this.p1.name) + ' and ' + Tools.escapeHTML(this.p2.name) + '!');
        }
        this.ended = true;
    }
    prematureEnd() {
        this.message('This replay ends here.');
        this.ended = true;
    }
    endLastTurn() {
        if (this.endLastTurnPending) {
            this.endLastTurnPending = false;
        }
    }
    setHardcoreMode(mode) {
        this.hardcoreMode = mode;
    }
    setTurn(turnNum) {
        turnNum = parseInt(turnNum, 10);
        if (turnNum == this.turn + 1) {
            this.endLastTurnPending = true;
        }
        if (this.turn && !this.usesUpkeep) {
            this.updatePseudoWeatherLeft();
        } // for compatibility with old replays
        this.turn = turnNum;
        if (this.mySide.active[0]) {
            this.mySide.active[0].clearTurnstatuses();
        }
        if (this.mySide.active[1]) {
            this.mySide.active[1].clearTurnstatuses();
        }
        if (this.mySide.active[2]) {
            this.mySide.active[2].clearTurnstatuses();
        }
        if (this.yourSide.active[0]) {
            this.yourSide.active[0].clearTurnstatuses();
        }
        if (this.yourSide.active[1]) {
            this.yourSide.active[1].clearTurnstatuses();
        }
        if (this.yourSide.active[2]) {
            this.yourSide.active[2].clearTurnstatuses();
        }
        if (!this.fastForward) {
            this.turnsSinceMoved++;
        }
        if (this.fastForward) {
            if (this.turnCallback) {
                this.turnCallback(this);
            }
            if (this.fastForward > -1 && turnNum >= this.fastForward) {
                this.fastForwardOff();
                if (this.endCallback) {
                    this.endCallback(this);
                }
            }
            return;
        }
        if (this.turnCallback) {
            this.turnCallback(this);
        }
    }
    resetTurnsSinceMoved() {
        this.turnsSinceMoved = 0;
    }
    updateToxicTurns() {
        for (let i = 0; i < this.sides.length; i++) {
            for (let slot = 0; slot < this.sides[i].active.length; slot++) {
                let poke = this.sides[i].active[slot];
                if (poke && poke.statusData && poke.statusData.toxicTurns) {
                    poke.statusData.toxicTurns++;
                }
            }
        }
    }
    changeWeather(weatherName, poke, isUpkeep, ability) {
        let weather = toId(weatherName);
        let weatherTable = {
            sunnyday: {
                name: 'Sun',
                startMessage: 'The sunlight turned harsh!',
                abilityMessage: '\'s Drought intensified the sun\'s rays!',
                // upkeepMessage: 'The sunlight is strong!',
                endMessage: 'The sunlight faded.',
            },
            desolateland: {
                name: 'Intense Sun',
                startMessage: 'The sunlight turned extremely harsh!',
                endMessage: 'The harsh sunlight faded.',
            },
            raindance: {
                name: 'Rain',
                startMessage: 'It started to rain!',
                abilityMessage: '\'s Drizzle made it rain!',
                // upkeepMessage: 'Rain continues to fall!',
                endMessage: 'The rain stopped.',
            },
            primordialsea: {
                name: 'Heavy Rain',
                startMessage: 'A heavy rain began to fall!',
                endMessage: 'The heavy rain has lifted!',
            },
            sandstorm: {
                name: 'Sandstorm',
                startMessage: 'A sandstorm kicked up!',
                abilityMessage: '\'s Sand Stream whipped up a sandstorm!',
                upkeepMessage: 'The sandstorm is raging.',
                endMessage: 'The sandstorm subsided.',
            },
            hail: {
                name: 'Hail',
                startMessage: 'It started to hail!',
                abilityMessage: '\'s Snow Warning whipped up a hailstorm!',
                upkeepMessage: 'The hail is crashing down.',
                endMessage: 'The hail stopped.',
            },
            deltastream: {
                name: 'Strong Winds',
                startMessage: 'Mysterious strong winds are protecting Flying-type Pok&eacute;mon!',
                endMessage: 'The mysterious strong winds have dissipated!',
            },
        };
        if (!weather || weather === 'none') {
            weather = '';
        }
        let newWeather = weatherTable[weather];
        if (isUpkeep) {
            if (this.weather && this.weatherTimeLeft) {
                this.weatherTimeLeft--;
                if (this.weatherMinTimeLeft != 0) {
                    this.weatherMinTimeLeft--;
                }
            }
            if (!this.fastForward) {

            }
            if (newWeather && newWeather.upkeepMessage) {
                this.message('<div><small>' + newWeather.upkeepMessage + '</small></div>');
            }
            return;
        }
        if (newWeather) {
            let isExtremeWeather = (weather === 'deltastream' || weather === 'desolateland' || weather === 'primordialsea');
            if (poke) {
                if (ability) {
                    this.message('', '<small>[' + poke.getName(true) + '\'s ' + ability.name + '!]</small>');
                    poke.markAbility(ability.name);
                    this.message('<small>' + newWeather.startMessage + '</small>');
                } else {
                    this.message('<small>' + poke.getName() + newWeather.abilityMessage + '</small>'); // for backwards compatibility
                }
                this.weatherTimeLeft = (this.gen <= 5 || isExtremeWeather) ? 0 : 8;
                this.weatherMinTimeLeft = (this.gen <= 5 || isExtremeWeather) ? 0 : 5;
            } else if (isUpkeep) {
                this.weatherTimeLeft = 0;
                this.weatherMinTimeLeft = 0;
            } else if (isExtremeWeather) {
                this.message('<small>' + newWeather.startMessage + '</small>');
                this.weatherTimeLeft = 0;
                this.weatherMinTimeLeft = 0;
            } else {
                this.message('<small>' + newWeather.startMessage + '</small>');
                this.weatherTimeLeft = (this.gen <= 3 ? 5 : 8);
                this.weatherMinTimeLeft = (this.gen <= 3 ? 0 : 5);
            }
        }
        if (this.weather && !newWeather) {
            this.message('<small>' + weatherTable[this.weather].endMessage + '</small>');
        }
        this.weather = weather;
    }
    updatePseudoWeatherLeft() {
        for (let i = 0; i < this.pseudoWeather.length; i++) {
            let pWeather = this.pseudoWeather[i];
            if (pWeather[1]) {
                pWeather[1]--;
            }
            if (pWeather[2]) {
                pWeather[2]--;
            }
        }
        for (let i = 0; i < this.sides.length; i++) {
            for (let id in this.sides[i].sideConditions) {
                let cond = this.sides[i].sideConditions[id];
                if (cond[2]) {
                    cond[2]--;
                }
                if (cond[3]) {
                    cond[3]--;
                }
            }
        }
    }
    useMove(pokemon, move, target, kwargs) {
        let fromeffect = Tools.getEffect(kwargs.from);
        pokemon.clearMovestatuses();
        if (move.id === 'focuspunch') {
            pokemon.removeTurnstatus('focuspunch');
        }
        if (!target) {
            target = pokemon.side.foe.active[0];
        }
        if (!target) {
            target = pokemon.side.foe.missedPokemon;
        }
        if (!kwargs.silent) {
            if (kwargs.zeffect) {
                this.message('<small>' + pokemon.getName() + ' unleashes its full-force Z-Move!</small>', '');
            }
            switch (fromeffect.id) {
            case 'snatch':
                break;
            case 'magicbounce':
            case 'magiccoat':
            case 'rebound':
                if (fromeffect.id === 'magiccoat') {
                    pokemon.addTurnstatus('magiccoat');
                } else {
                    this.message('', '<small>[' + pokemon.getName(true) + '\'s ' + fromeffect.name + '!]</small>');
                    pokemon.markAbility(fromeffect.name);
                }
                this.message(pokemon.getName() + ' bounced the ' + move.name + ' back!');
                break;
            case 'metronome':
                this.message('Waggling a finger let it use <strong>' + move.name + '</strong>!');
                break;
            case 'naturepower':
                this.message('Nature Power turned into <strong>' + move.name + '</strong>!');
                break;
            case 'weatherball':
                this.message('Breakneck Blitz turned into <strong>' + move.name + '</strong> due to the weather!');
                break;
            case 'sleeptalk':
                pokemon.markMove(move.name, 0);
                this.message(pokemon.getName() + ' used <strong>' + move.name + '</strong>!');
                break;
                // Gen 1
            case 'bind':
            case 'clamp':
            case 'firespin':
            case 'wrap':
                this.message(pokemon.getName() + '\'s attack continues!');
                break;
            default:
                this.message(pokemon.getName() + ' used <strong>' + move.name + '</strong>!');
                if (!fromeffect.id || fromeffect.id === 'pursuit') {
                    let moveName = move.name;
                    if (move.isZ) {
                        pokemon.item = move.isZ;
                        let item = Tools.getItem(move.isZ);
                        if (item.zMoveFrom) {
                            moveName = item.zMoveFrom;
                        }
                    } else if (move.name.slice(0, 2) === 'Z-') {
                        moveName = moveName.slice(2);
                        move = Tools.getMove(moveName);
                        if (BattleItems) {
                            for (let item in BattleItems) {
                                if (BattleItems[item].zMoveType === move.type) {
                                    pokemon.item = item;
                                }
                            }
                        }
                    }
                    let pp = (target && target.side !== pokemon.side && toId(target.ability) === 'pressure' ? 2 : 1);
                    pokemon.markMove(moveName, pp);
                }
                break;
            }
        }
        if (!this.fastForward && !kwargs.still) {
            // skip
            if (kwargs.miss && target.side) {
                target = target.side.missedPokemon;
            }
            if (kwargs.notarget || !target) {
                target = pokemon.side.foe.missedPokemon;
            }
            if (kwargs.prepare || kwargs.anim === 'prepare') {

            } else if (!kwargs.notarget) {
                let usedMove = kwargs.anim ? Tools.getMove(kwargs.anim) : move;
                if (kwargs.spread) {
                    this.activeMoveIsSpread = kwargs.spread;
                    let targets = [pokemon];
                    let hitPokemon = kwargs.spread.split(',');
                    if (hitPokemon[0] !== '.') {
                        for (const target of hitPokemon) {
                            targets.push(this.getPokemon(target + ': ?'));
                        }
                    } else {
                        // if hitPokemon[0] === '.' then no target was hit by the attack
                        targets.push(target.side.missedPokemon);
                    }
                }
            }
        }
        pokemon.lastMove = move.id;
        this.lastMove = move.id;
        if (move.id === 'wish' || move.id === 'healingwish') {
            pokemon.side.wisher = pokemon;
        }
    }
    cantUseMove(pokemon, effect, move, kwargs) {
        pokemon.clearMovestatuses();
        if (effect.effectType === 'Ability') {
            this.message('', '<small>[' + pokemon.getName(true) + '\'s ' + effect.name + '!]</small>');
            pokemon.markAbility(effect.name);
        }
        switch (effect.id) {
        case 'taunt':
            this.message('' + pokemon.getName() + ' can\'t use ' + move.name + ' after the taunt!');
            pokemon.markMove(move.name, 0);
            break;
        case 'gravity':
            this.message('' + pokemon.getName() + ' can\'t use ' + move.name + ' because of gravity!');
            pokemon.markMove(move.name, 0);
            break;
        case 'healblock':
            this.message('' + pokemon.getName() + ' can\'t use ' + move.name + ' because of Heal Block!');
            pokemon.markMove(move.name, 0);
            break;
        case 'imprison':
            this.message('' + pokemon.getName() + ' can\'t use its sealed ' + move.name + '!');
            pokemon.markMove(move.name, 0);
            break;
        case 'throatchop':
            this.message('The effects of Throat Chop prevent ' + pokemon.getName() + ' from using certain moves!');
            break;
        case 'par':
            this.message('' + pokemon.getName() + ' is paralyzed! It can\'t move!');
            break;
        case 'frz':
            this.message('' + pokemon.getName() + ' is frozen solid!');
            break;
        case 'slp':
            pokemon.statusData.sleepTurns++;
            this.message('' + pokemon.getName() + ' is fast asleep.');
            break;
        case 'skydrop':
            this.message('Sky Drop won\'t let ' + pokemon.getLowerName() + ' go!');
            break;
        case 'damp':
        case 'dazzling':
        case 'queenlymajesty':
            let ofpoke = this.getPokemon(kwargs.of);
            this.message(ofpoke.getName() + ' cannot use ' + move.name + '!');
            break;
        case 'truant':
            this.message('' + pokemon.getName() + ' is loafing around!');
            break;
        case 'recharge':
            this.message('<small>' + pokemon.getName() + ' must recharge!</small>');
            break;
        case 'focuspunch':
            this.message(pokemon.getName() + ' lost its focus and couldn\'t move!');
            pokemon.removeTurnstatus('focuspunch');
            break;
        case 'shelltrap':
            this.message(pokemon.getName() + '\'s shell trap didn\'t work!');
            pokemon.removeTurnstatus('shelltrap');
            break;
        case 'flinch':
            this.message(pokemon.getName() + ' flinched and couldn\'t move!');
            pokemon.removeTurnstatus('focuspunch');
            break;
        case 'attract':
            this.message(pokemon.getName() + ' is immobilized by love!');
            break;
        case 'nopp':
            this.message(pokemon.getName() + ' used <strong>' + move.name + '</strong>!');
            this.message('But there was no PP left for the move!');
            break;
        default:
            this.message('<small>' + pokemon.getName() + (move.name ? ' can\'t use ' + move.name + '' : ' can\'t move') + '!</small>');
            break;
        }
    }
    runMinor(args, kwargs, preempt, nextArgs, nextKwargs) {
        let actions = '';
        let minors = this.minorQueue;
        if (args && kwargs && nextArgs && nextKwargs) {
            if (args[2] === 'Sturdy' && args[0] === '-activate') {
                args[2] = 'ability: Sturdy';
            }
            if (args[0] === '-crit' || args[0] === '-supereffective' || args[0] === '-resisted' || args[2] === 'ability: Sturdy') {
                kwargs.then = '.';
            }
            if (args[0] === '-damage' && !kwargs.from && args[1] !== nextArgs[1] && (nextArgs[0] === '-crit' || nextArgs[0] === '-supereffective' || nextArgs[0] === '-resisted' || (nextArgs[0] === '-damage' && !nextKwargs.from))) {
                kwargs.then = '.';
            }
            if (args[0] === '-damage' && nextArgs[0] === '-damage' && kwargs.from && kwargs.from === nextKwargs.from) {
                kwargs.then = '.';
            }
            if (args[0] === '-ability' && (args[2] === 'Intimidate' || args[3] === 'boost')) {
                kwargs.then = '.';
            }
            if (args[0] === '-unboost' && nextArgs[0] === '-unboost') {
                kwargs.then = '.';
            }
            if (args[0] === '-boost' && nextArgs[0] === '-boost') {
                kwargs.then = '.';
            }
            if (args[0] === '-damage' && kwargs.from === 'Leech Seed' && nextArgs[0] === '-heal' && nextKwargs.silent) {
                kwargs.then = '.';
            }
            minors.push([args, kwargs]);
            if (kwargs.simult || kwargs.then) {
                return;
            }
        }
        while (minors.length) {
            let row = minors.shift();
            args = row[0];
            kwargs = row[1];
            switch (args[0]) {
            case '-center': {
                actions += 'Automatic center!';
                break;
            }
            case '-damage': {
                let poke = this.getPokemon(args[1]);
                let damage = poke.healthParse(args[2], true);
                if (damage === null) {
                    break;
                }
                let range = poke.getDamageRange(damage);
                if (kwargs.silent) {
                    // do nothing
                } else if (kwargs.from) {
                    let effect = Tools.getEffect(kwargs.from);
                    let ofpoke = this.getPokemon(kwargs.of);
                    if (effect.effectType === 'Ability' && ofpoke) {
                        this.message('', '<small>[' + ofpoke.getName(true) + '\'s ' + effect.name + '!]</small>');
                        ofpoke.markAbility(effect.name);
                    } else if (effect.effectType === 'Item') {
                        (ofpoke || poke).item = effect.name;
                    }
                    switch (effect.id) {
                    case 'stealthrock':
                        actions += 'Pointed stones dug into ' + poke.getLowerName() + '! ';
                        break;
                    case 'spikes':
                        actions += '' + poke.getName() + ' is hurt by the spikes! ';
                        break;
                    case 'brn':
                        actions += '' + poke.getName() + ' was hurt by its burn! ';
                        break;
                    case 'psn':
                        actions += '' + poke.getName() + ' was hurt by poison! ';
                        break;
                    case 'lifeorb':
                        this.message('', '<small>' + poke.getName() + ' lost some of its HP!</small>');
                        break;
                    case 'recoil':
                        actions += '' + poke.getName() + ' is damaged by the recoil! ';
                        break;
                    case 'sandstorm':
                        actions += '' + poke.getName() + ' is buffeted by the sandstorm! ';
                        break;
                    case 'hail':
                        actions += '' + poke.getName() + ' is buffeted by the hail! ';
                        break;
                    case 'baddreams':
                        actions += '' + poke.getName() + ' is tormented!';
                        break;
                    case 'curse':
                        actions += '' + poke.getName() + ' is afflicted by the curse! ';
                        break;
                    case 'nightmare':
                        actions += '' + poke.getName() + ' is locked in a nightmare! ';
                        break;
                    case 'roughskin':
                    case 'ironbarbs':
                    case 'spikyshield':
                        actions += '' + poke.getName() + ' was hurt! ';
                        break;
                    case 'innardsout':
                    case 'aftermath':
                        actions += '' + poke.getName() + ' is hurt! ';
                        break;
                    case 'liquidooze':
                        actions += '' + poke.getName() + ' sucked up the liquid ooze! ';
                        break;
                    case 'dryskin':
                    case 'solarpower':
                        break;
                    case 'confusion':
                        actions += 'It hurt itself in its confusion! ';
                        this.hasPreMoveMessage = false;
                        break;
                    case 'leechseed':
                        actions += '' + poke.getName() + '\'s health is sapped by Leech Seed! ';
                        break;
                    case 'flameburst':
                        actions += 'The bursting flame hit ' + poke.getLowerName() + '! ';
                        break;
                    case 'firepledge':
                        actions += '' + poke.getName() + ' is hurt by the sea of fire! ';
                        break;
                    case 'jumpkick':
                    case 'highjumpkick':
                        actions += '' + poke.getName() + ' kept going and crashed!';
                        break;
                    case 'bind':
                    case 'wrap':
                        actions += '' + poke.getName() + ' is hurt by ' + effect.name + '!';
                        break;
                    default:
                        if (ofpoke) {
                            actions += '' + poke.getName() + ' is hurt by ' + ofpoke.getLowerName() + '\'s ' + effect.name + '! ';
                        } else if (effect.effectType === 'Item') {
                            actions += '' + poke.getName() + ' is hurt by its ' + effect.name + '! ';
                        } else if (effect.effectType === 'Ability') {
                            actions += '' + poke.getName() + ' is hurt by its ' + effect.name + '! ';
                        } else if (kwargs.partiallytrapped) {
                            actions += '' + poke.getName() + ' is hurt by ' + effect.name + '! ';
                        } else {
                            actions += '' + poke.getName() + ' lost some HP because of ' + effect.name + '! ';
                        }
                        break;
                    }
                } else {
                    let damageinfo = '' + poke.getFormattedRange(range, damage[1] === 100 ? 0 : 1, '–');
                    if (damage[1] !== 100) {
                        let hover = '' + ((damage[0] < 0) ? '&minus;' : '') +
                                Math.abs(damage[0]) + '/' + damage[1];
                        if (damage[1] === 48) { // this is a hack
                            hover += ' pixels';
                        }
                        damageinfo = '<abbr title="' + hover + '">' + damageinfo + '</abbr>';
                    }
                    let hiddenactions = '<small>' + poke.getName() + ' lost ' + damageinfo + ' of its health!</small><br />';
                    this.message(actions ? '<small>' + actions + '</small>' : '', hiddenactions);
                    actions = '';
                }
                break;
            }
            case '-heal': {
                let poke = this.getPokemon(args[1]);
                let damage = poke.healthParse(args[2], true, true);
                if (damage === null) {
                    break;
                }
                let range = poke.getDamageRange(damage);
                if (kwargs.silent) {
                    // do nothing
                } else if (kwargs.from) {
                    let effect = Tools.getEffect(kwargs.from);
                    let ofpoke = this.getPokemon(kwargs.of);
                    if (effect.effectType === 'Ability') {
                        this.message('', '<small>[' + poke.getName(true) + '\'s ' + effect.name + '!]</small>');
                        poke.markAbility(effect.name);
                    }
                    switch (effect.id) {
                    case 'memento':
                    case 'partingshot':
                        actions += '' + poke.getName() + '\'s HP was restored by the Z-Power!';
                        break;
                    case 'ingrain':
                        actions += '' + poke.getName() + ' absorbed nutrients with its roots!';
                        break;
                    case 'aquaring':
                        actions += 'A veil of water restored ' + poke.getLowerName() + '\'s HP!';
                        break;
                    case 'healingwish':
                        actions += 'The healing wish came true for ' + poke.getLowerName() + '!';
                        this.lastMove = 'healing-wish';
                        poke.side.wisher = null;
                        break;
                    case 'lunardance':
                        actions += '' + poke.getName() + ' became cloaked in mystical moonlight!';
                        this.lastMove = 'healing-wish';
                        for (let trackedMove of poke.moveTrack) {
                            trackedMove[1] = 0;
                        }
                        poke.side.wisher = null;
                        break;
                    case 'wish':
                        actions += '' + kwargs.wisher + '\'s wish came true!';
                        break;
                    case 'drain':
                        actions += ofpoke.getName() + ' had its energy drained!';
                        break;
                    case 'leftovers':
                    case 'shellbell':
                    case 'blacksludge':
                        poke.item = effect.name;
                        actions += '' + poke.getName() + ' restored a little HP using its ' + effect.name + '!';
                        break;
                    default:
                        if (kwargs.absorb) {
                            actions += '' + poke.getName() + '\'s ' + effect.name + ' absorbs the attack!';
                        } else if (effect.id && effect.effectType !== 'Ability') {
                            actions += '' + poke.getName() + ' restored HP using its ' + effect.name + '!';
                        } else {
                            actions += poke.getName() + ' restored its HP.';
                        }
                        break;
                    }
                } else if (kwargs.zeffect) {
                    actions += '' + poke.getName() + ' restored its HP using its Z-Power!';
                } else {
                    actions += poke.getName() + ' restored its HP.';
                }
                break;
            }
            case '-sethp': {
                let effect = Tools.getEffect(kwargs.from);
                let poke; let ofpoke;
                for (let k = 0; k < 2; k++) {
                    let cpoke = this.getPokemon(args[1 + 2 * k]);
                    if (cpoke) {
                        let damage = cpoke.healthParse(args[2 + 2 * k]);
                        let range = cpoke.getDamageRange(damage);
                        let formattedRange = cpoke.getFormattedRange(range, 0, ' to ');
                        let diff = damage[0];
                    }
                    if (k == 0) {
                        poke = cpoke;
                    }
                    if (k == 1) {
                        ofpoke = cpoke;
                    }
                }
                switch (effect.id) {
                case 'painsplit':
                    actions += 'The battlers shared their pain!';
                    break;
                }
                break;
            }
            case '-boost': {
                let poke = this.getPokemon(args[1]);
                let stat = args[2];
                if (this.gen === 1 && stat === 'spd') {
                    break;
                }
                if (this.gen === 1 && stat === 'spa') {
                    stat = 'spc';
                }
                let amount = parseInt(args[3], 10);
                if (amount === 0) {
                    actions += '' + poke.getName() + '\'s ' + BattleStats[stat] + ' won\'t go any higher! ';
                    break;
                }
                if (!poke.boosts[stat]) {
                    poke.boosts[stat] = 0;
                }
                poke.boosts[stat] += amount;
                let amountString = '';
                if (amount === 2) {
                    amountString = ' sharply';
                }
                if (amount >= 3) {
                    amountString = ' drastically';
                }
                if (kwargs.silent) {
                    // do nothing
                } else if (kwargs.from) {
                    let effect = Tools.getEffect(kwargs.from);
                    let ofpoke = this.getPokemon(kwargs.of);
                    if (effect.effectType === 'Ability' && !(effect.id === 'weakarmor' && stat === 'spe')) {
                        this.message('', '<small>[' + (ofpoke || poke).getName(true) + '\'s ' + effect.name + '!]</small>');
                        poke.markAbility(effect.name);
                    }
                    switch (effect.id) {
                    default:
                        if (effect.effectType === 'Ability') {
                            actions += '' + poke.getName() + '\'s ' + BattleStats[stat] + ' rose' + amountString + '! ';
                        }
                        if (effect.effectType === 'Item') {
                            actions += 'The ' + effect.name + amountString + ' raised ' + poke.getLowerName() + '\'s ' + BattleStats[stat] + '! ';
                        }
                        break;
                    }
                } else if (kwargs.zeffect) {
                    if (minors.length && minors[0][1].zeffect) {
                        actions += '' + poke.getName() + ' boosted its stats' + amountString + ' using its Z-Power! ';
                        for (let i = 0; i < minors.length; i++) {
                            minors[i][1].silent = '.';
                        }
                    } else {
                        actions += '' + poke.getName() + ' boosted its ' + BattleStats[stat] + amountString + ' using its Z-Power! ';
                    }
                } else {
                    actions += '' + poke.getName() + '\'s ' + BattleStats[stat] + ' rose' + amountString + '! ';
                }
                break;
            }
            case '-unboost': {
                let poke = this.getPokemon(args[1]);
                let stat = args[2];
                if (this.gen === 1 && stat === 'spd') {
                    break;
                }
                if (this.gen === 1 && stat === 'spa') {
                    stat = 'spc';
                }
                let amount = parseInt(args[3], 10);
                if (amount === 0) {
                    actions += '' + poke.getName() + '\'s ' + BattleStats[stat] + ' won\'t go any lower! ';
                    break;
                }
                if (!poke.boosts[stat]) {
                    poke.boosts[stat] = 0;
                }
                poke.boosts[stat] -= amount;
                let amountString = '';
                if (amount === 2) {
                    amountString = ' harshly';
                }
                if (amount >= 3) {
                    amountString = ' severely';
                }
                if (kwargs.silent) {
                    // do nothing
                } else if (kwargs.from) {
                    let effect = Tools.getEffect(kwargs.from);
                    let ofpoke = this.getPokemon(kwargs.of);
                    if (effect.effectType === 'Ability') {
                        this.message('', '<small>[' + (ofpoke || poke).getName(true) + '\'s ' + effect.name + '!]</small>');
                        poke.markAbility(effect.name);
                    }
                    switch (effect.id) {
                    default:
                        if (effect.effectType === 'Ability') {
                            actions += '' + poke.getName() + '\'s ' + BattleStats[stat] + ' fell' + amountString + '! ';
                        }
                        if (effect.effectType === 'Item') {
                            actions += 'The ' + effect.name + amountString + ' lowered ' + poke.getLowerName() + '\'s ' + BattleStats[stat] + '! ';
                        }
                        break;
                    }
                } else {
                    actions += '' + poke.getName() + '\'s ' + BattleStats[stat] + ' fell' + amountString + '! ';
                }
                break;
            }
            case '-setboost': {
                let poke = this.getPokemon(args[1]);
                let stat = args[2];
                let amount = parseInt(args[3], 10);
                let effect = Tools.getEffect(kwargs.from);
                let ofpoke = this.getPokemon(kwargs.of);
                poke.boosts[stat] = amount;
                if (kwargs.silent) {
                    // do nothing
                } else if (kwargs.from) {
                    switch (effect.id) {
                    case 'bellydrum':
                        actions += '' + poke.getName() + ' cut its own HP and maximized its Attack!';
                        break;
                    case 'angerpoint':
                        this.message('', '<small>[' + poke.getName(true) + '\'s Anger Point!]</small>');
                        poke.markAbility('Anger Point');
                        actions += '' + poke.getName() + ' maxed its Attack!';
                        break;
                    }
                }
                break;
            }
            case '-swapboost': {
                let poke = this.getPokemon(args[1]);
                let poke2 = this.getPokemon(args[2]);
                let stats = args[3] ? args[3].split(', ') : ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
                let effect = Tools.getEffect(kwargs.from);
                for (let i = 0; i < stats.length; i++) {
                    let tmp = poke.boosts[stats[i]];
                    poke.boosts[stats[i]] = poke2.boosts[stats[i]];
                    if (!poke.boosts[stats[i]]) {
                        delete poke.boosts[stats[i]];
                    }
                    poke2.boosts[stats[i]] = tmp;
                    if (!poke2.boosts[stats[i]]) {
                        delete poke2.boosts[stats[i]];
                    }
                }
                if (kwargs.silent) {
                    // do nothing
                } else if (effect.id) {
                    switch (effect.id) {
                    case 'guardswap':
                        actions += '' + poke.getName() + ' switched all changes to its Defense and Sp. Def with its target!';
                        break;
                    case 'heartswap':
                        actions += '' + poke.getName() + ' switched stat changes with its target!';
                        break;
                    case 'powerswap':
                        actions += '' + poke.getName() + ' switched all changes to its Attack and Sp. Atk with its target!';
                        break;
                    }
                }
                break;
            }
            case '-clearpositiveboost': {
                let poke = this.getPokemon(args[1]);
                let ofpoke = this.getPokemon(args[2]);
                let effect = Tools.getEffect(args[3]);
                for (const stat in poke.boosts) {
                    if (poke.boosts[stat] > 0) {
                        delete poke.boosts[stat];
                    }
                }
                if (kwargs.silent) {
                    // do nothing
                } else if (effect.id) {
                    switch (effect.id) {
                    case 'spectralthief':
                        // todo: update StealBoosts so it animates 1st on Spectral Thief
                        actions += '' + ofpoke.getName() + ' stole the target\'s boosted stats!';
                        break;
                    }
                }
                break;
            }
            case '-clearnegativeboost': {
                let poke = this.getPokemon(args[1]);
                for (const stat in poke.boosts) {
                    if (poke.boosts[stat] < 0) {
                        delete poke.boosts[stat];
                    }
                }
                if (kwargs.silent) {
                    // do nothing
                } else if (kwargs.zeffect) {
                    actions += '' + poke.getName() + ' returned its decreased stats to normal using its Z-Power!';
                    break;
                }
                break;
            }
            case '-copyboost': {
                let poke = this.getPokemon(args[1]);
                let frompoke = this.getPokemon(args[2]);
                let stats = args[3] ? args[3].split(', ') : ['atk', 'def', 'spa', 'spd', 'spe', 'accuracy', 'evasion'];
                let effect = Tools.getEffect(kwargs.from);
                for (let i = 0; i < stats.length; i++) {
                    poke.boosts[stats[i]] = frompoke.boosts[stats[i]];
                    if (!poke.boosts[stats[i]]) {
                        delete poke.boosts[stats[i]];
                    }
                }
                // poke.boosts = {...frompoke.boosts};
                if (kwargs.silent) {
                    // do nothing
                } else {
                    actions += '' + poke.getName() + ' copied ' + frompoke.getLowerName() + '\'s stat changes!';
                }
                break;
            }
            case '-clearboost': {
                let poke = this.getPokemon(args[1]);
                poke.boosts = {};
                if (kwargs.silent) {
                    // do nothing
                } else {
                    actions += '' + poke.getName() + '\'s stat changes were removed!';
                }
                break;
            }
            case '-invertboost': {
                let poke = this.getPokemon(args[1]);
                for (const stat in poke.boosts) {
                    poke.boosts[stat] = -poke.boosts[stat];
                }
                if (kwargs.silent) {
                    // do nothing
                } else {
                    actions += '' + poke.getName() + '\'s stat changes were inverted!';
                }
                break;
            }
            case '-clearallboost': {
                for (const side of this.sides) {
                    for (const active of side.active) {
                        if (active) {
                            active.boosts = {};
                        }
                    }
                }
                if (kwargs.silent) {
                    // do nothing
                } else {
                    actions += 'All stat changes were eliminated!';
                }
                break;
            }
            case '-crit': {
                let poke = this.getPokemon(args[1]);
                for (let j = 1; !poke && j < 10; j++) {
                    poke = this.getPokemon(minors[j][0][1]);
                }
                if (poke) {
                    actions += 'A critical hit' + (poke && this.activeMoveIsSpread ? ' on ' + poke.getLowerName() : '') + '! ';
                }
                break;
            }
            case '-supereffective': {
                let poke = this.getPokemon(args[1]);
                for (let j = 1; !poke && j < 10; j++) {
                    poke = this.getPokemon(minors[j][0][1]);
                }
                actions += 'It\'s super effective' + (poke && this.activeMoveIsSpread ? ' on ' + poke.getLowerName() : '') + '! ';
                break;
            }
            case '-resisted': {
                let poke = this.getPokemon(args[1]);
                for (let j = 1; !poke && j < 10; j++) {
                    poke = this.getPokemon(minors[j][0][1]);
                }
                if (poke) {
                    actions += 'It\'s not very effective' + (poke && this.activeMoveIsSpread ? ' on ' + poke.getLowerName() : '..') + '. ';
                }
                break;
            }
            case '-immune': {
                let poke = this.getPokemon(args[1]);
                let effect = Tools.getEffect(args[2]);
                let fromeffect = Tools.getEffect(kwargs.from);
                if (fromeffect && fromeffect.effectType === 'Ability') {
                    let ofpoke = this.getPokemon(kwargs.of) || poke;
                    this.message('', '<small>[' + ofpoke.getName(true) + '\'s ' + fromeffect.name + '!]</small>');
                    ofpoke.markAbility(fromeffect.name);
                }
                if (effect.id == 'confusion') {
                    actions += '' + poke.getName() + ' doesn\'t become confused! ';
                } else if (kwargs.msg) {
                    actions += 'It doesn\'t affect ' + poke.getLowerName() + '... ';
                } else if (kwargs.ohko) {
                    actions += '' + poke.getName() + ' is unaffected! ';
                } else {
                    actions += 'It had no effect! ';
                }
                break;
            }
            case '-miss': {
                let user = this.getPokemon(args[1]);
                let target = this.getPokemon(args[2]);
                if (target) {
                    actions += '' + target.getName() + ' avoided the attack!';
                } else {
                    actions += '' + user.getName() + '\'s attack missed!';
                }
                break;
            }
            case '-fail': {
                let poke = this.getPokemon(args[1]);
                let effect = Tools.getEffect(args[2]);
                let fromeffect = Tools.getEffect(kwargs.from);
                let ofpoke = this.getPokemon(kwargs.of);
                // Sky Drop blocking moves takes priority over all other moves
                if (fromeffect.id === 'skydrop') {
                    actions += 'Sky Drop won\'t let ' + poke.getLowerName() + ' go!';
                    break;
                }
                switch (effect.id) {
                case 'brn':
                    actions += '' + poke.getName() + ' already has a burn.';
                    break;
                case 'tox':
                case 'psn':
                    actions += '' + poke.getName() + ' is already poisoned.';
                    break;
                case 'slp':
                    if (fromeffect.id === 'uproar') {
                        if (kwargs.msg) {
                            actions += 'But ' + poke.getLowerName() + ' can\'t sleep in an uproar!';
                        } else {
                            actions += 'But the uproar kept ' + poke.getLowerName() + ' awake!';
                        }
                    } else {
                        actions += '' + poke.getName() + ' is already asleep!';
                    }
                    break;
                case 'par':
                    actions += '' + poke.getName() + ' is already paralyzed.';
                    break;
                case 'frz':
                    actions += '' + poke.getName() + ' is already frozen solid!';
                    break;
                case 'darkvoid':
                case 'hyperspacefury':
                    if (kwargs.forme) {
                        actions += 'But ' + poke.getLowerName() + ' can\'t use it the way it is now!';
                    } else {
                        actions += 'But ' + poke.getLowerName() + ' can\'t use the move!';
                    }
                    break;
                case 'magikarpsrevenge':
                    actions += 'But ' + poke.getLowerName() + ' can\'t use the move!';
                    break;
                case 'substitute':
                    if (kwargs.weak) {
                        actions += 'But it does not have enough HP left to make a substitute!';
                    } else {
                        actions += '' + poke.getName() + ' already has a substitute!';
                    }
                    break;
                case 'skydrop':
                    if (kwargs.heavy) {
                        actions += '' + poke.getName() + ' is too heavy to be lifted!';
                    } else {
                        actions += 'But it failed!';
                    }
                    break;
                case 'sunnyday':
                case 'raindance':
                case 'sandstorm':
                case 'hail':
                    switch (fromeffect.id) {
                    case 'desolateland':
                        actions += 'The extremely harsh sunlight was not lessened at all!';
                        break;
                    case 'primordialsea':
                        actions += 'There is no relief from this heavy rain!';
                        break;
                    case 'deltastream':
                        actions += 'The mysterious strong winds blow on regardless!';
                        break;
                    default:
                        actions += 'But it failed!';
                    }
                    break;
                case 'unboost':
                    if (fromeffect.effectType === 'Ability') {
                        this.message('', '<small>[' + poke.getName(true) + '\'s ' + fromeffect.name + '!]</small>');
                        poke.markAbility(fromeffect.name);
                    }
                    switch (fromeffect.id) {
                    case 'flowerveil':
                        actions += '' + ofpoke.getName() + ' surrounded itself with a veil of petals!';
                        break;
                    default:
                        let stat = Tools.escapeHTML(args[3]);
                        actions += '' + poke.getName() + '\'s ' + (stat ? stat + ' was' : 'stats were') + ' not lowered!';
                    }
                    break;
                default:
                    switch (fromeffect.id) {
                    case 'desolateland':
                        actions += 'The Water-type attack evaporated in the harsh sunlight!';
                        break;
                    case 'primordialsea':
                        actions += 'The Fire-type attack fizzled out in the heavy rain!';
                        break;
                    default:
                        actions += 'But it failed!';
                    }
                    break;
                }
                break;
            }
            case '-notarget': {
                if (this.gen >= 5) {
                    actions += 'But it failed!';
                } else {
                    actions += 'But there was no target...';
                }
                break;
            }
            case '-ohko': {
                actions += 'It\'s a one-hit KO!';
                break;
            }
            case '-hitcount': {
                let hits = parseInt(args[2], 10);
                actions += 'Hit ' + hits + (hits > 1 ? ' times!' : ' time!');
                break;
            }
            case '-nothing': {
                actions += 'But nothing happened! ';
                break;
            }
            case '-waiting': {
                let poke = this.getPokemon(args[1]);
                let ofpoke = this.getPokemon(args[2]);
                actions += '' + poke.getName() + ' is waiting for ' + ofpoke.getLowerName() + '\'s move...';
                break;
            }
            case '-combine': {
                actions += 'The two moves have become one! It\'s a combined move!';
                break;
            }
            case '-zpower': {
                if (!this.hasPreMoveMessage && this.waitForResult()) {
                    return;
                }
                let poke = this.getPokemon(args[1]);
                actions += '' + poke.getName() + ' surrounded itself with its Z-Power! ';
                this.hasPreMoveMessage = true;
                break;
            }
            case '-zbroken': {
                let poke = this.getPokemon(args[1]);
                actions += '' + poke.getName() + ' couldn\'t fully protect itself and got hurt!';
                break;
            }
            case '-prepare': {
                let poke = this.getPokemon(args[1]);
                let moveid = toId(args[2]);
                let target = this.getPokemon(args[3]) || poke.side.foe.active[0] || poke;
                break;
            }
            case '-mustrecharge': {
                let poke = this.getPokemon(args[1]);
                poke.addMovestatus('mustrecharge');
                break;
            }
            case '-status': {
                let poke = this.getPokemon(args[1]);
                let effect = Tools.getEffect(kwargs.from);
                let ofpoke = this.getPokemon(kwargs.of) || poke;
                poke.status = args[2];
                poke.removeVolatile('yawn');
                let effectMessage = '';
                if (effect.effectType === 'Ability') {
                    this.message('', '<small>[' + ofpoke.getName(true) + '\'s ' + effect.name + '!]</small>');
                    ofpoke.markAbility(effect.name);
                } else if (effect.effectType === 'Item') {
                    ofpoke.item = effect.name;
                    effectMessage = ' by the ' + effect.name;
                }
                switch (args[2]) {
                case 'brn':
                    actions += '' + poke.getName() + ' was burned' + effectMessage + '!';
                    break;
                case 'tox':
                    poke.statusData.toxicTurns = 1;
                    actions += '' + poke.getName() + ' was badly poisoned' + effectMessage + '!';
                    break;
                case 'psn':
                    actions += '' + poke.getName() + ' was poisoned!';
                    break;
                case 'slp':
                    if (effect.id === 'rest') {
                        poke.statusData.sleepTurns = 0; // for Gen 2 use through Sleep Talk
                        actions += '' + poke.getName() + ' slept and became healthy!';
                    } else {
                        actions += '' + poke.getName() + ' fell asleep!';
                    }
                    break;
                case 'par':
                    actions += '' + poke.getName() + ' is paralyzed! It may be unable to move!';
                    break;
                case 'frz':
                    actions += '' + poke.getName() + ' was frozen solid!';
                    break;
                default:
                    break;
                }
                break;
            }
            case '-curestatus': {
                let poke = this.getPokemon(args[1]);
                let effect = Tools.getEffect(kwargs.from);
                let ofpoke = this.getPokemon(kwargs.of);
                let pokeName; let pokeSideN;
                if (poke) {
                    poke.status = '';
                    pokeName = poke.getName();
                    pokeSideN = poke.side.n;
                } else {
                    let parseIdResult = this.parsePokemonId(args[1]);
                    pokeName = parseIdResult.name;
                    pokeSideN = parseIdResult.siden;
                }
                if (args[2] === 'slp') {
                    poke.statusData.sleepTurns = 0;
                }
                if (effect.id === 'naturalcure' && !this.hasPreMoveMessage && this.waitForResult()) {
                    return;
                }
                if (kwargs.silent) {
                    // do nothing
                } else if (effect.id) {
                    switch (effect.id) {
                    case 'psychoshift':
                        actions += '' + pokeName + ' moved its status onto ' + ofpoke.getLowerName() + '!';
                        break;
                    case 'flamewheel':
                    case 'flareblitz':
                    case 'fusionflare':
                    case 'sacredfire':
                    case 'scald':
                    case 'steameruption':
                        actions += '' + pokeName + '\'s ' + effect.name + ' melted the ice!';
                        break;
                    case 'naturalcure':
                        actions += '(' + pokeName + '\'s Natural Cure activated!)';
                        if (poke) {
                            poke.markAbility('Natural Cure');
                        }
                        this.hasPreMoveMessage = true;
                        break;
                    default:
                        actions += '' + pokeName + '\'s ' + effect.name + ' heals its status!';
                        break;
                    }
                } else {
                    switch (args[2]) {
                    case 'brn':
                        if (effect.effectType === 'Item') {
                            actions += '' + pokeName + '\'s ' + effect.name + ' healed its burn!';
                            break;
                        }
                        if (pokeSideN === 0) {
                            actions += '' + pokeName + '\'s burn was healed.';
                        } else {
                            actions += '' + pokeName + ' healed its burn!';
                        }
                        break;
                    case 'tox':
                        if (poke) {
                            poke.statusData.toxicTurns = 0;
                        }
                        // falls through
                    case 'psn':
                        if (effect.effectType === 'Item') {
                            actions += '' + pokeName + '\'s ' + effect.name + ' cured its poison!';
                            break;
                        }
                        actions += '' + pokeName + ' was cured of its poisoning.';
                        break;
                    case 'slp':
                        if (poke) {
                            poke.statusData.sleepTurns = 0;
                        }
                        if (effect.effectType === 'Item') {
                            actions += '' + pokeName + '\'s ' + effect.name + ' woke it up!';
                            break;
                        }
                        actions += '' + pokeName + ' woke up!';
                        break;
                    case 'par':
                        if (effect.effectType === 'Item') {
                            actions += '' + pokeName + '\'s ' + effect.name + ' cured its paralysis!';
                            break;
                        }
                        actions += '' + pokeName + ' was cured of paralysis.';
                        break;
                    case 'frz':
                        if (effect.effectType === 'Item') {
                            actions += '' + pokeName + '\'s ' + effect.name + ' defrosted it!';
                            break;
                        }
                        actions += '' + pokeName + ' thawed out!';
                        break;
                    default:
                        if (poke) {
                            poke.removeVolatile('confusion');
                        }
                        actions += '' + pokeName + '\'s status cleared!';
                    }
                }
                break;
            }
            case '-cureteam': { // For old gens when the whole team was always cured
                let poke = this.getPokemon(args[1]);
                for (const target of poke.side.pokemon) {
                    target.status = '';
                }
                let effect = Tools.getEffect(kwargs.from);
                switch (effect.id) {
                case 'aromatherapy':
                    actions += 'A soothing aroma wafted through the area!';
                    break;
                case 'healbell':
                    actions += 'A bell chimed!';
                    break;
                default:
                    actions += '' + poke.getName() + '\'s team was cured!';
                    break;
                }
                break;
            }
            case '-item': {
                let poke = this.getPokemon(args[1]);
                let item = Tools.getItem(args[2]);
                let effect = Tools.getEffect(kwargs.from);
                let ofpoke = this.getPokemon(kwargs.of);
                poke.item = item.name;
                poke.itemEffect = '';
                poke.removeVolatile('airballoon');
                if (item.id === 'airballoon') {
                    poke.addVolatile('airballoon');
                }
                if (effect.id) {
                    switch (effect.id) {
                    case 'pickup':
                        this.message('', '<small>[' + poke.getName(true) + '\'s Pickup!]</small>');
                        poke.markAbility('Pickup');
                        // falls through
                    case 'recycle':
                        poke.itemEffect = 'found';
                        actions += '' + poke.getName() + ' found one ' + item.name + '!';
                        break;
                    case 'frisk':
                        this.message('', '<small>[' + ofpoke.getName(true) + '\'s Frisk!]</small>');
                        ofpoke.markAbility('Frisk');
                        if (kwargs.identify) { // used for gen 6
                            poke.itemEffect = 'frisked';
                            actions += '' + ofpoke.getName() + ' frisked ' + poke.getLowerName() + ' and found its ' + item.name + '!';
                        } else {
                            actions += '' + ofpoke.getName() + ' frisked its target and found one ' + item.name + '!';
                        }
                        break;
                    case 'magician':
                    case 'pickpocket':
                        this.message('', '<small>[' + poke.getName(true) + '\'s ' + effect.name + '!]</small>');
                        poke.markAbility(effect.name);
                        // falls through
                    case 'thief':
                    case 'covet':
                        // simulate the removal of the item from the ofpoke
                        ofpoke.item = '';
                        ofpoke.itemEffect = '';
                        ofpoke.prevItem = item.name;
                        ofpoke.prevItemEffect = 'stolen';
                        ofpoke.addVolatile('itemremoved');
                        poke.itemEffect = 'stolen';
                        actions += '' + poke.getName() + ' stole ' + ofpoke.getLowerName() + '\'s ' + item.name + '!';
                        break;
                    case 'harvest':
                        poke.itemEffect = 'harvested';
                        this.message('', '<small>[' + poke.getName(true) + '\'s Harvest!]</small>');
                        poke.markAbility('Harvest');
                        actions += '' + poke.getName() + ' harvested one ' + item.name + '!';
                        break;
                    case 'bestow':
                        poke.itemEffect = 'bestowed';
                        actions += '' + poke.getName() + ' received ' + item.name + ' from ' + ofpoke.getLowerName() + '!';
                        break;
                    case 'trick':
                        poke.itemEffect = 'tricked';
                        // falls through
                    default:
                        actions += '' + poke.getName() + ' obtained one ' + item.name + '.';
                        break;
                    }
                } else {
                    switch (item.id) {
                    case 'airballoon':
                        actions += '' + poke.getName() + ' floats in the air with its Air Balloon!';
                        break;
                    default:
                        actions += '' + poke.getName() + ' has ' + item.name + '!';
                        break;
                    }
                }
                break;
            }
            case '-enditem': {
                let poke = this.getPokemon(args[1]);
                let item = Tools.getItem(args[2]);
                let effect = Tools.getEffect(kwargs.from);
                let ofpoke = this.getPokemon(kwargs.of);
                poke.item = '';
                poke.itemEffect = '';
                poke.prevItem = item.name;
                poke.prevItemEffect = '';
                poke.removeVolatile('airballoon');
                poke.addVolatile('itemremoved');
                if (kwargs.silent) {
                    // do nothing
                } else if (kwargs.eat) {
                    poke.prevItemEffect = 'eaten';
                    actions += '' + poke.getName() + ' ate its ' + item.name + '!';
                    this.lastMove = item.id;
                } else if (kwargs.weaken) {
                    poke.prevItemEffect = 'eaten';
                    actions += 'The ' + item.name + ' weakened the damage to ' + poke.getLowerName() + '!';
                    this.lastMove = item.id;
                } else if (effect.id) {
                    switch (effect.id) {
                    case 'fling':
                        poke.prevItemEffect = 'flung';
                        actions += '' + poke.getName() + ' flung its ' + item.name + '!';
                        break;
                    case 'knockoff':
                        poke.prevItemEffect = 'knocked off';
                        actions += '' + ofpoke.getName() + ' knocked off ' + poke.getLowerName() + '\'s ' + item.name + '!';
                        break;
                    case 'stealeat':
                        poke.prevItemEffect = 'stolen';
                        actions += '' + ofpoke.getName() + ' stole and ate its target\'s ' + item.name + '!';
                        break;
                    case 'gem':
                        poke.prevItemEffect = 'consumed';
                        actions += 'The ' + item.name + ' strengthened ' + Tools.getMove(kwargs.move).name + '\'s power!';
                        break;
                    case 'incinerate':
                        poke.prevItemEffect = 'incinerated';
                        actions += '' + poke.getName() + '\'s ' + item.name + ' was burned up!';
                        break;
                    default:
                        actions += '' + poke.getName() + ' lost its ' + item.name + '!';
                        break;
                    }
                } else {
                    switch (item.id) {
                    case 'airballoon':
                        poke.prevItemEffect = 'popped';
                        poke.removeVolatile('airballoon');
                        actions += '' + poke.getName() + '\'s Air Balloon popped!';
                        break;
                    case 'focussash':
                        poke.prevItemEffect = 'consumed';
                        actions += '' + poke.getName() + ' hung on using its Focus Sash!';
                        break;
                    case 'focusband':
                        actions += '' + poke.getName() + ' hung on using its Focus Band!';
                        break;
                    case 'powerherb':
                        poke.prevItemEffect = 'consumed';
                        actions += '' + poke.getName() + ' became fully charged due to its Power Herb!';
                        break;
                    case 'whiteherb':
                        poke.prevItemEffect = 'consumed';
                        actions += '' + poke.getName() + ' returned its status to normal using its White Herb!';
                        break;
                    case 'ejectbutton':
                        poke.prevItemEffect = 'consumed';
                        actions += '' + poke.getName() + ' is switched out with the Eject Button!';
                        break;
                    case 'redcard':
                        poke.prevItemEffect = 'held up';
                        actions += '' + poke.getName() + ' held up its Red Card against ' + ofpoke.getLowerName() + '!';
                        break;
                    default:
                        poke.prevItemEffect = 'consumed';
                        actions += '' + poke.getName() + '\'s ' + item.name + ' activated!';
                        break;
                    }
                }
                break;
            }
            case '-ability': {
                let poke = this.getPokemon(args[1]);
                let ability = Tools.getAbility(args[2]);
                let effect = Tools.getEffect(kwargs.from);
                let ofpoke = this.getPokemon(kwargs.of);
                poke.markAbility(ability.name, effect.id && !kwargs.fail);
                if (kwargs.silent) {
                    // do nothing
                } else if (effect.id) {
                    switch (effect.id) {
                    case 'trace':
                        this.message('', '<small>[' + poke.getName(true) + '\'s Trace!]</small>');
                        if (!poke.baseAbility) {
                            poke.baseAbility = effect.name;
                        }
                        ofpoke.markAbility(ability.name);
                        actions += '' + poke.getName() + ' traced ' + ofpoke.getLowerName() + '\'s ' + ability.name + '!';
                        break;
                    case 'powerofalchemy':
                    case 'receiver':
                        this.message('', '<small>[' + poke.getName(true) + '\'s ' + effect.name + '!]</small>');
                        if (!poke.baseAbility) {
                            poke.baseAbility = effect.name;
                        }
                        actions += '' + ofpoke.getName() + '\'s ' + ability.name + ' was taken over!';
                        break;
                    case 'roleplay':
                        actions += '' + poke.getName() + ' copied ' + ofpoke.getLowerName() + '\'s ' + ability.name + ' Ability!';
                        ofpoke.markAbility(ability.name);
                        break;
                    case 'desolateland':
                        if (kwargs.fail) {
                            this.message('', '<small>[' + poke.getName(true) + '\'s ' + ability.name + '!]</small>');
                            actions += 'The extremely harsh sunlight was not lessened at all!';
                        }
                        break;
                    case 'primordialsea':
                        if (kwargs.fail) {
                            this.message('', '<small>[' + poke.getName(true) + '\'s ' + ability.name + '!]</small>');
                            actions += 'There\'s no relief from this heavy rain!';
                        }
                        break;
                    case 'deltastream':
                        if (kwargs.fail) {
                            this.message('', '<small>[' + poke.getName(true) + '\'s ' + ability.name + '!]</small>');
                            actions += 'The mysterious strong winds blow on regardless!';
                        }
                        break;
                    default:
                        actions += '' + poke.getName() + ' acquired ' + ability.name + '!';
                        break;
                    }
                } else {
                    this.message('', '<small>[' + poke.getName(true) + '\'s ' + ability.name + '!]</small>');
                    switch (ability.id) {
                    case 'airlock':
                    case 'cloudnine':
                        actions += 'The effects of the weather disappeared.';
                        break;
                    case 'anticipation':
                        actions += '' + poke.getName() + ' shuddered!';
                        break;
                    case 'aurabreak':
                        actions += '' + poke.getName() + ' reversed all other Pokémon\'s auras!';
                        break;
                    case 'comatose':
                        actions += '' + poke.getName() + ' is drowsing!';
                        break;
                    case 'darkaura':
                        actions += '' + poke.getName() + ' is radiating a dark aura!';
                        break;
                    case 'fairyaura':
                        actions += '' + poke.getName() + ' is radiating a fairy aura!';
                        break;
                    case 'moldbreaker':
                        actions += '' + poke.getName() + ' breaks the mold!';
                        break;
                    case 'pressure':
                        actions += '' + poke.getName() + ' is exerting its pressure!';
                        break;
                    case 'sturdy':
                        actions += '' + poke.getName() + ' endured the hit!';
                        break;
                    case 'teravolt':
                        actions += '' + poke.getName() + ' is radiating a bursting aura!';
                        break;
                    case 'turboblaze':
                        actions += '' + poke.getName() + ' is radiating a blazing aura!';
                        break;
                    case 'unnerve':
                        actions += '' + this.getSide(args[3]).getTeamName() + ' is too nervous to eat Berries!';
                        break;
                    default:
                            // Do nothing
                    }
                }
                break;
            }
            case '-endability': {
                let poke = this.getPokemon(args[1]);
                let ability = Tools.getAbility(args[2]);
                let effect = Tools.getEffect(kwargs.from);
                poke.ability = '';
                if (kwargs.silent) {
                    // do nothing
                } else if (ability.exists) {
                    actions += '(' + poke.getName() + '\'s ' + ability.name + ' was removed.)';
                    if (!poke.baseAbility) {
                        poke.baseAbility = ability.name;
                    }
                } else {
                    actions += '' + poke.getName() + '\'s Ability was suppressed!';
                }
                break;
            }
            case '-transform': {
                let poke = this.getPokemon(args[1]);
                let tpoke = this.getPokemon(args[2]);
                let effect = Tools.getEffect(kwargs.from);
                if (!kwargs.silent && effect.effectType === 'Ability') {
                    this.message('', '<small>[' + poke.getName(true) + '\'s ' + effect.name + '!]</small>');
                    poke.markAbility(effect.name);
                }
                actions += '' + poke.getName() + ' transformed into ' + tpoke.species + '!';
                poke.boosts = {...tpoke.boosts};
                poke.copyTypesFrom(tpoke);
                poke.weightkg = tpoke.weightkg;
                poke.ability = tpoke.ability;
                const species = (tpoke.volatiles.formechange ? tpoke.volatiles.formechange[1] : tpoke.species);
                const pokemon = tpoke;
                const shiny = tpoke.shiny;
                const gender = tpoke.gender;
                poke.addVolatile('transform', pokemon, shiny, gender);
                poke.addVolatile('formechange', species);
                for (const trackedMove of tpoke.moveTrack) {
                    poke.markMove(trackedMove[0], 0);
                }
                break;
            }
            case '-formechange': {
                let poke = this.getPokemon(args[1]);
                let template = Tools.getTemplate(args[2]);
                let fromeffect = Tools.getEffect(kwargs.from);
                let isCustomAnim = false;
                poke.removeVolatile('typeadd');
                poke.removeVolatile('typechange');
                if (kwargs.silent) {
                    // do nothing
                } else {
                    if (fromeffect.effectType === 'Ability') {
                        this.message('', '<small>[' + poke.getName(true) + '\'s ' + fromeffect.name + '!]</small>');
                        poke.markAbility(fromeffect.name);
                    }
                    if (kwargs.msg) {
                        actions += '' + poke.getName() + ' transformed!';
                        if (toId(template.species) === 'shaymin') {
                            break;
                        }
                    } else if (toId(template.species) === 'darmanitanzen') {
                        actions += 'Zen Mode triggered!';
                    } else if (toId(template.species) === 'darmanitan') {
                        actions += 'Zen Mode ended!';
                    } else if (toId(template.species) === 'aegislashblade') {
                        actions += 'Changed to Blade Forme!';
                    } else if (toId(template.species) === 'aegislash') {
                        actions += 'Changed to Shield Forme!';
                    } else if (toId(template.species) === 'wishiwashischool') {
                        actions += '' + poke.getName() + ' formed a school!';
                        isCustomAnim = true;
                    } else if (toId(template.species) === 'wishiwashi') {
                        actions += '' + poke.getName() + ' stopped schooling!';
                        isCustomAnim = true;
                    } else if (toId(template.species) === 'miniormeteor') {
                        actions += 'Shields Down deactivated!';
                    } else if (toId(template.species) === 'minior') {
                        actions += 'Shields Down activated!';
                    }
                }
                poke.addVolatile('formechange', template.species); // the formechange volatile reminds us to revert the sprite change on switch-out
                break;
            }
            case '-mega': {
                let poke = this.getPokemon(args[1]);
                let item = Tools.getItem(args[3]);
                if (args[2] === 'Rayquaza') {
                    actions += '' + Tools.escapeHTML(poke.side.name) + '\'s fervent wish has reached ' + poke.getLowerName() + '!';
                } else {
                    poke.item = item.name;
                    actions += '' + poke.getName() + '\'s ' + item.name + ' is reacting to ' + (this.gen >= 7 ? 'the Key Stone' : Tools.escapeHTML(poke.side.name) + '\'s Mega Bracelet') + '!';
                }
                actions += '<br />' + poke.getName() + ' has Mega Evolved into Mega ' + args[2] + '!';
                break;
            }
            case '-primal': {
                let poke = this.getPokemon(args[1]);
                actions += '' + poke.getName() + '\'s Primal Reversion! It reverted to its primal state!';
                break;
            }
            case '-burst': {
                let poke = this.getPokemon(args[1]);
                actions += 'Bright light is about to burst out of ' + poke.getLowerName() + '!';
                break;
            }
            case '-start': {
                let poke = this.getPokemon(args[1]);
                let effect = Tools.getEffect(args[2]);
                let ofpoke = this.getPokemon(kwargs.of);
                let fromeffect = Tools.getEffect(kwargs.from);
                if (fromeffect.id === 'protean' && !this.hasPreMoveMessage && this.waitForResult()) {
                    return;
                }
                if (effect.effectType === 'Ability') {
                    this.message('', '<small>[' + poke.getName(true) + '\'s ' + effect.name + '!]</small>');
                    poke.markAbility(effect.name);
                }
                if (kwargs.silent && effect.id !== 'typechange' && effect.id !== 'typeadd') {
                    // do nothing
                } else {
                    switch (effect.id) {
                    case 'typechange':
                        const types = Tools.escapeHTML(args[3]);
                        poke.removeVolatile('typeadd');
                        poke.addVolatile('typechange', types);
                        if (kwargs.silent) {
                            break;
                        }
                        if (fromeffect.id) {
                            if (fromeffect.id === 'colorchange' || fromeffect.id === 'protean') {
                                this.message('', '<small>[' + poke.getName(true) + '\'s ' + fromeffect.name + '!]</small>');
                                poke.markAbility(fromeffect.name);
                                actions += '' + poke.getName() + ' transformed into the ' + types + ' type!';
                                this.hasPreMoveMessage = true;
                            } else if (fromeffect.id === 'reflecttype') {
                                poke.copyTypesFrom(ofpoke);
                                if (!kwargs.silent) {
                                    actions += '' + poke.getName() + '\'s type became the same as ' + ofpoke.getLowerName() + '\'s type!';
                                }
                            } else if (fromeffect.id === 'burnup') {
                                actions += '' + poke.getName() + ' burned itself out!';
                            } else if (!kwargs.silent) {
                                actions += '' + poke.getName() + '\'s ' + fromeffect.name + ' made it the ' + types + ' type!';
                            }
                        } else {
                            actions += '' + poke.getName() + ' transformed into the ' + types + ' type!';
                        }
                        break;
                    case 'typeadd':
                        const type = Tools.escapeHTML(args[3]);
                        poke.addVolatile('typeadd', type);
                        if (kwargs.silent) {
                            break;
                        }
                        actions += '' + type + ' type was added to ' + poke.getLowerName() + '!';
                        break;
                    case 'powertrick':
                        actions += '' + poke.getName() + ' switched its Attack and Defense!';
                        break;
                    case 'foresight':
                    case 'miracleeye':
                        actions += '' + poke.getName() + ' was identified!';
                        break;
                    case 'telekinesis':
                        actions += '' + poke.getName() + ' was hurled into the air!';
                        break;
                    case 'confusion':
                        if (kwargs.already) {
                            actions += '' + poke.getName() + ' is already confused!';
                        } else {
                            if (kwargs.fatigue) {
                                actions += '' + poke.getName() + ' became confused due to fatigue!';
                            } else {
                                actions += '' + poke.getName() + ' became confused!';
                            }
                        }
                        break;
                    case 'leechseed':
                        actions += '' + poke.getName() + ' was seeded!';
                        break;
                    case 'healblock':
                        actions += '' + poke.getName() + ' was prevented from healing!';
                        break;
                    case 'mudsport':
                        actions += 'Electricity\'s power was weakened!';
                        break;
                    case 'watersport':
                        actions += 'Fire\'s power was weakened!';
                        break;
                    case 'yawn':
                        actions += '' + poke.getName() + ' grew drowsy!';
                        break;
                    case 'flashfire':
                        actions += 'The power of ' + poke.getLowerName() + '\'s Fire-type moves rose!';
                        break;
                    case 'taunt':
                        actions += '' + poke.getName() + ' fell for the taunt!';
                        break;
                    case 'imprison':
                        actions += '' + poke.getName() + ' sealed any moves its target shares with it!';
                        break;
                    case 'disable':
                        if (fromeffect.effectType === 'Ability') {
                            this.message('', '<small>[' + ofpoke.getName(true) + '\'s ' + fromeffect.name + '!]</small>');
                            ofpoke.markAbility(fromeffect.name);
                        }
                        actions += '' + poke.getName() + '\'s ' + Tools.escapeHTML(args[3]) + ' was disabled!';
                        break;
                    case 'embargo':
                        actions += '' + poke.getName() + ' can\'t use items anymore!';
                        break;
                    case 'torment':
                        actions += '' + poke.getName() + ' was subjected to torment!';
                        break;
                    case 'ingrain':
                        actions += '' + poke.getName() + ' planted its roots!';
                        break;
                    case 'aquaring':
                        actions += '' + poke.getName() + ' surrounded itself with a veil of water!';
                        break;
                    case 'stockpile1':
                        actions += '' + poke.getName() + ' stockpiled 1!';
                        break;
                    case 'stockpile2':
                        poke.removeVolatile('stockpile1');
                        actions += '' + poke.getName() + ' stockpiled 2!';
                        break;
                    case 'stockpile3':
                        poke.removeVolatile('stockpile2');
                        actions += '' + poke.getName() + ' stockpiled 3!';
                        break;
                    case 'perish0':
                        poke.removeVolatile('perish1');
                        actions += '' + poke.getName() + '\'s perish count fell to 0.';
                        break;
                    case 'perish1':
                        poke.removeVolatile('perish2');
                        actions += '' + poke.getName() + '\'s perish count fell to 1.';
                        break;
                    case 'perish2':
                        poke.removeVolatile('perish3');
                        actions += '' + poke.getName() + '\'s perish count fell to 2.';
                        break;
                    case 'perish3':
                        actions += '' + poke.getName() + '\'s perish count fell to 3.';
                        break;
                    case 'encore':
                        actions += '' + poke.getName() + ' received an encore!';
                        break;
                    case 'bide':
                        actions += '' + poke.getName() + ' is storing energy!';
                        break;
                    case 'slowstart':
                        actions += '' + poke.getName() + ' can\'t get it going!';
                        break;
                    case 'attract':
                        if (fromeffect.effectType === 'Ability') {
                            this.message('', '<small>[' + ofpoke.getName(true) + '\'s ' + fromeffect.name + '!]</small>');
                            ofpoke.markAbility(fromeffect.name);
                        }
                        if (fromeffect.effectType === 'Item') {
                            actions += '' + poke.getName() + ' fell in love from the ' + fromeffect.name + '!';
                        } else {
                            actions += '' + poke.getName() + ' fell in love!';
                        }
                        break;
                    case 'autotomize':
                        actions += '' + poke.getName() + ' became nimble!';
                        break;
                    case 'focusenergy':
                        if (fromeffect.effectType === 'Item') {
                            actions += '' + poke.getName() + ' used the ' + fromeffect.name + ' to get pumped!';
                        } else if (kwargs.zeffect) {
                            actions += '' + poke.getName() + ' boosted its critical-hit ratio using its Z-Power!';
                        } else {
                            actions += '' + poke.getName() + ' is getting pumped!';
                        }
                        break;
                    case 'curse':
                        actions += '' + ofpoke.getName() + ' cut its own HP and put a curse on ' + poke.getLowerName() + '!';
                        break;
                    case 'nightmare':
                        actions += '' + poke.getName() + ' began having a nightmare!';
                        break;
                    case 'magnetrise':
                        actions += '' + poke.getName() + ' levitated with electromagnetism!';
                        break;
                    case 'smackdown':
                        actions += '' + poke.getName() + ' fell straight down!';
                        poke.removeVolatile('magnetrise');
                        poke.removeVolatile('telekinesis');
                        if (poke.lastMove === 'fly' || poke.lastMove === 'bounce') {
                            break;
                        }
                    case 'substitute':
                        if (kwargs.damage) {
                            actions += 'The substitute took damage for ' + poke.getLowerName() + '!';
                        } else if (kwargs.block) {
                            actions += 'But it failed!';
                        } else if (kwargs.already) {
                            actions += '' + poke.getName() + ' already has a substitute!';
                        } else {
                            actions += '' + poke.getName() + ' put in a substitute!';
                        }
                        break;
                    case 'uproar':
                        if (kwargs.upkeep) {
                            actions += '' + poke.getName() + ' is making an uproar!';
                        } else {
                            actions += '' + poke.getName() + ' caused an uproar!';
                        }
                        break;
                    case 'doomdesire':
                        actions += '' + poke.getName() + ' chose Doom Desire as its destiny!';
                        break;
                    case 'futuresight':
                        actions += '' + poke.getName() + ' foresaw an attack!';
                        break;
                    case 'mimic':
                        actions += '' + poke.getName() + ' learned ' + Tools.escapeHTML(args[3]) + '!';
                        break;
                    case 'laserfocus':
                        actions += '' + poke.getName() + ' concentrated intensely!';
                        break;
                    case 'followme':
                    case 'ragepowder': // Deprecated, now uses -singleturn
                        actions += '' + poke.getName() + ' became the center of attention!';
                        break;
                    case 'powder': // Deprecated, now uses -singleturn
                        actions += '' + poke.getName() + ' is covered in powder!';
                        break;
                        // Gen 1
                    case 'lightscreen':
                        actions += '' + poke.getName() + '\'s protected against special attacks!';
                        break;
                    case 'reflect':
                        actions += '' + poke.getName() + ' gained armor!';
                        break;
                    default:
                        actions += '' + poke.getName() + '\'s ' + effect.name + ' started!';
                    }
                }
                poke.addVolatile(effect.id);
                break;
            }
            case '-end': {
                let poke = this.getPokemon(args[1]);
                let effect = Tools.getEffect(args[2]);
                let fromeffect = Tools.getEffect(kwargs.from);
                poke.removeVolatile(effect.id);
                if (kwargs.silent) {
                    // do nothing
                } else {
                    switch (effect.id) {
                    case 'powertrick':
                        actions += '' + poke.getName() + ' switched its Attack and Defense!';
                        break;
                    case 'telekinesis':
                        actions += '' + poke.getName() + ' was freed from the telekinesis!';
                        break;
                    case 'skydrop':
                        actions += '' + poke.getName() + ' was freed from the Sky Drop!';
                        break;
                    case 'confusion':
                        if (!kwargs.silent) {
                            if (fromeffect.effectType === 'Item') {
                                actions += '' + poke.getName() + '\'s ' + fromeffect.name + ' snapped it out of its confusion!';
                                break;
                            }
                            if (poke.side.n === 0) {
                                actions += '' + poke.getName() + ' snapped out of its confusion.';
                            } else {
                                actions += '' + poke.getName() + ' snapped out of confusion!';
                            }
                        }
                        break;
                    case 'leechseed':
                        if (fromeffect.id === 'rapidspin') {
                            actions += '' + poke.getName() + ' was freed from Leech Seed!';
                        }
                        break;
                    case 'healblock':
                        actions += '' + poke.getName() + '\'s Heal Block wore off!';
                        break;
                    case 'attract':
                        if (fromeffect.id === 'oblivious') {
                            actions += '' + poke.getName() + ' got over its infatuation.';
                        }
                        if (fromeffect.id === 'mentalherb') {
                            actions += '' + poke.getName() + ' cured its infatuation status using its ' + fromeffect.name + '!';
                        }
                        break;
                    case 'taunt':
                        actions += '' + poke.getName() + '\'s taunt wore off!';
                        break;
                    case 'disable':
                        actions += '' + poke.getName() + '\'s move is no longer disabled!';
                        break;
                    case 'embargo':
                        actions += '' + poke.getName() + ' can use items again!';
                        break;
                    case 'torment':
                        actions += '' + poke.getName() + '\'s torment wore off!';
                        break;
                    case 'encore':
                        actions += '' + poke.getName() + '\'s encore ended!';
                        break;
                    case 'bide':
                        actions += '' + poke.getName() + ' unleashed its energy!';
                        break;
                    case 'illusion':
                        actions += '' + poke.getName() + '\'s illusion wore off!';
                        poke.markAbility('Illusion');
                        break;
                    case 'slowstart':
                        actions += '' + poke.getName() + ' finally got its act together!';
                        break;
                    case 'magnetrise':
                        if (poke.side.n === 0) {
                            actions += '' + poke.getName() + '\'s electromagnetism wore off!';
                        } else {
                            actions += 'The electromagnetism of ' + poke.getLowerName() + ' wore off!';
                        }
                        break;
                    case 'perishsong': // for backwards compatibility
                        poke.removeVolatile('perish3');
                        break;
                    case 'substitute':
                        actions += '' + poke.getName() + '\'s substitute faded!';
                        break;
                    case 'uproar':
                        actions += '' + poke.getName() + ' calmed down.';
                        break;
                    case 'stockpile':
                        poke.removeVolatile('stockpile1');
                        poke.removeVolatile('stockpile2');
                        poke.removeVolatile('stockpile3');
                        actions += '' + poke.getName() + '\'s stockpiled effect wore off!';
                        break;
                    case 'bind':
                    case 'wrap':
                    case 'clamp':
                    case 'whirlpool':
                    case 'firespin':
                    case 'magmastorm':
                    case 'sandtomb':
                    case 'infestation':
                        actions += '' + poke.getName() + ' was freed from ' + effect.name + '!';
                        break;
                    default:
                        if (effect.effectType === 'Move') {
                            actions += '' + poke.getName() + ' took the ' + effect.name + ' attack!';
                        } else {
                            actions += '' + poke.getName() + '\'s ' + effect.name + ' ended!';
                        }
                    }
                }
                break;
            }
            case '-singleturn': {
                let poke = this.getPokemon(args[1]);
                let effect = Tools.getEffect(args[2]);
                let ofpoke = this.getPokemon(kwargs.of);
                let fromeffect = Tools.getEffect(kwargs.from);
                poke.addTurnstatus(effect.id);
                switch (effect.id) {
                case 'roost':
                    // actions += '' + poke.getName() + ' landed on the ground!';
                    break;
                case 'quickguard':
                    actions += 'Quick Guard protected ' + poke.side.getLowerTeamName() + '!';
                    break;
                case 'wideguard':
                    actions += 'Wide Guard protected ' + poke.side.getLowerTeamName() + '!';
                    break;
                case 'craftyshield':
                    actions += 'Crafty Shield protected ' + poke.side.getLowerTeamName() + '!';
                    break;
                case 'matblock':
                    actions += '' + poke.getName() + ' intends to flip up a mat and block incoming attacks!';
                    break;
                case 'protect':
                    actions += '' + poke.getName() + ' protected itself!';
                    break;
                case 'endure':
                    actions += '' + poke.getName() + ' braced itself!';
                    break;
                case 'helpinghand':
                    actions += '' + ofpoke.getName() + ' is ready to help ' + poke.getLowerName() + '!';
                    break;
                case 'focuspunch':
                    actions += '' + poke.getName() + ' is tightening its focus!';
                    poke.markMove(effect.name, 0);
                    break;
                case 'shelltrap':
                    actions += '' + poke.getName() + ' set a shell trap!';
                    poke.markMove(effect.name, 0);
                    break;
                case 'snatch':
                    actions += '' + poke.getName() + ' waits for a target to make a move!';
                    break;
                case 'magiccoat':
                    actions += '' + poke.getName() + ' shrouded itself with Magic Coat!';
                    break;
                case 'electrify':
                    actions += '' + poke.getName() + '\'s moves have been electrified!';
                    break;
                case 'followme':
                case 'ragepowder':
                case 'spotlight':
                    if (kwargs.zeffect) {
                        actions += '' + poke.getName() + ' became the center of attention using its Z-Power!';
                    } else {
                        actions += '' + poke.getName() + ' became the center of attention!';
                    }
                    break;
                case 'powder':
                    actions += '' + poke.getName() + ' is covered in powder!';
                    break;
                case 'instruct':
                    actions += '' + poke.getName() + ' used the move instructed by ' + ofpoke.getLowerName() + '!';
                    break;
                case 'beakblast':
                    actions += '' + poke.getName() + ' started heating up its beak!';
                    break;
                }
                break;
            }
            case '-singlemove': {
                let poke = this.getPokemon(args[1]);
                let effect = Tools.getEffect(args[2]);
                let ofpoke = this.getPokemon(kwargs.of);
                let fromeffect = Tools.getEffect(kwargs.from);
                poke.addMovestatus(effect.id);
                switch (effect.id) {
                case 'grudge':
                    actions += '' + poke.getName() + ' wants its target to bear a grudge!';
                    break;
                case 'destinybond':
                    actions += '' + poke.getName() + ' is hoping to take its attacker down with it!';
                    break;
                }
                break;
            }
            case '-activate': {
                let poke = this.getPokemon(args[1]);
                let effect = Tools.getEffect(args[2]);
                let ofpoke = this.getPokemon(kwargs.of);
                if ((effect.id === 'confusion' || effect.id === 'attract') && !this.hasPreMoveMessage && this.waitForResult()) {
                    return;
                }
                if (effect.effectType === 'Ability') {
                    this.message('', '<small>[' + poke.getName(true) + '\'s ' + effect.name + '!]</small>');
                    poke.markAbility(effect.name);
                }
                switch (effect.id) {
                case 'healreplacement':
                    actions += '' + poke.getName() + ' will restore its replacement\'s HP using its Z-Power!';
                    break;
                case 'confusion':
                    actions += '' + poke.getName() + ' is confused!';
                    this.hasPreMoveMessage = true;
                    break;
                case 'destinybond':
                    actions += '' + poke.getName() + ' took its attacker down with it!';
                    break;
                case 'snatch':
                    actions += '' + poke.getName() + ' snatched ' + ofpoke.getLowerName() + '\'s move!';
                    break;
                case 'grudge':
                    actions += '' + poke.getName() + '\'s ' + Tools.escapeHTML(args[3]) + ' lost all of its PP due to the grudge!';
                    poke.markMove(args[3], Infinity);
                    break;
                case 'quickguard':
                    poke.addTurnstatus('quickguard');
                    actions += 'Quick Guard protected ' + poke.getLowerName() + '!';
                    break;
                case 'wideguard':
                    poke.addTurnstatus('wideguard');
                    actions += 'Wide Guard protected ' + poke.getLowerName() + '!';
                    break;
                case 'craftyshield':
                    poke.addTurnstatus('craftyshield');
                    actions += 'Crafty Shield protected ' + poke.getLowerName() + '!';
                    break;
                case 'protect':
                    poke.addTurnstatus('protect');
                    actions += '' + poke.getName() + ' protected itself!';
                    break;
                case 'substitute':
                    if (kwargs.damage) {
                        actions += 'The substitute took damage for ' + poke.getLowerName() + '!';
                    } else if (kwargs.block) {
                        actions += '' + poke.getName() + '\'s Substitute blocked ' + Tools.getMove(kwargs.block || args[3]).name + '!';
                    }
                    break;
                case 'attract':
                    actions += '' + poke.getName() + ' is in love with ' + ofpoke.getLowerName() + '!';
                    this.hasPreMoveMessage = true;
                    break;
                case 'bide':
                    actions += '' + poke.getName() + ' is storing energy!';
                    break;
                case 'mist':
                    actions += '' + poke.getName() + ' is protected by the mist!';
                    break;
                case 'safeguard':
                    actions += '' + poke.getName() + ' is protected by Safeguard!';
                    break;
                case 'trapped':
                    actions += '' + poke.getName() + ' can no longer escape!';
                    break;
                case 'stickyweb':
                    actions += '' + poke.getName() + ' was caught in a sticky web!';
                    break;
                case 'happyhour':
                    actions += 'Everyone is caught up in the happy atmosphere!';
                    break;
                case 'celebrate':
                    actions += 'Congratulations, ' + Tools.escapeHTML(poke.side.name) + '!';
                    break;
                    // move activations
                case 'aromatherapy':
                    actions += 'A soothing aroma wafted through the area!';
                    break;
                case 'healbell':
                    actions += 'A bell chimed!';
                    break;
                case 'trick':
                case 'switcheroo':
                    actions += '' + poke.getName() + ' switched items with its target!';
                    break;
                case 'brickbreak':
                    actions += poke.getName() + ' shattered ' + ofpoke.side.getTeamName() + ' protections!';
                    ofpoke.side.removeSideCondition('Reflect');
                    ofpoke.side.removeSideCondition('LightScreen');
                    break;
                case 'beatup':
                    actions += '' + Tools.escapeHTML(kwargs.of) + '\'s attack!';
                    break;
                case 'pursuit':
                    actions += '(' + poke.getName() + ' is being withdrawn!)';
                    break;
                case 'hyperspacefury':
                case 'hyperspacehole':
                case 'phantomforce':
                case 'shadowforce':
                case 'feint':
                    if (kwargs.broken) {
                        actions += 'It broke through ' + poke.getLowerName() + '\'s protection!';
                    } else {
                        actions += '' + poke.getName() + ' fell for the feint!';
                    }
                    poke.removeTurnstatus('protect');
                    for (const target of poke.side.pokemon) {
                        target.removeTurnstatus('wideguard');
                        target.removeTurnstatus('quickguard');
                        target.removeTurnstatus('craftyshield');
                        target.removeTurnstatus('matblock');
                    }
                    break;
                case 'spite':
                    let move = Tools.getMove(args[3]).name;
                    let pp = Tools.escapeHTML(args[4]);
                    actions += 'It reduced the PP of ' + poke.getLowerName() + '\'s ' + move + ' by ' + pp + '!';
                    poke.markMove(move, Number(pp));
                    break;
                case 'gravity':
                    actions += '' + poke.getName() + ' couldn\'t stay airborne because of gravity!';
                    poke.removeVolatile('magnetrise');
                    poke.removeVolatile('telekinesis');
                    break;
                case 'magnitude':
                    actions += 'Magnitude ' + Tools.escapeHTML(args[3]) + '!';
                    break;
                case 'sketch':
                    actions += '' + poke.getName() + ' sketched ' + Tools.escapeHTML(args[3]) + '!';
                    break;
                case 'skillswap':
                    actions += '' + poke.getName() + ' swapped Abilities with its target!';
                    if (this.gen <= 4) {
                        break;
                    }
                    let pokeability = Tools.escapeHTML(args[3]) || ofpoke.ability;
                    let ofpokeability = Tools.escapeHTML(args[4]) || poke.ability;
                    if (pokeability) {
                        poke.ability = pokeability;
                        if (!ofpoke.baseAbility) {
                            ofpoke.baseAbility = pokeability;
                        }
                    }
                    if (ofpokeability) {
                        ofpoke.ability = ofpokeability;
                        if (!poke.baseAbility) {
                            poke.baseAbility = ofpokeability;
                        }
                    }
                    if (poke.side !== ofpoke.side) {
                        actions += '<br />' + poke.getName() + ' acquired ' + pokeability + '!';
                        actions += '<br />' + ofpoke.getName() + ' acquired ' + ofpokeability + '!';
                    }
                    break;
                case 'charge':
                    actions += '' + poke.getName() + ' began charging power!';
                    break;
                case 'struggle':
                    actions += '' + poke.getName() + ' has no moves left!';
                    break;
                case 'bind':
                    actions += '' + poke.getName() + ' was squeezed by ' + ofpoke.getLowerName() + '!';
                    break;
                case 'wrap':
                    actions += '' + poke.getName() + ' was wrapped by ' + ofpoke.getLowerName() + '!';
                    break;
                case 'clamp':
                    actions += '' + ofpoke.getName() + ' clamped down on ' + poke.getLowerName() + '!';
                    break;
                case 'whirlpool':
                    actions += '' + poke.getName() + ' became trapped in the vortex!';
                    break;
                case 'firespin':
                    actions += '' + poke.getName() + ' became trapped in the fiery vortex!';
                    break;
                case 'magmastorm':
                    actions += '' + poke.getName() + ' became trapped by swirling magma!';
                    break;
                case 'sandtomb':
                    actions += '' + poke.getName() + ' became trapped by the quicksand!';
                    break;
                case 'infestation':
                    actions += '' + poke.getName() + ' has been afflicted with an infestation by ' + ofpoke.getLowerName() + '!';
                    break;
                case 'afteryou':
                    actions += '' + poke.getName() + ' took the kind offer!';
                    break;
                case 'quash':
                    actions += '' + poke.getName() + '\'s move was postponed!';
                    break;
                case 'powersplit':
                    actions += '' + poke.getName() + ' shared its power with the target!';
                    break;
                case 'guardsplit':
                    actions += '' + poke.getName() + ' shared its guard with the target!';
                    break;
                case 'speedswap':
                    actions += '' + poke.getName() + ' switched Speed with its target!';
                    break;
                case 'ingrain':
                    actions += '' + poke.getName() + ' anchored itself with its roots!';
                    break;
                case 'matblock':
                    actions += '' + Tools.escapeHTML(args[3]) + ' was blocked by the kicked-up mat!';
                    break;
                case 'powder':
                    actions += 'When the flame touched the powder on the Pokémon, it exploded!';
                    break;
                case 'fairylock':
                    actions += 'No one will be able to run away during the next turn!';
                    break;
                case 'lockon':
                case 'mindreader':
                    actions += '' + poke.getName() + ' took aim at ' + ofpoke.getLowerName() + '!';
                    break;
                case 'endure':
                    actions += '' + poke.getName() + ' endured the hit!';
                    break;
                case 'electricterrain':
                    actions += '' + poke.getName() + ' surrounds itself with electrified terrain!';
                    break;
                case 'mistyterrain':
                    actions += '' + poke.getName() + ' surrounds itself with a protective mist!';
                    break;
                case 'psychicterrain':
                    actions += '' + poke.getName() + ' surrounds itself with psychic terrain!';
                    break;
                    // ability activations
                case 'magicbounce':
                case 'magiccoat':
                case 'rebound':
                    break;
                case 'wonderguard': // Deprecated, now uses -immune
                    actions += '' + poke.getName() + '\'s Wonder Guard evades the attack!';
                    break;
                case 'forewarn':
                    if (this.gen >= 5) {
                        actions += 'It was alerted to ' + ofpoke.getLowerName() + '\'s ' + Tools.escapeHTML(args[3]) + '!';
                        ofpoke.markMove(args[3], 0);
                    } else {
                        actions += '' + poke.getName() + '\'s Forewarn alerted it to ' + Tools.escapeHTML(args[3]) + '!';
                        let foeActive = [];
                        for (const target of poke.side.foe.active) {
                            if (target) {
                                foeActive.push(target);
                            }
                        }
                        if (foeActive.length === 1) {
                            foeActive[0].markMove(args[3], 0);
                        }
                    }
                    break;
                case 'mummy':
                    if (!args[3]) {
                        break;
                    } // if Mummy activated but failed, no ability will have been sent
                    let ability = Tools.getAbility(args[3]);
                    this.message('', '<small>[' + ofpoke.getName(true) + '\'s ' + ability.name + '!]</small>');
                    ofpoke.markAbility(ability.name);
                    this.message('', '<small>[' + ofpoke.getName(true) + '\'s Mummy!]</small>');
                    ofpoke.markAbility('Mummy', true);
                    actions += '' + ofpoke.getName() + '\'s Ability became Mummy!';
                    break;
                case 'anticipation': // Deprecated, now uses -ability. This is for replay compatability
                    actions += '' + poke.getName() + ' shuddered!';
                    break;
                case 'lightningrod':
                case 'stormdrain':
                    actions += '' + poke.getName() + ' took the attack!';
                    break;
                case 'telepathy':
                    actions += '' + poke.getName() + ' avoids attacks by its ally Pok&#xE9;mon!';
                    break;
                case 'stickyhold':
                    actions += '' + poke.getName() + '\'s item cannot be removed!';
                    break;
                case 'suctioncups':
                    actions += '' + poke.getName() + ' anchors itself!';
                    break;
                case 'symbiosis':
                    actions += '' + poke.getName() + ' shared its ' + Tools.getItem(args[3]).name + ' with ' + ofpoke.getLowerName() + '!';
                    break;
                case 'aromaveil':
                    actions += '' + ofpoke.getName() + ' is protected by an aromatic veil!';
                    break;
                case 'flowerveil':
                    actions += '' + ofpoke.getName() + ' surrounded itself with a veil of petals!';
                    break;
                case 'sweetveil':
                    actions += '' + ofpoke.getName() + ' surrounded itself with a veil of sweetness!';
                    break;
                case 'battlebond':
                    actions += '' + poke.getName() + ' became fully charged due to its bond with its Trainer!';
                    break;
                case 'disguise':
                    actions += 'Its disguise served it as a decoy!';
                    break;
                case 'powerconstruct':
                    actions += 'You sense the presence of many!';
                    break;
                case 'persistent': // CAP
                    actions += '' + poke.getName() + ' extends ' + Tools.getMove(args[3]).name + ' by 2 turns!';
                    break;
                    // weather activations
                case 'deltastream':
                    actions += 'The mysterious strong winds weakened the attack!';
                    break;
                    // item activations
                case 'custapberry':
                case 'quickclaw':
                    // actions += '' + poke.getName() + ' is already preparing its next move!';
                    actions += '' + poke.getName() + '\'s ' + effect.name + ' let it move first!';
                    break;
                case 'leppaberry':
                case 'mysteryberry':
                    actions += '' + poke.getName() + ' restored PP to its ' + Tools.escapeHTML(args[3]) + ' move using ' + effect.name + '!';
                    poke.markMove(args[3], effect.id === 'leppaberry' ? -10 : -5);
                    break;
                case 'focusband':
                    poke.item = 'Focus Band';
                    actions += '' + poke.getName() + ' hung on using its Focus Band!';
                    break;
                case 'safetygoggles':
                    poke.item = 'Safety Goggles';
                    actions += '' + poke.getName() + ' is not affected by ' + Tools.escapeHTML(args[3]) + ' thanks to its Safety Goggles!';
                    break;
                case 'protectivepads':
                    poke.item = 'Protective Pads';
                    actions += '' + poke.getName() + ' protected itself with the Protective Pads!';
                    break;
                default:
                    if (kwargs.broken) { // for custom moves that break protection
                        actions += 'It broke through ' + poke.getLowerName() + '\'s protection!';
                    } else if (effect.effectType !== 'Ability') {
                        actions += '' + poke.getName() + '\'s ' + effect.name + ' activated!';
                    }
                }
                break;
            }
            case '-sidestart': {
                let side = this.getSide(args[1]);
                let effect = Tools.getEffect(args[2]);
                side.addSideCondition(effect);
                switch (effect.id) {
                case 'stealthrock':
                    actions += 'Pointed stones float in the air around ' + side.getLowerTeamName() + '!';
                    break;
                case 'spikes':
                    actions += 'Spikes were scattered on the ground all around ' + side.getLowerTeamName() + '!';
                    break;
                case 'toxicspikes':
                    actions += 'Poison spikes were scattered on the ground all around ' + side.getLowerTeamName() + '!';
                    break;
                case 'stickyweb':
                    actions += 'A sticky web spreads out on the ground around ' + side.getLowerTeamName() + '!';
                    break;
                case 'tailwind':
                    actions += 'The Tailwind blew from behind ' + side.getLowerTeamName() + '!';
                    break;
                case 'auroraveil':
                    actions += 'Aurora Veil made ' + side.getLowerTeamName() + ' stronger against physical and special moves!';
                    break;
                case 'reflect':
                    actions += 'Reflect made ' + side.getLowerTeamName() + ' stronger against physical moves!';
                    break;
                case 'lightscreen':
                    actions += 'Light Screen made ' + side.getLowerTeamName() + ' stronger against special moves!';
                    break;
                case 'safeguard':
                    actions += '' + side.getTeamName() + ' cloaked itself in a mystical veil!';
                    break;
                case 'mist':
                    actions += '' + side.getTeamName() + ' became shrouded in mist!';
                    break;
                case 'luckychant':
                    actions += 'Lucky Chant shielded ' + side.getLowerTeamName() + ' from critical hits!';
                    break;
                case 'firepledge':
                    actions += 'A sea of fire enveloped ' + side.getLowerTeamName() + '!';
                    break;
                case 'waterpledge':
                    actions += 'A rainbow appeared in the sky on ' + side.getLowerTeamName() + '\'s side!';
                    break;
                case 'grasspledge':
                    actions += 'A swamp enveloped ' + side.getLowerTeamName() + '!';
                    break;
                default:
                    actions += '' + effect.name + ' started!';
                    break;
                }
                break;
            }
            case '-sideend': {
                let side = this.getSide(args[1]);
                let effect = Tools.getEffect(args[2]);
                let from = Tools.getEffect(kwargs.from);
                let ofpoke = this.getPokemon(kwargs.of);
                side.removeSideCondition(effect.name);
                switch (effect.id) {
                case 'stealthrock':
                    actions += 'The pointed stones disappeared from around ' + side.getLowerTeamName() + '!';
                    break;
                case 'spikes':
                    actions += 'The spikes disappeared from the ground around ' + side.getLowerTeamName() + '!';
                    break;
                case 'toxicspikes':
                    actions += 'The poison spikes disappeared from the ground around ' + side.getLowerTeamName() + '!';
                    break;
                case 'stickyweb':
                    actions += 'The sticky web has disappeared from the ground around ' + side.getLowerTeamName() + '!';
                    break;
                case 'tailwind':
                    actions += '' + side.getTeamName() + '\'s Tailwind petered out!';
                    break;
                case 'auroraveil':
                    actions += '' + side.getTeamName() + '\'s Aurora Veil wore off!';
                    break;
                case 'reflect':
                    actions += '' + side.getTeamName() + '\'s Reflect wore off!';
                    break;
                case 'lightscreen':
                    actions += '' + side.getTeamName() + '\'s Light Screen wore off!';
                    break;
                case 'safeguard':
                    actions += '' + side.getTeamName() + ' is no longer protected by Safeguard!';
                    break;
                case 'mist':
                    actions += '' + side.getTeamName() + ' is no longer protected by mist!';
                    break;
                case 'luckychant':
                    actions += '' + side.getTeamName() + '\'s Lucky Chant wore off!';
                    break;
                case 'firepledge':
                    actions += 'The sea of fire around ' + side.getLowerTeamName() + ' disappeared!';
                    break;
                case 'waterpledge':
                    actions += 'The rainbow on ' + side.getLowerTeamName() + '\'s side disappeared!';
                    break;
                case 'grasspledge':
                    actions += 'The swamp around ' + side.getLowerTeamName() + ' disappeared!';
                    break;
                default:
                    actions += '' + effect.name + ' ended!';
                    break;
                }
                break;
            }
            case '-weather': {
                let effect = Tools.getEffect(args[1]);
                let poke = this.getPokemon(kwargs.of) || undefined;
                let ability = Tools.getEffect(kwargs.from);
                this.changeWeather(effect.name, poke, !!kwargs.upkeep, ability);
                break;
            }
            case '-fieldstart': {
                let effect = Tools.getEffect(args[1]);
                let poke = this.getPokemon(kwargs.of);
                let fromeffect = Tools.getEffect(kwargs.from);
                if (fromeffect && fromeffect.effectType === 'Ability') {
                    this.message('', '<small>[' + poke.getName(true) + '\'s ' + fromeffect.name + '!]</small>');
                    poke.markAbility(fromeffect.name);
                }
                let maxTimeLeft = 0;
                if (effect.id in {'electricterrain': 1, 'grassyterrain': 1, 'mistyterrain': 1, 'psychicterrain': 1}) {
                    for (let i = this.pseudoWeather.length - 1; i >= 0; i--) {
                        let pwName = this.pseudoWeather[i][0];
                        if (pwName === 'Electric Terrain' || pwName === 'Grassy Terrain' || pwName === 'Misty Terrain' || pwName === 'Psychic Terrain') {
                            this.pseudoWeather.splice(i, 1);
                            continue;
                        }
                    }
                    if (this.gen > 6) {
                        maxTimeLeft = 8;
                    }
                }
                this.addPseudoWeather(effect.name, 5, maxTimeLeft);
                switch (effect.id) {
                case 'wonderroom':
                    actions += 'It created a bizarre area in which Defense and Sp. Def stats are swapped!';
                    break;
                case 'magicroom':
                    actions += 'It created a bizarre area in which Pok&#xE9;mon\'s held items lose their effects!';
                    break;
                case 'gravity':
                    actions += 'Gravity intensified!';
                    break;
                case 'mudsport':
                    actions += 'Electricity\'s power was weakened!';
                    break;
                case 'watersport':
                    actions += 'Fire\'s power was weakened!';
                    break;
                case 'grassyterrain':
                    actions += 'Grass grew to cover the battlefield!';
                    break;
                case 'mistyterrain':
                    actions += 'Mist swirls around the battlefield!';
                    break;
                case 'electricterrain':
                    actions += 'An electric current runs across the battlefield!';
                    break;
                case 'psychicterrain':
                    actions += 'The battlefield got weird!';
                    break;
                case 'trickroom':
                    if (poke) {
                        actions += '' + poke.getName() + ' twisted the dimensions!';
                        break;
                    }
                    // falls through
                default:
                    actions += effect.name + ' started!';
                    break;
                }
                break;
            }
            case '-fieldend': {
                let effect = Tools.getEffect(args[1]);
                let poke = this.getPokemon(kwargs.of);
                this.removePseudoWeather(effect.name);
                switch (effect.id) {
                case 'trickroom':
                    actions += 'The twisted dimensions returned to normal!';
                    break;
                case 'wonderroom':
                    actions += 'Wonder Room wore off, and Defense and Sp. Def stats returned to normal!';
                    break;
                case 'magicroom':
                    actions += 'Magic Room wore off, and held items\' effects returned to normal!';
                    break;
                case 'gravity':
                    actions += 'Gravity returned to normal!';
                    break;
                case 'mudsport':
                    actions += 'The effects of Mud Sport have faded.';
                    break;
                case 'watersport':
                    actions += 'The effects of Water Sport have faded.';
                    break;
                case 'grassyterrain':
                    actions += 'The grass disappeared from the battlefield.';
                    break;
                case 'mistyterrain':
                    actions += 'The mist disappeared from the battlefield.';
                    break;
                case 'electricterrain':
                    actions += 'The electricity disappeared from the battlefield.';
                    break;
                case 'psychicterrain':
                    actions += 'The weirdness disappeared from the battlefield!';
                    break;
                default:
                    actions += effect.name + ' ended!';
                    break;
                }
                break;
            }
            case '-fieldactivate': {
                let effect = Tools.getEffect(args[1]);
                switch (effect.id) {
                case 'perishsong':
                    actions += 'All Pok&#xE9;mon that heard the song will faint in three turns!';
                    break;
                case 'payday':
                    actions += 'Coins were scattered everywhere!';
                    break;
                case 'iondeluge':
                    actions += 'A deluge of ions showers the battlefield!';
                    break;
                default:
                    actions += '' + effect.name + ' hit!';
                    break;
                }
                break;
            }
            case '-message': {
                actions += Tools.escapeHTML(args[1]);
                break;
            }
            case '-anim': {
                let poke = this.getPokemon(args[1]);
                let move = Tools.getMove(args[2]);
                if (this.checkActive(poke)) {
                    return;
                }
                let poke2 = this.getPokemon(args[3]);
                kwargs.silent = '.';
                this.useMove(poke, move, poke2, kwargs);
                break;
            }
            case '-hint': {
                this.message('', '<small>(' + Tools.escapeHTML(args[1]) + ')</small>');
                break;
            }
            default: {
                if (this.errorCallback) {
                    this.errorCallback(this);
                }
                break;
            }
            }
            if (actions && actions.slice(-1) !== '>') {
                actions += '<br />';
            }
        }
        if (actions) {
            if (actions.slice(-6) === '<br />') {
                actions = actions.slice(0, -6);
            }
            this.message('<small>' + actions + '</small>', '');
        }
    }
    /*
    parseSpriteData(name) {
        let siden = 0,
            foe = false;
        while (true) {
            if (name.substr(0, 6) === 'foeof-') {
                foe = true;
                name = name.substr(6);
            } else if (name.substr(0, 9) === 'switched-') name = name.substr(9);
            else if (name.substr(0, 9) === 'existing-') name = name.substr(9);
            else if (name.substr(0, 4) === 'foe-') {
                siden = this.p2.n;
                name = name.substr(4);
            } else if (name.substr(0, 5) === 'ally-') {
                siden = this.p1.n;
                name = name.substr(5);
            } else break;
        }
        if (name.substr(name.length - 1) === ')') {
            let parenIndex = name.lastIndexOf('(');
            if (parenIndex > 0) {
                let species = name.substr(parenIndex + 1);
                name = species.substr(0, species.length - 1);
            }
        }
        if (foe) siden = (siden ? 0 : 1);

        let data = Tools.getTemplate(name);
        return data.spriteData[siden];
    }
    */
    parseDetails(name, pokemonid, details = '', output = {}) {
        output.details = details;
        output.name = name;
        output.species = name;
        output.level = 100;
        output.shiny = false;
        output.gender = '';
        output.ident = (name ? pokemonid : '');
        output.searchid = (name ? (pokemonid + '|' + details) : '');
        let splitDetails = details.split(', ');
        if (splitDetails[splitDetails.length - 1] === 'shiny') {
            output.shiny = true;
            splitDetails.pop();
        }
        if (splitDetails[splitDetails.length - 1] === 'M' || splitDetails[splitDetails.length - 1] === 'F') {
            output.gender = splitDetails[splitDetails.length - 1];
            splitDetails.pop();
        }
        if (splitDetails[1]) {
            output.level = parseInt(splitDetails[1].substr(1), 10) || 100;
        }
        if (splitDetails[0]) {
            output.species = splitDetails[0];
        }
        return output;
    }
    parseHealth(hpstring, output = {}) {
        let [hp, status] = hpstring.split(' ');
        // hp parse
        output.hpcolor = '';
        if (hp === '0' || hp === '0.0') {
            if (!output.maxhp) {
                output.maxhp = 100;
            }
            output.hp = 0;
        } else if (hp.indexOf('/') > 0) {
            let [curhp, maxhp] = hp.split('/');
            if (isNaN(parseFloat(curhp)) || isNaN(parseFloat(maxhp))) {
                return null;
            }
            output.hp = parseFloat(curhp);
            output.maxhp = parseFloat(maxhp);
            if (output.hp > output.maxhp) {
                output.hp = output.maxhp;
            }
            const colorchar = maxhp.slice(-1);
            if (colorchar === 'y' || colorchar === 'g') {
                output.hpcolor = colorchar;
            }
        } else if (!isNaN(parseFloat(hp))) {
            if (!output.maxhp) {
                output.maxhp = 100;
            }
            output.hp = output.maxhp * parseFloat(hp) / 100;
        }
        // status parse
        if (!status) {
            output.status = '';
        } else if (status === 'par' || status === 'brn' || status === 'slp' || status === 'frz' || status === 'tox') {
            output.status = status;
        } else if (status === 'psn' && output.status !== 'tox') {
            output.status = status;
        } else if (status === 'fnt') {
            output.hp = 0;
            output.fainted = true;
        }
        return output;
    }
    parsePokemonId(pokemonid) {
        let name = pokemonid;
        let siden = -1;
        let slot = -1; // if there is an explicit slot for this pokemon
        let slotChart = {a: 0, b: 1, c: 2, d: 3, e: 4, f: 5};
        if (name.substr(0, 4) === 'p2: ' || name === 'p2') {
            siden = this.p2.n;
            name = name.substr(4);
        } else if (name.substr(0, 4) === 'p1: ' || name === 'p1') {
            siden = this.p1.n;
            name = name.substr(4);
        } else if (name.substr(0, 2) === 'p2' && name.substr(3, 2) === ': ') {
            slot = slotChart[name.substr(2, 1)];
            siden = this.p2.n;
            name = name.substr(5);
            pokemonid = 'p2: ' + name;
        } else if (name.substr(0, 2) === 'p1' && name.substr(3, 2) === ': ') {
            slot = slotChart[name.substr(2, 1)];
            siden = this.p1.n;
            name = name.substr(5);
            pokemonid = 'p1: ' + name;
        }
        return {name: name, siden: siden, slot: slot, pokemonid: pokemonid};
    }
    getPokemon(pokemonid, details) {
        let isNew = false; // if true, don't match any pokemon that already exists (for Team Preview)
        let isSwitch = false; // if true, don't match an active, fainted, or immediately-previously switched-out pokemon
        let isInactive = false; // if true, don't match an active pokemon
        let createIfNotFound = false; // if true, create the pokemon if a match wasn't found
        if (pokemonid === undefined || pokemonid === '??') {
            return null;
        }
        if (pokemonid.substr(0, 5) === 'new: ') {
            pokemonid = pokemonid.substr(5);
            isNew = true;
            createIfNotFound = true; // obviously
        }
        if (pokemonid.substr(0, 10) === 'switchin: ') {
            pokemonid = pokemonid.substr(10);
            isSwitch = true;
            createIfNotFound = true;
        }
        let parseIdResult = this.parsePokemonId(pokemonid);
        let name; let siden; let slot;
        name = parseIdResult.name;
        siden = parseIdResult.siden;
        slot = parseIdResult.slot;
        pokemonid = parseIdResult.pokemonid;
        if (!details) {
            if (siden < 0) {
                return null;
            }
            if (this.sides[siden].active[slot]) {
                return this.sides[siden].active[slot];
            }
            if (slot >= 0) {
                isInactive = true;
            }
        }
        let searchid = '';
        if (details) {
            searchid = pokemonid + '|' + details;
        }
        // search p1's pokemon
        if (siden !== this.p2.n && !isNew) {
            const active = this.p1.active[slot];
            if (active && active.searchid === searchid && !isSwitch) {
                active.slot = slot;
                return active;
            }
            for (let i = 0; i < this.p1.pokemon.length; i++) {
                let pokemon = this.p1.pokemon[i];
                if (pokemon.fainted && (isNew || isSwitch)) {
                    continue;
                }
                if (isSwitch || isInactive) {
                    if (this.p1.active.indexOf(pokemon) >= 0) {
                        continue;
                    }
                }
                if (isSwitch && pokemon == this.p1.lastPokemon && !this.p1.active[slot]) {
                    continue;
                }
                if ((searchid && pokemon.searchid === searchid) || // exact match
                    (!searchid && pokemon.ident === pokemonid)) { // name matched, good enough
                    if (slot >= 0) {
                        pokemon.slot = slot;
                    }
                    return pokemon;
                }
                if (!pokemon.searchid && pokemon.checkDetails(details)) { // switch-in matches Team Preview entry
                    pokemon = this.p1.newPokemon(this.parseDetails(name, pokemonid, details), i);
                    if (slot >= 0) {
                        pokemon.slot = slot;
                    }
                    return pokemon;
                }
            }
        }
        // search p2's pokemon
        if (siden !== this.p1.n && !isNew) {
            const active = this.p2.active[slot];
            if (active && active.searchid === searchid && !isSwitch) {
                if (slot >= 0) {
                    active.slot = slot;
                }
                return active;
            }
            for (let i = 0; i < this.p2.pokemon.length; i++) {
                let pokemon = this.p2.pokemon[i];
                if (pokemon.fainted && (isNew || isSwitch)) {
                    continue;
                }
                if (isSwitch || isInactive) {
                    if (this.p2.active.indexOf(pokemon) >= 0) {
                        continue;
                    }
                }
                if (isSwitch && pokemon == this.p2.lastPokemon && !this.p2.active[slot]) {
                    continue;
                }
                if ((searchid && pokemon.searchid === searchid) || // exact match
                    (!searchid && pokemon.ident === pokemonid)) { // name matched, good enough
                    if (slot >= 0) {
                        pokemon.slot = slot;
                    }
                    return pokemon;
                }
                if (!pokemon.searchid && pokemon.checkDetails(details)) { // switch-in matches Team Preview entry
                    pokemon = this.p2.newPokemon(this.parseDetails(name, pokemonid, details), i);
                    if (slot >= 0) {
                        pokemon.slot = slot;
                    }
                    return pokemon;
                }
            }
        }
        if (!details || !createIfNotFound) {
            return null;
        }
        // pokemon not found, create a new pokemon object for it
        if (siden < 0) {
            throw new Error('Invalid pokemonid passed to getPokemon');
        }
        let species = name;
        let gender = '';
        let level = 100;
        let shiny = false;
        if (details) {
            let splitDetails = details.split(', ');
            if (splitDetails[splitDetails.length - 1] === 'shiny') {
                shiny = true;
                splitDetails.pop();
            }
            if (splitDetails[splitDetails.length - 1] === 'M' || splitDetails[splitDetails.length - 1] === 'F') {
                gender = splitDetails[splitDetails.length - 1];
                splitDetails.pop();
            }
            if (splitDetails[1]) {
                level = parseInt(splitDetails[1].substr(1), 10) || 100;
            }
            if (splitDetails[0]) {
                species = splitDetails[0];
            }
        }
        if (slot < 0) {
            slot = 0;
        }
        let pokemon = this.sides[siden].newPokemon({
            species: species,
            details: details,
            name: name,
            ident: (name ? pokemonid : ''),
            searchid: (name ? (pokemonid + '|' + details) : ''),
            level: level,
            gender: gender,
            shiny: shiny,
            slot: slot,
        }, isNew ? -2 : -1);
        return pokemon;
    }
    getSide(sidename) {
        if (sidename === 'p1' || sidename.substr(0, 3) === 'p1:') {
            return this.p1;
        }
        if (sidename === 'p2' || sidename.substr(0, 3) === 'p2:') {
            return this.p2;
        }
        if (this.mySide.id == sidename) {
            return this.mySide;
        }
        if (this.yourSide.id == sidename) {
            return this.yourSide;
        }
        if (this.mySide.name == sidename) {
            return this.mySide;
        }
        if (this.yourSide.name == sidename) {
            return this.yourSide;
        }
        return {
            name: sidename,
            id: sidename.replace(/ /g, ''),
        };
    }
    add(command, fastForward) {
        if (this.playbackState === Playback.Uninitialized) {
            this.playbackState = Playback.Ready;
            this.activityQueue.push(command);
        } else if (this.playbackState === Playback.Finished) {
            this.playbackState = Playback.Playing;
            this.paused = false;
            this.activityQueue.push(command);
            if (fastForward) {
                this.fastForwardTo(-1);
            } else {
                this.nextActivity();
            }
        } else {
            this.activityQueue.push(command);
        }
    }
    runMajor(args, kwargs, preempt) {
        switch (args[0]) {
        case 'start': {
            this.mySide.active[0] = null;
            this.yourSide.active[0] = null;
            if (this.waitForResult()) {
                return;
            }
            this.start();
            break;
        }
        case 'upkeep': {
            this.usesUpkeep = true;
            this.updatePseudoWeatherLeft();
            this.updateToxicTurns();
            break;
        }
        case 'turn': {
            if (this.endPrevAction()) {
                return;
            }
            this.setTurn(args[1]);
            break;
        }
        case 'tier': {
            if (!args[1]) {
                args[1] = '';
            }
            for (let i in kwargs) {
                args[1] += '[' + i + '] ' + kwargs[i];
            }
            this.tier = args[1];
            if (this.tier.slice(-13) === 'Random Battle') {
                this.speciesClause = true;
            }
            break;
        }
        case 'gametype': {
            this.gameType = args[1];
            switch (args[1]) {
            default:
                this.mySide.active = [null];
                this.yourSide.active = [null];
                break;
            case 'doubles':
                this.mySide.active = [null, null];
                this.yourSide.active = [null, null];
                break;
            case 'triples':
            case 'rotation':
                this.mySide.active = [null, null, null];
                this.yourSide.active = [null, null, null];
                break;
            }
            break;
        }
        case 'variation': {
            break;
        }
        case 'rule': {
            let ruleArgs = args[1].split(': ');
            if (ruleArgs[0] === 'Species Clause') {
                this.speciesClause = true;
            }
            break;
        }
        case 'rated': {
            this.rated = true;
            break;
        }
        case ':': {
            break;
        }
        case 'chat':
        case 'c':
        case 'c:': {
            let pipeIndex = args[1].indexOf('|');
            if (args[0] === 'c:') {
                args[1] = args[1].slice(pipeIndex + 1);
                pipeIndex = args[1].indexOf('|');
            }
            let name = args[1].slice(0, pipeIndex);
            let rank = name.charAt(0);
            if (this.ignoreSpects && (rank === ' ' || rank === '+')) {
                break;
            }
            if (this.ignoreOpponent && (rank === '\u2605' || rank === '\u2606') && toUserid(name) !== app.user.get('userid')) {
                break;
            }
            let message = args[1].slice(pipeIndex + 1);
            let isHighlighted = app && app.rooms && app.rooms[this.roomid].getHighlight(message);
            let parsedMessage = Tools.parseChatMessage(message, name, '', isHighlighted);
            if (!Array.isArray(parsedMessage)) {
                parsedMessage = [parsedMessage];
            }
            break;
        }
        case 'chatmsg': {
            break;
        }
        case 'chatmsg-raw':
        case 'raw':
        case 'html': {
            break;
        }
        case 'error': {
            break;
        }
        case 'pm': {
            break;
        }
        case 'askreg': {
            break;
        }
        case 'inactive': {
            if (!this.kickingInactive) {
                this.kickingInactive = true;
            }
            if (args[1].slice(0, 11) === 'Time left: ') {
                this.kickingInactive = parseInt(args[1].slice(11), 10) || true;
                this.totalTimeLeft = parseInt(args[1].split(' | ')[1], 10);
                if (this.totalTimeLeft === this.kickingInactive) {
                    this.totalTimeLeft = 0;
                }
                return;
            } else if (args[1].slice(0, 9) === 'You have ') {
                // this is ugly but parseInt is documented to work this way
                // so I'm going to be lazy and not chop off the rest of the
                // sentence
                this.kickingInactive = parseInt(args[1].slice(9), 10) || true;
                return;
            } else if (args[1].slice(-14) === ' seconds left.') {
                let hasIndex = args[1].indexOf(' has ');
                let userid = (app && app.user && app.user.get('userid'));
                if (toId(args[1].slice(0, hasIndex)) === userid) {
                    this.kickingInactive = parseInt(args[1].slice(hasIndex + 5), 10) || true;
                }
            }
            break;
        }
        case 'inactiveoff': {
            this.kickingInactive = false;
            break;
        }
        case 'timer': {
            break;
        }
        case 'join':
        case 'j': {
            if (this.roomid) {
                let room = app.rooms[this.roomid];
                let user = args[1];
                let userid = toUserid(user);
                if (/^[a-z0-9]/i.test(user)) {
                    user = ' ' + user;
                }
                if (!room.users[userid]) {
                    room.userCount.users++;
                }
                room.users[userid] = user;
                room.userList.add(userid);
                room.userList.updateUserCount();
                room.userList.updateNoUsersOnline();
            }
            break;
        }
        case 'leave':
        case 'l': {
            if (this.roomid) {
                let room = app.rooms[this.roomid];
                let user = args[1];
                let userid = toUserid(user);
                if (room.users[userid]) {
                    room.userCount.users--;
                }
                delete room.users[userid];
                room.userList.remove(userid);
                room.userList.updateUserCount();
                room.userList.updateNoUsersOnline();
            }
            break;
        }
        case 'J':
        case 'L':
        case 'N':
        case 'n':
        case 'spectator':
        case 'spectatorleave': {
            break;
        }
        case 'player': {
            let side = this.getSide(args[1]);
            side.setName(args[2]);
            if (args[3]) {
                side.setAvatar(args[3]);
            }
            break;
        }
        case 'teamsize': {
            let side = this.getSide(args[1]);
            side.totalPokemon = parseInt(args[2], 10);
            break;
        }
        case 'win': {
            this.winner(args[1]);
            break;
        }
        case 'tie': {
            this.winner();
            break;
        }
        case 'prematureend': {
            this.prematureEnd();
            break;
        }
        case 'clearpoke': {
            this.p1.clearPokemon();
            this.p2.clearPokemon();
            break;
        }
        case 'poke': {
            let pokemon = this.getPokemon('new: ' + args[1], args[2]);
            if (args[3] === 'item') {
                pokemon.item = '(exists)';
            }
            break;
        }
        case 'detailschange': {
            let poke = this.getPokemon(args[1]);
            poke.removeVolatile('formechange');
            poke.removeVolatile('typeadd');
            poke.removeVolatile('typechange');
            let newSpecies = args[2];
            let commaIndex = newSpecies.indexOf(',');
            if (commaIndex !== -1) {
                let level = (newSpecies.substr(commaIndex + 1)).trim();
                if (level.charAt(0) === 'L') {
                    poke.level = parseInt(level.substr(1), 10);
                }
                newSpecies = args[2].substr(0, commaIndex);
            }
            let template = Tools.getTemplate(newSpecies);
            poke.species = newSpecies;
            poke.ability = poke.baseAbility = (template.abilities ? template.abilities['0'] : '');
            poke.weightkg = template.weightkg;
            poke.details = args[2];
            poke.searchid = args[1].substr(0, 2) + args[1].substr(3) + '|' + args[2];
            if (toId(newSpecies) === 'greninjaash') {
                this.message('' + poke.getName() + ' became Ash-Greninja!');
            } else if (toId(newSpecies) === 'mimikyubusted') {
                this.message('<small>' + poke.getName() + '\'s disguise was busted!</small>');
            } else if (toId(newSpecies) === 'zygardecomplete') {
                this.message('' + poke.getName() + ' transformed into its Complete Forme!');
            } else if (toId(newSpecies) === 'necrozmaultra') {
                this.message('' + poke.getName() + ' regained its true power through Ultra Burst!');
            }
            break;
        }
        case 'teampreview': {
            this.teamPreviewCount = parseInt(args[1], 10);
            break;
        }
        case 'switch':
        case 'drag':
        case 'replace': {
            this.endLastTurn();
            if (!this.hasPreMoveMessage && this.waitForResult()) {
                return;
            }
            this.hasPreMoveMessage = false;
            let poke = this.getPokemon('switchin: ' + args[1], args[2]);
            let slot = poke.slot;
            poke.healthParse(args[3]);
            poke.removeVolatile('itemremoved');
            if (args[0] === 'switch') {
                if (poke.side.active[slot]) {
                    poke.side.switchOut(poke.side.active[slot]);
                }
                poke.side.switchIn(poke);
            } else if (args[0] === 'replace') {
                poke.side.replace(poke);
            } else {
                poke.side.dragIn(poke);
            }
            break;
        }
        case 'faint': {
            if (this.waitForResult()) {
                return;
            }
            let poke = this.getPokemon(args[1]);
            poke.side.faint(poke);
            break;
        }
        case 'swap': {
            if (isNaN(Number(args[2]))) {
                let poke = this.getPokemon(args[1]);
                poke.side.swapWith(poke, this.getPokemon(args[2]), kwargs);
            } else {
                let poke = this.getPokemon(args[1]);
                poke.side.swapTo(poke, parseInt(args[2], 10), kwargs);
            }
            break;
        }
        case 'move': {
            this.endLastTurn();
            if ((!kwargs.from || kwargs.from === 'lockedmove') && !this.hasPreMoveMessage && this.waitForResult()) {
                return;
            }
            this.hasPreMoveMessage = false;
            this.resetTurnsSinceMoved();
            let poke = this.getPokemon(args[1]);
            let move = Tools.getMove(args[2]);
            if (this.checkActive(poke)) {
                return;
            }
            let poke2 = this.getPokemon(args[3]);
            this.useMove(poke, move, poke2, kwargs);
            break;
        }
        case 'cant': {
            this.endLastTurn();
            this.resetTurnsSinceMoved();
            if (!this.hasPreMoveMessage && this.waitForResult()) {
                return;
            }
            this.hasPreMoveMessage = false;
            let poke = this.getPokemon(args[1]);
            let effect = Tools.getEffect(args[2]);
            let move = Tools.getMove(args[3]);
            this.cantUseMove(poke, effect, move, kwargs);
            break;
        }
        case 'message': {
            this.message(Tools.escapeHTML(args[1]));
            break;
        }
        case 'bigerror': {
            this.message('<div class="broadcast-red">' + Tools.escapeHTML(args[1]).replace(/\|/g, '<br />') + '</div>');
            break;
        }
        case 'done':
        case '': {
            if (this.ended || this.endPrevAction()) {
                return;
            }
            break;
        }
        case 'warning': {
            this.message('<strong>Warning:</strong> ' + Tools.escapeHTML(args[1]));
            this.message('Bug? Report it to <a href="http://www.smogon.com/forums/showthread.php?t=3453192">the replay viewer\'s Smogon thread</a>');
            break;
        }
        case 'gen': {
            this.gen = parseInt(args[1], 10);
            break;
        }
        case 'callback': {
            args.shift();
            if (this.customCallback) {
                this.customCallback(this, args[0], args, kwargs);
            }
            break;
        }
        case 'debug': {
            args.shift();
            const name = args.join(' ');
            break;
        }
        case 'seed':
        case 'choice': {
            break;
        }
        case 'unlink': {
            if (Tools.prefs('nounlink')) {
                return;
            }
            let user = toId(args[2]) || toId(args[1]);
            let $messages = $('.chatmessage-' + user);
            if (!$messages.length) {
                break;
            }
            $messages.find('a').contents().unwrap();
            if (BattleRoom && args[2]) {
                $messages.hide().addClass('revealed').find('button').parent().remove();
            }
            break;
        }
        case 'fieldhtml': {
            this.playbackState = Playback.Seeking; // force seeking to prevent controls etc
            break;
        }
        case 'controlshtml': {
            $controls.html(Tools.sanitizeHTML(args[1]));
            break;
        }
        default: {
            if (this.errorCallback) {
                this.errorCallback(this);
            }
            break;
        }
        }
    }
    run(str, preempt) {
        if (!str) {
            return;
        }
        if (str.charAt(0) !== '|' || str.substr(0, 2) === '||') {
            if (str.charAt(0) === '|') {
                str = str.substr(2);
            }
            return;
        }
        let args = ['done'];
        let kwargs = {};
        if (str !== '|') {
            args = str.substr(1).split('|');
        }
        switch (args[0]) {
        case 'c':
        case 'c:':
        case 'chat':
        case 'chatmsg':
        case 'chatmsg-raw':
        case 'raw':
        case 'error':
        case 'html':
        case 'inactive':
        case 'inactiveoff':
        case 'warning':
        case 'fieldhtml':
        case 'controlshtml':
        case 'bigerror':
            // chat is preserved untouched
            args = [args[0], str.slice(args[0].length + 2)];
            break;
        default:
            // parse kwargs
            while (args.length) {
                let argstr = args[args.length - 1];
                if (argstr.substr(0, 1) !== '[') {
                    break;
                }
                let bracketPos = argstr.indexOf(']');
                if (bracketPos <= 0) {
                    break;
                }
                // default to '.' so it evaluates to boolean true
                kwargs[argstr.substr(1, bracketPos - 1)] = (argstr.substr(bracketPos + 1).trim() || '.');
                args.pop();
            }
        }
        // parse the next line if it's a minor: runMinor needs it parsed to determine when to merge minors
        let nextLine = '';
        let nextArgs = [''];
        let nextKwargs = {};
        nextLine = this.activityQueue[this.activityStep + 1] || '';
        if (nextLine && nextLine.substr(0, 2) === '|-') {
            nextLine = (nextLine.substr(1)).trim();
            nextArgs = nextLine.split('|');
            while (nextArgs[nextArgs.length - 1] && nextArgs[nextArgs.length - 1].substr(0, 1) === '[') {
                let bracketPos = nextArgs[nextArgs.length - 1].indexOf(']');
                if (bracketPos <= 0) {
                    break;
                }
                let argstr = nextArgs.pop();
                // default to '.' so it evaluates to boolean true
                nextKwargs[argstr.substr(1, bracketPos - 1)] = ((argstr.substr(bracketPos + 1)).trim() || '.');
            }
        }
        if (args[0].substr(0, 1) === '-') {
            this.runMinor(args, kwargs, preempt, nextArgs, nextKwargs);
        } else {
            this.runMajor(args, kwargs, preempt);
        }
        if (this.fastForward > 0 && this.fastForward < 1) {
            if (nextLine.substr(0, 6) === '|start') {
                this.fastForwardOff();
                if (this.endCallback) {
                    this.endCallback(this);
                }
            }
        }
    }
    endPrevAction() {
        this.hasPreMoveMessage = false;
        if (this.minorQueue.length) {
            this.runMinor();
            this.activityStep--;
            return true;
        }
        if (this.resultWaiting) {
            this.activityStep--;
            this.resultWaiting = false;
            this.activeMoveIsSpread = null;
            return true;
        }
        return false;
    }
    checkActive(poke) {
        // if (!poke.side.active[poke.slot]) {
        //     // SOMEONE jumped in in the middle of a replay. <_<
        //     poke.side.replace(poke);
        // }
        return false;
    }
    waitForResult() {
        if (this.endPrevAction()) {
            return true;
        }
        this.resultWaiting = true;
        return false;
    }
    pause() {
        this.paused = true;
        this.playbackState = Playback.Paused;
    }
    play() {
        this.paused = false;
        this.playbackState = Playback.Playing;
        this.nextActivity();
    }
    skipTurn() {
        this.fastForwardTo(this.turn + 1);
    }
    fastForwardTo(time) {
        if (this.fastForward) {
            return;
        }
        if (time === 0 || time === '0') {
            time = 0.5;
        } else {
            time = Math.floor(Number(time));
        }
        if (isNaN(time)) {
            return;
        }
        if (this.ended && time >= this.turn + 1) {
            return;
        }
        if (time <= this.turn && time !== -1) {
            let paused = this.paused;
            this.reset(true);
            if (paused) {
                this.pause();
            } else {
                this.paused = false;
            }
            this.fastForwardWillScroll = true;
        }
        this.playbackState = Playback.Seeking;
        this.fastForward = time;
        this.nextActivity();
    }
    fastForwardOff() {
        this.fastForward = 0;
        if (this.paused) {
            this.playbackState = Playback.Paused;
        } else {
            this.playbackState = Playback.Playing;
        }
    }
    nextActivity() {
        if (this.activityStep >= this.activityQueue.length) {
            return;
        }
        this.run(this.activityQueue[this.activityStep]);
        this.activityStep++;
        this.nextActivity();
    }
    newBattle() {
        this.reset();
        this.activityQueue = [];
    }
    setQueue(queue) {
        this.reset();
        this.activityQueue = queue;
        /* for (let i = 0; i < queue.length && i < 20; i++) {
            if (queue[i].substr(0, 8) === 'pokemon ') {
                let sp = this.parseSpriteData(queue[i].substr(8));
                BattleSound.loadEffect(sp.cryurl);
                this.preloadImage(sp.url);
                if (sp.url === '/sprites/bwani/meloetta.gif') {
                    this.preloadImage('/sprites/bwani/meloetta-pirouette.gif');
                }
                if (sp.url === '/sprites/bwani-back/meloetta.gif') {
                    this.preloadImage('/sprites/bwani-back/meloetta-pirouette.gif');
                }
            }
        } */
        this.playbackState = Playback.Ready;
    }
}

module.exports = Battle;
