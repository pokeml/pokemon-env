const representation = require('../../src/state-representation/state-representation');


test('test one hot encoding', () => {
    expect(representation.getOneHotEncoding(3, 5)).toEqual([0, 0, 0, 1, 0]);
});

test('test one hot encoding', () => {
    expect(representation.oneHotEncodeAbility("contrary")).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});