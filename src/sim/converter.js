'use strict';

/**
 * The base class for all converters.
 */
class Converter {
    /**
     * Convert the partially observed battle state to a fully observed battle instance using
     * sampling.
     *
     * @param {Battle} battle
     */
    sample(battle) {
        throw new Error('must be implemented by subclass');
    }
}

module.exports = Converter;
