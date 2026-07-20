/**
 * Pick selected keys from an object.
 * @param {object} object
 * @param {string[]} keys
 */
export function pick(object, keys) {
  return keys.reduce((acc, key) => {
    if (object && Object.prototype.hasOwnProperty.call(object, key) && object[key] !== undefined) {
      acc[key] = object[key];
    }
    return acc;
  }, {});
}
