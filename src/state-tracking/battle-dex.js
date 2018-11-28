'use strict';
/**
 * Pokemon Showdown Dex
 *
 * Roughly equivalent to sim/dex.js in a Pokemon Showdown server, but
 * designed for use in browsers rather than in Node.
 *
 * This is a generic utility library for Pokemon Showdown code: any
 * code shared between the replay viewer and the client usually ends up
 * here.
 *
 * Licensing note: PS's client has complicated licensing:
 * - The client as a whole is AGPLv3
 * - The battle replay/animation engine (battle-*.ts) by itself is MIT
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */

const BattleAbilities = require('../../Pokemon-Showdown/data/abilities').BattleAbilities;
const BattleAliases = require('../../Pokemon-Showdown/data/aliases').BattleAliases;
const BattleItems = require('../../Pokemon-Showdown/data/items').BattleItems;
const BattleMovedex = require('../../Pokemon-Showdown/data/moves').BattleMovedex;
const BattlePokedex = require('../../Pokemon-Showdown/data/pokedex').BattlePokedex;
const BattleTypeChart = require('../../Pokemon-Showdown/data/typechart').BattleTypeChart;
const BattleDexData = require('./battle-dex-data');
const baseSpeciesChart = BattleDexData.baseSpeciesChart;

/**
 * @param {AnyObject} target
 * @param {AnyObject} source
 * @return {AnyObject}
 */
function extend(target, source) {
    target = target || {};
    for (let prop in source) {
        if (typeof source[prop] === 'object') {
            target[prop] = extend(target[prop], source[prop]);
        } else {
            target[prop] = source[prop];
        }
    }
    return target;
}

/* eslint-disable no-extend-native */
if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function(searchElement, fromIndex) {
        for (let i = (fromIndex || 0); i < this.length; i++) {
            if (this[i] === searchElement) {
                return i;
            }
        }
        return -1;
    };
}
if (!Array.prototype.includes) {
    Array.prototype.includes = function(thing) {
        return this.indexOf(thing) !== -1;
    };
}
if (!String.prototype.includes) {
    String.prototype.includes = function(thing) {
        return this.indexOf(thing) !== -1;
    };
}
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(thing) {
        return this.slice(0, thing.length) === thing;
    };
}
if (!String.prototype.endsWith) {
    String.prototype.endsWith = function(thing) {
        return this.slice(-thing.length) === thing;
    };
}
if (!Object.assign) {
    Object.assign = function(thing, rest) {
        for (let i = 1; i < arguments.length; i++) {
            // eslint-disable-next-line prefer-rest-params
            let source = arguments[i];
            // eslint-disable-next-line guard-for-in
            for (let k in source) {
                thing[k] = source[k];
            }
        }
        return thing;
    };
}
/* eslint-enable no-extend-native */

/**
 * @param {string} str
 * @return {string}
 */
function getString(str) {
    if (typeof str === 'string' || typeof str === 'number') {
        return '' + str;
    }
    return '';
}
/**
 * @param {string | number} text
 * @return {string}
 */
function toId(text) {
    if (text && text.id) {
        text = text.id;
    } else if (text && text.userid) {
        text = text.userid;
    }
    if (typeof text !== 'string' && typeof text !== 'number') {
        return '';
    }
    return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}
