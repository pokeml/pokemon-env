/**
 * Like string.split(delimiter), but only recognizes the first `limit`
 * delimiters (default 1).
 *
 * `"1 2 3 4".split(" ", 2) => ["1", "2"]`
 *
 * `Chat.splitFirst("1 2 3 4", " ", 1) => ["1", "2 3 4"]`
 *
 * Returns an array of length exactly limit + 1.
 *
 * @param {string} str
 * @param {string} delimiter
 * @param {number} [limit]
 * @return {string[]}
 */
function splitFirst(str, delimiter, limit = 1) {
    let splitStr = /** @type {string[]} */ ([]);
    while (splitStr.length < limit) {
        let delimiterIndex = str.indexOf(delimiter);
        if (delimiterIndex >= 0) {
            splitStr.push(str.slice(0, delimiterIndex));
            str = str.slice(delimiterIndex + delimiter.length);
        } else {
            splitStr.push(str);
            str = '';
        }
    }
    splitStr.push(str);
    return splitStr;
};

/**
 * Converts anything to an ID. An ID must have only lowercase alphanumeric
 * characters.
 * If a string is passed, it will be converted to lowercase and
 * non-alphanumeric characters will be stripped.
 * If an object with an ID is passed, its ID will be returned.
 * Otherwise, an empty string will be returned.
 *
 * @param {Object} text
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

module.exports = {splitFirst, toId};
