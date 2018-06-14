const fs = require('fs');
const path = require('path');
const is = require('is-type-of');
const intersect = require('@evio/intersect');
const { closestModuleDir, loadFile } = require('./file');

exports.sortDependencies = sortDependencies;
exports.analysisPlugins = analysisPlugins;

function analysisPlugins(list, { env, agent, framework, isAgent, cwd, base }) {
  const tree = {};
  const configKeys = Object.keys(list);
  if (configKeys.indexOf('project') > -1) {
    throw new Error('plugin alias name can not be `project`');
  }
  const preloadFile = isAgent ? 'agent.js' : 'app.js';
  for (const plugin in list) {
    const config = list[plugin];
    if (config.enable === undefined) config.enable = true;
    if (!config.env) config.env = [];
    if (!is.array(config.env)) config.env = [config.env];
    if (!config.agent) config.agent = [];
    if (!is.array(config.agent)) config.agent = [config.agent];
  
    if (!config.enable) {
      console.warn(`[${plugin} reject] config.enable = ${config.enable}; continue;`);
      continue;
    }
    if (env && config.env.length && config.env.indexOf(env) === -1) {
      console.warn(`[${plugin} reject] config.env = ${config.env}; continue;`);
      continue;
    }
    if (isAgent && agent) {
      if (!config.agent.length) {
        console.warn(`[${plugin} reject] config.agent = ${config.agent}; continue;`);
        continue;
      }
      if (config.agent.length && config.agent.indexOf(agent) === -1) {
        console.warn(`[${plugin} reject] config.agent = ${config.agent}; continue;`);
        continue;
      }
    }
  
    const pluginPackageName = config.package;
    const pluginPathName = config.path;
  
    if (!pluginPackageName && !pluginPathName) {
      throw new Error(`plugin of ${plugin} miss 'package' or 'path'`);
    }
  
    let pkgPath, modal, exportsPath;
  
    if (pluginPathName) {
      pkgPath = path.resolve(base, pluginPathName, 'package.json');
      if (!fs.existsSync(pkgPath)) {
        throw new Error(`plugin of ${plugin} miss 'package.json' in ${pkgPath}`);
      }
      modal = loadFile(pkgPath);
      exportsPath = path.resolve(base, pluginPathName, preloadFile);
    } else {
      const dir = closestModuleDir(cwd, pluginPackageName);
      modal = loadFile(dir + '/package.json');
      exportsPath = path.resolve(dir, preloadFile);
    }
  
    if (!modal.plugin) {
      throw new Error(`plugin of ${plugin}'s package.json miss 'plugin' property in ${pkgPath}`);
    }
    if (modal.plugin.name !== plugin) {
      throw new Error(`plugin of ${plugin}'s package.json which name is not matched in ${pkgPath}`);
    }
  
    if (!modal.plugin.framework) modal.plugin.framework = [];
    if (!is.array(modal.plugin.framework)) modal.plugin.framework = [modal.plugin.framework];
    if (modal.plugin.framework.length) {
      const indexFramework = modal.plugin.framework.indexOf(framework);
      if (indexFramework === -1) {
        console.warn(`[${plugin} reject] modal.plugin.framework = ${modal.plugin.framework}; continue;`);
        continue;
      }
    }
  
    const exportsFn = fs.existsSync(exportsPath) ? loadFile(exportsPath) : function noop() {};
    tree[plugin] = {
      dependencies: modal.plugin.dependencies || [],
      exports: exportsFn,
      dir: path.dirname(exportsPath)
    };
  
    if (config.dependencies) {
      if (!is.array(config.dependencies)) {
        config.dependencies = [config.dependencies];
      }
    } else {
      config.dependencies = [];
    }
  
    tree[plugin].dependencies = tree[plugin].dependencies.concat(config.dependencies);
  }
  
  return sortDependencies(tree, configKeys);
}

function sortDependencies(tree, configKeys) {
  const s = Object.keys(tree);
  const m = [];
  let j = s.length;
  while (j--) {
    const obj = tree[s[j]];
    if (obj.dependencies.length) {
      const res = intersect(obj.dependencies, configKeys);
      if (res.removes.length) {
        throw new Error(`模块[${s[j]}]依赖模块不存在：${res.removes.join(',')}`);
      }
    }
    Object.defineProperty(obj, 'deep', {
      get() {
        if (!obj.dependencies.length) return 0;
        return Math.max(...obj.dependencies.map(d => tree[d] ? tree[d].deep : 0)) + 1;
      }
    });
  }
  
  for (const i in tree) {
    tree[i].name = i;
    m.push(tree[i]);
  }
  return m.sort((a, b) => a.deep - b.deep);
}