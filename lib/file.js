const fs = require('fs');
const path = require('path');
const findRoot = require('find-root');

const initCwd = process.cwd();

exports.loadFile = function(filepath) {
  try {
    const extname = path.extname(filepath);
    if (!['.js', '.node', '.json', ''].includes(extname)) {
      return fs.readFileSync(filepath);
    }
    const obj = require(filepath);
    if (!obj) return obj;
    if (obj.__esModule) return 'default' in obj ? obj.default : obj;
    return obj;
  } catch (err) {
    err.message = `load file: ${filepath}, error: ${err.message}`;
    throw err;
  }
};

exports.closestModuleDir = function(cwd, module_name) {
  const closestPackageFile = findRoot(cwd);
  if (!closestPackageFile) {
    throw new Error(`can not find the closest cwd by '${cwd}'.`);
  }
  const module_path = path.resolve(closestPackageFile, 'node_modules', module_name);
  if (!fs.existsSync(module_path)) {
    throw new Error('can not find the module of ' + module_name + ':' + module_path);
  }
  return module_path;
};