const representation = require('../../src/state-representation/state-representation');
const dexData = require('../../Pokemon-Showdown/sim/dex-data');


test('test one hot encoding', () => {
    expect(representation.createOneHotEncoding(3, 5)).toEqual([0, 0, 0, 1, 0]);
});

test('test one hot encoding', () => {
    expect(representation.encodeAbility('contrary')).toEqual(
        [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    );
});

test('test encodeMove', () => {
    expect(representation.encodeMove(new dexData.Move({
        num: 71,
        accuracy: 100,
        basePower: 20,
        category: 'Special',
        // eslint-disable-next-line max-len
        desc: 'The user recovers 1/2 the HP lost by the target, rounded half up. If Big Root is held by the user, the HP recovered is 1.3x normal, rounded half down.',
        shortDesc: 'User recovers 50% of the damage dealt.',
        id: 'absorb',
        name: 'Absorb',
        pp: 25,
        priority: 0,
        flags: {protect: 1, mirror: 1, heal: 1},
        drain: [1, 2],
        secondary: false,
        target: 'normal',
        type: 'Grass',
        zMovePower: 100,
        contestType: 'Clever',
    }))).toEqual(
        [20, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]
    );
});

test('test encoding move that can not miss', () => {
    expect(representation.encodeMove(new dexData.Move({
        num: 622,
        accuracy: true,
        basePower: 1,
        category: 'Physical',
        shortDesc: 'Power is equal to the base move\'s Z-Power.',
        id: 'breakneckblitz',
        isViable: true,
        name: 'Breakneck Blitz',
        pp: 1,
        priority: 0,
        flags: {},
        isZ: 'normaliumz',
        secondary: false,
        target: 'normal',
        type: 'Normal',
        contestType: 'Cool',
    }))).toEqual(
        [1, 1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]
    );
});