const Tools = {
    escapeFormat(formatid) {
        let atIndex = formatid.indexOf('@@@');
        if (atIndex >= 0) {
            return Tools.escapeFormat(formatid.slice(0, atIndex)) + '<br />Custom rules: ' +
                   Tools.escapeHTML(formatid.slice(atIndex + 3));
        }
        if (BattleFormats && BattleFormats[formatid]) {
            return Tools.escapeHTML(BattleFormats[formatid].name);
        }
        return Tools.escapeHTML(formatid);
    },
    parseMessage(str) {
        // Don't format console commands (>>).
        if (str.substr(0, 3) === '>> ' || str.substr(0, 4) === '>>> ') {
            return Tools.escapeHTML(str);
        }
        // Don't format console results (<<).
        if (str.substr(0, 3) === '<< ') {
            return Tools.escapeHTML(str);
        }
        str = formatText(str);
        let options = Tools.prefs('chatformatting') || {};
        if (options.hidelinks) {
            str = str.replace(/<a[^>]*>/g, '<u>').replace(/<\/a>/g, '</u>');
        }
        if (options.hidespoiler) {
            str = str.replace(/<span class="spoiler">/g, '<span class="spoiler spoiler-shown">');
        }
        if (options.hidegreentext) {
            str = str.replace(/<span class="greentext">/g, '<span>');
        }
        return str;
    },
    escapeHTML(str, jsEscapeToo) {
        str = getString(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        if (jsEscapeToo) {
            str = str.replace(/'/g, '\\\'');
        }
        return str;
    },
    unescapeHTML(str) {
        str = (str ? '' + str : '');
        return str
            .replace(/&quot;/g, '"')
            .replace(/&gt;/g, '>')
            .replace(/&lt;/g, '<')
            .replace(/&amp;/g, '&');
    },
    escapeRegExp(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
    },
    escapeQuotes(str) {
        str = (str ? '' + str : '');
        str = str.replace(/'/g, '\\\'');
        return str;
    },
    safeJSON(callback) {
        return function(data) {
            if (data.length < 1) {
                return;
            }
            if (data[0] == ']') {
                data = data.substr(1);
            }
            return callback($.parseJSON(data));
        };
    },
    getShortName(name) {
        let shortName = name.replace(/[^A-Za-z0-9]+$/, '');
        if (shortName.indexOf('(') >= 0) {
            shortName += name.slice(shortName.length).replace(/[^\(\)]+/g, '').replace(/\(\)/g, '');
        }
        return shortName;
    },
    getEffect(effect) {
        if (!effect || typeof effect === 'string') {
            let name = (effect || '').trim();
            if (name.substr(0, 5) === 'item:') {
                return Tools.getItem(name.substr(5));
            } else if (name.substr(0, 8) === 'ability:') {
                return Tools.getAbility(name.substr(8));
            } else if (name.substr(0, 5) === 'move:') {
                return Tools.getMove(name.substr(5));
            }
            let id = toId(name);
            effect = {};
            // if (id && BattleStatuses && BattleStatuses[id]) {
            //     effect = BattleStatuses[id];
            //     effect.exists = true;
            // }
            // else if (...) {
            if (id && BattleMovedex && BattleMovedex[id] && BattleMovedex[id].effect) {
                effect = BattleMovedex[id].effect;
                effect.exists = true;
            } else if (id && BattleAbilities && BattleAbilities[id] && BattleAbilities[id].effect) {
                effect = BattleAbilities[id].effect;
                effect.exists = true;
            } else if (id && BattleItems && BattleItems[id] && BattleItems[id].effect) {
                effect = BattleItems[id].effect;
                effect.exists = true;
            } else if (id === 'recoil') {
                effect = {
                    effectType: 'Recoil',
                };
                effect.exists = true;
            } else if (id === 'drain') {
                effect = {
                    effectType: 'Drain',
                };
                effect.exists = true;
            }
            if (!effect.id) {
                effect.id = id;
            }
            if (!effect.name) {
                effect.name = Tools.escapeHTML(name);
            }
            if (!effect.category) {
                effect.category = 'Effect';
            }
            if (!effect.effectType) {
                effect.effectType = 'Effect';
            }
        }
        return effect;
    },
    getMove(move) {
        if (!move || typeof move === 'string') {
            let name = (move || '').trim();
            let id = toId(name);
            move = (BattleMovedex && BattleMovedex[id]) || {};
            if (move.name) {
                move.exists = true;
            }
            if (!move.exists && id.substr(0, 11) === 'hiddenpower' && id.length > 11) {
                let matches = /([a-z]*)([0-9]*)/.exec(id);
                move = (BattleMovedex && BattleMovedex[matches[1]]) || {};
                move = {...move};
                move.basePower = matches[2];
            }
            if (!move.exists && id.substr(0, 6) === 'return' && id.length > 6) {
                move = (BattleMovedex && BattleMovedex['return']) || {};
                move = {...move};
                move.basePower = id.slice(6);
            }
            if (!move.exists && id.substr(0, 11) === 'frustration' && id.length > 11) {
                move = (BattleMovedex && BattleMovedex['frustration']) || {};
                move = {...move};
                move.basePower = id.slice(11);
            }
            if (!move.id) {
                move.id = id;
            }
            if (!move.name) {
                move.name = Tools.escapeHTML(name);
            }
            if (!move.critRatio) {
                move.critRatio = 1;
            }
            if (!move.baseType) {
                move.baseType = move.type;
            }
            if (!move.effectType) {
                move.effectType = 'Move';
            }
            if (!move.secondaries && move.secondary) {
                move.secondaries = [move.secondary];
            }
            if (!move.flags) {
                move.flags = {};
            }
            if (!move.gen) {
                if (move.num >= 560) {
                    move.gen = 6;
                } else if (move.num >= 468) {
                    move.gen = 5;
                } else if (move.num >= 355) {
                    move.gen = 4;
                } else if (move.num >= 252) {
                    move.gen = 3;
                } else if (move.num >= 166) {
                    move.gen = 2;
                } else if (move.num >= 1) {
                    move.gen = 1;
                } else {
                    move.gen = 0;
                }
            }
        }
        return move;
    },
    getCategory(move, gen, type) {
        if (gen <= 3 && move.category !== 'Status') {
            return ((type || move.type) in {
                Fire: 1, Water: 1, Grass: 1, Electric: 1, Ice: 1, Psychic: 1, Dark: 1, Dragon: 1,
            } ? 'Special' : 'Physical');
        }
        return move.category;
    },
    getItem(item) {
        if (!item || typeof item === 'string') {
            let name = (item || '').trim();
            let id = toId(name);
            item = (BattleItems && BattleItems[id]) || {};
            if (item.name) {
                item.exists = true;
            }
            if (!item.id) {
                item.id = id;
            }
            if (!item.name) {
                item.name = Tools.escapeHTML(name);
            }
            if (!item.category) {
                item.category = 'Effect';
            }
            if (!item.effectType) {
                item.effectType = 'Item';
            }
            if (!item.gen) {
                if (item.num >= 577) {
                    item.gen = 6;
                } else if (item.num >= 537) {
                    item.gen = 5;
                } else if (item.num >= 377) {
                    item.gen = 4;
                } else {
                    item.gen = 3;
                }
            }
        }
        return item;
    },
    getAbility(ability) {
        if (!ability || typeof ability === 'string') {
            let name = (ability || '').trim();
            let id = toId(name);
            ability = (BattleAbilities && BattleAbilities[id]) || {};
            if (ability.name) {
                ability.exists = true;
            }
            if (!ability.id) {
                ability.id = id;
            }
            if (!ability.name) {
                ability.name = Tools.escapeHTML(name);
            }
            if (!ability.category) {
                ability.category = 'Effect';
            }
            if (!ability.effectType) {
                ability.effectType = 'Ability';
            }
            if (!ability.gen) {
                if (ability.num >= 165) {
                    ability.gen = 6;
                } else if (ability.num >= 124) {
                    ability.gen = 5;
                } else if (ability.num >= 77) {
                    ability.gen = 4;
                } else if (ability.num >= 1) {
                    ability.gen = 3;
                } else {
                    ability.gen = 0;
                }
            }
        }
        return ability;
    },
    getTemplate(template) {
        if (!template || typeof template === 'string') {
            let name = template;
            let id = toId(name);
            let speciesid = id;
            if (BattleAliases && BattleAliases[id]) {
                name = BattleAliases[id];
                id = toId(name);
            }
            if (!id) {
                name = '';
            }
            if (!BattlePokedex) {
                BattlePokedex = {};
            }
            if (!BattlePokedex[id]) {
                template = BattlePokedex[id] = {};
                for (let i = 0; i < baseSpeciesChart.length; i++) {
                    let baseid = baseSpeciesChart[i];
                    if (id.length > baseid.length && id.substr(0, baseid.length) === baseid) {
                        template.baseSpecies = baseid;
                        template.forme = id.substr(baseid.length);
                    }
                }
                if (id !== 'yanmega' && id.slice(-4) === 'mega') {
                    template.baseSpecies = id.slice(0, -4);
                    template.forme = id.slice(-4);
                } else if (id.slice(-6) === 'primal') {
                    template.baseSpecies = id.slice(0, -6);
                    template.forme = id.slice(-6);
                } else if (id.slice(-5) === 'alola') {
                    template.baseSpecies = id.slice(0, -5);
                    template.forme = id.slice(-5);
                }
                template.exists = false;
            }
            template = BattlePokedex[id];
            if (template.species) {
                name = template.species;
            }
            if (template.exists === undefined) {
                template.exists = true;
            }
            if (!template.id) {
                template.id = id;
            }
            if (!template.name) {
                template.name = name = Tools.escapeHTML(name);
            }
            if (!template.speciesid) {
                template.speciesid = id;
            }
            if (!template.species) {
                template.species = name;
            }
            if (!template.baseSpecies) {
                template.baseSpecies = name;
            }
            if (!template.forme) {
                template.forme = '';
            }
            if (!template.formeLetter) {
                template.formeLetter = '';
            }
            if (!template.formeid) {
                let formeid = '';
                if (template.baseSpecies !== name) {
                    formeid = '-' + toId(template.forme);
                }
                template.formeid = formeid;
            }
            if (!template.spriteid) {
                template.spriteid = toId(template.baseSpecies) + template.formeid;
            }
            if (!template.effectType) {
                template.effectType = 'Template';
            }
            if (!template.gen) {
                if (template.forme && template.formeid in {'-mega': 1, '-megax': 1, '-megay': 1}) {
                    template.gen = 6;
                    template.isMega = true;
                    template.battleOnly = true;
                } else if (template.formeid === '-primal') {
                    template.gen = 6;
                    template.isPrimal = true;
                    template.battleOnly = true;
                } else if (template.formeid.slice(-5) === 'totem') {
                    template.gen = 7;
                    template.isTotem = true;
                } else if (template.formeid === '-alola') {
                    template.gen = 7;
                } else if (template.num >= 722) {
                    template.gen = 7;
                } else if (template.num >= 650) {
                    template.gen = 6;
                } else if (template.num >= 494) {
                    template.gen = 5;
                } else if (template.num >= 387) {
                    template.gen = 4;
                } else if (template.num >= 252) {
                    template.gen = 3;
                } else if (template.num >= 152) {
                    template.gen = 2;
                } else if (template.num >= 1) {
                    template.gen = 1;
                } else {
                    template.gen = 0;
                }
            }
            if (template.otherForms && template.otherForms.indexOf(speciesid) >= 0) {
                if (!BattlePokedexAltForms) {
                    BattlePokedexAltForms = {};
                }
                if (!BattlePokedexAltForms[speciesid]) {
                    template = BattlePokedexAltForms[speciesid] = extend({}, template);
                    let form = speciesid.slice(template.baseSpecies.length);
                    let formid = '-' + form;
                    form = form[0].toUpperCase() + form.slice(1);
                    template.form = form;
                    template.species = template.baseSpecies + (form ? '-' + form : '');
                    template.speciesid = toId(template.species);
                    template.spriteid = toId(template.baseSpecies) + formid;
                }
                template = BattlePokedexAltForms[speciesid];
            }
            if (template.spriteid.slice(-5) === 'totem') {
                template.spriteid = template.spriteid.slice(0, -5);
            }
            if (template.spriteid.slice(-1) === '-') {
                template.spriteid = template.spriteid.slice(0, -1);
            }
        }
        return template;
    },
    getType(type) {
        if (!type || typeof type === 'string') {
            let id = toId(type);
            id = id.substr(0, 1).toUpperCase() + id.substr(1);
            type = (BattleTypeChart && BattleTypeChart[id]) || {};
            if (type.damageTaken) {
                type.exists = true;
            }
            if (!type.id) {
                type.id = id;
            }
            if (!type.name) {
                type.name = id;
            }
            if (!type.effectType) {
                type.effectType = 'Type';
            }
        }
        return type;
    },
    getAbilitiesFor(template, gen = 7) {
        template = this.getTemplate(template);
        if (gen < 3 || !template.abilities) {
            return {};
        }
        const id = template.id;
        const templAbilities = template.abilities;
        const table = (gen >= 7 ? null : BattleTeambuilderTable['gen' + gen]);
        const abilities = {};
        if (!table) {
            return Object.assign(abilities, templAbilities);
        }
        if (table.overrideAbility && id in table.overrideAbility) {
            abilities['0'] = table.overrideAbility[id];
        } else {
            abilities['0'] = templAbilities['0'];
        }
        const removeSecondAbility = table.removeSecondAbility && id in table.removeSecondAbility;
        if (!removeSecondAbility && templAbilities['1']) {
            abilities['1'] = templAbilities['1'];
        }
        if (gen >= 5 && templAbilities['H']) {
            abilities['H'] = templAbilities['H'];
        }
        if (gen >= 7 && templAbilities['S']) {
            abilities['S'] = templAbilities['S'];
        }
        return abilities;
    },
    hasAbility: function(template, ability, gen = 7) {
        const abilities = this.getAbilitiesFor(template, gen);
        for (const i in abilities) {
            if (ability === abilities[i]) {
                return true;
            }
        }
        return false;
    },
    loadedSpriteData: {'xy': 1, 'bw': 0},
    loadSpriteData(gen) {
        if (this.loadedSpriteData[gen]) {
            return;
        }
        this.loadedSpriteData[gen] = 1;
        let path = $('script[src*="pokedex-mini.js"]').attr('src') || '';
        let qs = '?' + (path.split('?')[1] || '');
        path = (path.match(/.+?(?=data\/pokedex-mini\.js)/) || [])[0] || '';
        let el = document.createElement('script');
        el.src = path + 'data/pokedex-mini-bw.js' + qs;
        document.getElementsByTagName('body')[0].appendChild(el);
    },
    getSpriteData(pokemon, siden, options = {gen: 6}) {
        if (!options.gen) {
            options.gen = 6;
        }
        if (pokemon instanceof Pokemon) {
            if (pokemon.volatiles.transform) {
                options.shiny = pokemon.volatiles.transform[2];
                options.gender = pokemon.volatiles.transform[3];
            } else {
                options.shiny = pokemon.shiny;
                options.gender = pokemon.gender;
            }
            pokemon = pokemon.getSpecies();
        }
        const template = Tools.getTemplate(pokemon);
        let spriteData = {
            w: 96,
            h: 96,
            y: 0,
            url: Tools.resourcePrefix + 'sprites/',
            pixelated: true,
            isBackSprite: false,
            cryurl: '',
            shiny: options.shiny,
        };
        let name = template.spriteid;
        let dir; let facing;
        if (siden) {
            dir = '';
            facing = 'front';
        } else {
            spriteData.isBackSprite = true;
            dir = '-back';
            facing = 'back';
        }
        // Decide what gen sprites to use.
        let fieldGenNum = options.gen;
        if (Tools.prefs('nopastgens')) {
            fieldGenNum = 6;
        }
        if (Tools.prefs('bwgfx') && fieldGenNum >= 6) {
            fieldGenNum = 5;
        }
        let genNum = Math.max(fieldGenNum, Math.min(template.gen, 5));
        let gen = ['', 'rby', 'gsc', 'rse', 'dpp', 'bw', 'xy', 'xy'][genNum];
        let animationData = null;
        let miscData = null;
        let speciesid = template.speciesid;
        if (template.isTotem) {
            speciesid = toId(name);
        }
        if (gen === 'xy' && BattlePokemonSprites) {
            animationData = BattlePokemonSprites[speciesid];
        }
        if (gen === 'bw' && BattlePokemonSpritesBW) {
            animationData = BattlePokemonSpritesBW[speciesid];
        }
        if (BattlePokemonSprites) {
            miscData = BattlePokemonSprites[speciesid];
        }
        if (!miscData && BattlePokemonSpritesBW) {
            miscData = BattlePokemonSpritesBW[speciesid];
        }
        if (!animationData) {
            animationData = {};
        }
        if (!miscData) {
            miscData = {};
        }
        if (miscData.num > 0) {
            spriteData.cryurl = 'audio/cries/' + toId(template.baseSpecies);
            let formeid = template.formeid;
            if (
                template.isMega || formeid && (
                    formeid === '-sky' || formeid === '-therian'
                    || formeid === '-primal' || formeid === '-eternal'
                    || template.baseSpecies === 'Kyurem' || formeid === '-super'
                    || formeid === '-unbound' || formeid === '-midnight' || formeid === '-school'
                    || template.baseSpecies === 'Oricorio' || template.baseSpecies === 'Zygarde'
                )
            ) {
                spriteData.cryurl += formeid;
            }
            spriteData.cryurl += (window.nodewebkit ? '.ogg' : '.mp3');
        }
        if (options.shiny && options.gen > 1) {
            dir += '-shiny';
        }
        if (animationData[facing + 'f'] && options.gender === 'F') {
            facing += 'f';
        }
        let allowAnim = !Tools.prefs('noanim') && !Tools.prefs('nogif');
        if (allowAnim && genNum >= 6) {
            spriteData.pixelated = false;
        }
        if (allowAnim && animationData[facing] && genNum >= 5) {
            if (facing.slice(-1) === 'f') {
                name += '-f';
            }
            dir = gen + 'ani' + dir;
            spriteData.w = animationData[facing].w;
            spriteData.h = animationData[facing].h;
            spriteData.url += dir + '/' + name + '.gif';
        } else {
            // There is no entry or enough data in pokedex-mini.js
            // Handle these in case-by-case basis; either using BW sprites or matching the played
            // gen.
            if (gen === 'xy') {
                gen = 'bw';
            }
            dir = gen + dir;
            // Gender differences don't exist prior to Gen 4,
            // so there are no sprites for it
            if (genNum >= 4 && miscData['frontf'] && options.gender === 'F') {
                name += '-f';
            }
            spriteData.url += dir + '/' + name + '.png';
        }
        if (!options.noScale) {
            if (fieldGenNum > 5) {
                // no scaling
            } else if (!spriteData.isBackSprite || fieldGenNum === 5) {
                spriteData.w *= 2;
                spriteData.h *= 2;
                spriteData.y += -16;
            } else {
                // backsprites are multiplied 1.5x by the 3D engine
                spriteData.w *= 2 / 1.5;
                spriteData.h *= 2 / 1.5;
                spriteData.y += -11;
            }
            if (fieldGenNum === 5) {
                spriteData.y = -35;
            }
            if (fieldGenNum === 5 && spriteData.isBackSprite) {
                spriteData.y += 40;
            }
            if (genNum <= 2) {
                spriteData.y += 2;
            }
        }
        if (template.isTotem && !options.noScale) {
            spriteData.w *= 1.5;
            spriteData.h *= 1.5;
            spriteData.y += -11;
        }
        return spriteData;
    },
};

module.exports = Tools;
