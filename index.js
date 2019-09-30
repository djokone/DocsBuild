let DocsBuilder = require('./DocsBuilder')
require('./utils/debug')
var glob = require('glob')
const path = require('path')
const fse = require('fs-extra')
const watch = require('node-watch')

const base = '../'
const defaultJsonConfPath = './docsbuilder.json'
const defaultJsConfPath = './docsBuilderConf.js'

var defaultDocsBuildersConfigs = {
  input: 'front/**/*.vue',
  output: '/docs/',
  inModule: false,
  verbose: true,
  tree: false,
  renderMethod: false,
  includeModules: [],
  excludeModules: [],
  excludeTypes: [],
  modulesFolderName: 'Modules'
}

/**
 * Get and Merge user configuration with the default one
 * @returns {Promise<Config>}
 */
async function initConfigsBuilder () {
  let confPath
  let exists = false
  let typeConfFile = 'json'
  const jsConfExist = await fse.pathExists(defaultJsConfPath)
  if (!jsConfExist) {
    typeConfFile = 'json'
    confPath = defaultJsonConfPath
    exists = await fse.pathExists(confPath)
  } else {
    typeConfFile = 'js'
    confPath = defaultJsConfPath
    exists = jsConfExist
  }
  if (!exists) {
    // console.log(base + defaultConfPath + ' conf doesn\'t exist please create it to continue !')
    throw new Error(confPath + ' conf doesn\'t exist please create it to continue !')
  } else {
    let conf = {}
    if (typeConfFile === 'json') {
      conf = await fse.readJson(confPath)
    } else if (typeConfFile === 'js') {
      try {
        conf = require(path.resolve(confPath))
      } catch (e) {
        console.error(path.resolve(confPath) + ' doesn\'t exist')
        throw e
      }
    }
    conf.builds = conf.builds.map(v => Object.assign({}, defaultDocsBuildersConfigs, v))
    return conf
  }
}

/**
 * Get the configuration file and lunch the documentation build
 * @returns {Promise<void>}
 */
async function startDocsBuilder () {
  let confs = await initConfigsBuilder()
  confs.builds.forEach(conf => DocsBuilder(conf))
  if (confs.watch) {
    watch(path.resolve('./front'), { recursive: true }, function (evt, name) {
      startDocsBuilder()
    })
  }
}

/**
 * Start building the documentation
 */
startDocsBuilder()
