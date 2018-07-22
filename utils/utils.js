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

module.exports = {splitFirst};
