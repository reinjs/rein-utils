module.exports = {};

merge('./lib/file');
merge('./lib/argv');
merge('./lib/plugin');

function merge(file) {
  Object.assign(module.exports, require(file));
}