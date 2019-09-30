var glob = require('glob')
const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const MT = require('./utils/MarkdownTransform')
const vuedoc = require('@vuedoc/md')
const jsdoc2md = require('jsdoc-to-markdown')

/**
 * Doc Builder configuration
 */
const match = 'front/**/*.vue'
const modulesNameFolder = 'Modules'

/**
 * @typedef {Object} metadata
 * @property {string} path - Path of the matched file
 * @property {string} type - File's type name
 * @property {string} module - Module's name
 * @property {string[]} prefixs - Prefixs file list, split with camelcase
 * @property {string} typeFile - File extension
 */

/**
 * Get all path files metadata comming form my own workflow
 * @param {array} files - An array of path file
 * @return {metadata[]} metadata - An array of metadata about my own workflow for each file
 */
function getProjectMetaDatas (files, {
  modulesFolderName = 'Modules'
}) {
  return files.map((v) => {
    let additionnalInfo = {
      typeFile: path.extname(v)
    }
    let subFolders = v.split('/')
    additionnalInfo['filename'] = subFolders[subFolders.length - 1].replace(/.[a-z]*$/, '')
    additionnalInfo['prefixs'] = additionnalInfo['filename'].split(/(?=[A-Z])/)
    if (subFolders.length > 0) {
      let module = subFolders.includes(modulesNameFolder)
      if (module) {
        let subFolderIndex = subFolders.indexOf(modulesNameFolder) + 1
        module = subFolders[subFolderIndex]
        // console.log('index', subFolderIndex + 2)
        // console.log('nb subfolders', subFolders.length)
        // console.log(subFolders.length !== subFolderIndex + 2)
        if (subFolders.length !== subFolderIndex + 2) {
          let componentType = subFolders[subFolderIndex + 1] || false
          additionnalInfo = Object.assign({}, additionnalInfo, {type: componentType})
        }
      }
      additionnalInfo = Object.assign({}, additionnalInfo, {module: module})
    }
    return Object.assign({}, {
      path: v
    }, additionnalInfo)
  })
}

/**
 * Remove excluded Files from excluded modules list and exluded types list
 * @param MetaFiles
 * @param excludeModules
 * @param excludeTypes
 * @param inModules
 */
function removeExcludesFiles (MetaFiles, excludeModules, excludeTypes, inModules = false) {
  return MetaFiles.filter(v => !excludeModules.includes(v.module)).filter(v => !excludeTypes.includes(v.type)).filter(v => !inModules || v.module !== false)
}

/**
 * Exclude metadata from a metadata list that's matching with the field and value pair
 * @param {metadata[]} MetaFiles - Array of metadata to exclude
 * @param {string} field - Name of the field where looking for
 * @param {string|string[]} value - Value field to exclude
 * @return {metadata[]} ExcludeMetadata - Array without excluded metadata
 */
function ExcludeMetadataWithFieldValue (MetaFiles, field, value) {
  return MetaFiles.filter(meta => {
    if (meta[field]) {
      if (Array.isArray(meta[field])) {
        return !meta[field].includes(value)
      } else {
        return meta[field] !== value
      }
    } else {
      console.warn('Field: "' + field + '" doesn\'t exists in metas')
      return MetaFiles
    }
  })
}

/**
 * Keep metadata from a metadata list that's matching with the field and value pair
 * @param MetaFiles
 * @param field
 * @param value
 * @returns {*}
 * @constructor
 */
function KeepMetadataWithFieldValue (MetaFiles, field, value) {
  if (Array.isArray(value) && value.length === 0) {
    return MetaFiles
  } else {
    return MetaFiles.filter(meta => {
      if (meta[field]) {
        if (Array.isArray(meta[field]) && !Array.isArray(value)) {
          return meta[field].includes(value)
        } else if (!Array.isArray(meta[field]) && Array.isArray(value)) {
          return value.includes(meta[field])
        } else if (Array.isArray(meta[field]) && Array.isArray(value)) {
          let hasToBeKeeped = false
          meta[field].forEach((f) => {
            if (!hasToBeKeeped) {
              hasToBeKeeped = value.includes(f)
            }
          })
          return hasToBeKeeped
        } else {
          return meta[field] === value
        }
      }
    })
  }
}

/**
 * Keep included files from incldes modules list, keep intact if the list is empty
 * @param MetaFiles
 * @param includesModules
 * @returns {array}
 */
function keepIncludesModules (MetaFiles, includesModules) {
  if (!includesModules.length) {
    return MetaFiles
  }
  return MetaFiles.filter(v => includesModules.includes(v.module))
}

/**
 * Format metadatas to return a metadata tree
 * @param Metadata
 * @returns {*|Uint8Array|any[]|Int32Array|Uint16Array}
 */
function convertMetadataToTree (Metadata) {
  let modulesGroup = groupByModules(Metadata)
  let types
  let tree = modulesGroup.map(module => {
    types = getTypeNames(module.files)
    module['types'] = types
    types.forEach(type => {
      let typeName = type || 'root'
      module[typeName] = module.files.filter(f => {
        return !f.type || type === f.type
      })
    })
    return module
    // modulesGroup[type] = Metadata.filter(m => m.type === type).map(v => v.file)
  })
  return tree
}

function groupeBy (Metadatas, groupe) {
}

/**
 * Group metadata by modules
 * @param Metadata
 * @returns {ModulesGroups}
 */
function groupByModules (Metadata) {
  let ModulesName = getModulesNames(Metadata)
  return ModulesName.map(m => {
    return {
      name: m,
      files: Metadata.filter(md => m === md.module)
    }
  })
}

/**
 * Get a list of all the modules names in the metadata list
 * @param {array} Metadata - Metadatas list
 * @return {array}
 */
function getModulesNames (Metadata) {
  debug.log(Metadata.length)
  if (Metadata.length === 1) {
    return [Metadata[0].module]
  }
  let modulesNames = Metadata.reduce((acc, curr) => {
    if (!Array.isArray(acc)) {
      acc = []
    }
    if (!acc.includes(curr.module)) {
      acc.push(curr.module)
    }
    return acc
  })
  return modulesNames
}

/**
 * Get types names
 * @param Metadata
 * @returns {*[]}
 */
function getTypeNames (Metadata) {
  if (Metadata.length === 1) {
    return [Metadata.type || false]
  }
  let typeNames = Metadata.reduce((acc, curr) => {
    // console.log(!Array.isArray(acc))
    if (!Array.isArray(acc)) {
      acc = []
    }
    if (!acc.includes(curr.type) && typeof curr.type !== 'undefined') {
      // console.log(curr.type)
      acc.push(curr.type)
    }
    return acc
  })
  return typeNames
}
let renderMethods = {
  renderTree: async function renderTree (MetaDatas, config) {
    let Modules = convertMetadataToTree(MetaDatas)
    debug.log(Modules)
    debug.log(MetaDatas)
    let newDoc = ''
    // debug.log(Modules)
    if (typeof config.beforeRender === 'function') {
      newDoc = config.beforeRender(MetaDatas, config)
    }
//     let newDoc = `
// # Vues modules
//
// `
    debug.log(config.tree)
    for (let module of Modules) {
      newDoc += `
## ${module.name} module
`
      if (module.types) {
        for (let type of module.types) {
          newDoc += `
### ${module.name} ${type}

`
          // console.log(type)
          if (type !== false) {
            for (let comp of module[type]) {
              try {
                let doc = await vuedoc.md({
                  filename: comp.path
                })
                newDoc += MT.updateSemanticTitles(doc)
                newDoc += `
source : ${comp.path}
`
              } catch (e) {
                console.log('=======================')
                console.log(`Problem with ${comp.path}`)
              }
            }
          }
        }
      }
    }
    return newDoc
  },
  render: async function render (metadatas, config) {
  },
  vuedoc: vuedoc.md,
  jsdoc2md: async function () {
    debug.log('js2doc')
  }
}

/**
 *
 * @param MetaData
 * @returns {Promise<boolean>}
 */
async function renderDispatch (MetaData, config) {
  if (config.tree) {
    renderMethods.renderTree(MetaData, config)
  } else if (config.renderMethod === false) {
    renderMethods.render(MetaData, config)
  } else if (config.renderMethod && typeof renderMethods[config.renderMethod] === 'function') {
    config(MetaData, config)
  } else if (typeof config.customRender === 'function') {
    config.customRender(MetaData, config)
  }
  let jsFiles = KeepMetadataWithFieldValue(MetaData, 'typeFile', '.js')
  let vueFiles = KeepMetadataWithFieldValue(MetaData, 'typeFile', '.vue')
  debug.log(jsFiles.length)
  if (vueFiles.length) {
  
  }
  if (jsFiles.length) {
    debug.log('js files to process')
    // throw "stop"
    // jsdoc2md.render()
  }
  return false
}
/**
 * Export Vue components form Modules Tree
 * @param {metadata[]} MetaDatas - That's will be extract
 * @returns {Promise<markdown>}
 */
async function extractsVueModules (MetaDatas) {
  let Modules = convertMetadataToTree(MetaDatas)
  debug.log(Modules)
  let newDoc = `
# Vues modules

`
  for (let module of Modules) {
    newDoc += `
## ${module.name} module
`
    if (module.types) {
      for (let type of module.types) {
        newDoc += `
### ${module.name} ${type}

`
        // console.log(type)
        if (type !== false) {
          for (let comp of module[type]) {
            try {
              let doc = await vuedoc.md({
                filename: comp.path
              })
              newDoc += MT.updateSemanticTitles(doc)
              newDoc += `
source : ${comp.path}
`
            } catch (e) {
              console.log('=======================')
              console.log(`Problem with ${comp.path}`)
            }
          }
        }
      }
    }
  }
  return newDoc
}

function getPartials (path) {
  // if (this)
}
let vueHeader = `---
sidebar: auto
collapsable: true
---

`
function createDocFile (docContent, output) {
  let stream = fs.createWriteStream(output)
  stream.once('open', function (fd) {
    stream.write(vueHeader)
    stream.write(docContent)
    stream.end()
  })
}

/**
 * Fetch all vue file component
 * @param {string} match - Glob request to match needed files to process
 */
module.exports = function buildDoc (config) {
  if (config.verbose) {
    console.log('-------------')
    console.log('Build doc for ' + config.input + ' request')
    console.log('In modules folder :', config.inModule)
    console.log('Include modules :')
    console.log(config.includeModules)
    console.log('Exclude modules :')
    console.log(config.excludeModules)
    console.log('Exclude types :')
    console.log(config.excludeTypes)
    console.log('In ' + config.output + ' folder')
    console.log('-------------')
  }
  // console.log(input)
  // console.log('./front/**/*.vue')
  glob(config.input, {}, function (err, files) {
    if (err) {
      console.error(err)
    }
    let MetaFiles = getProjectMetaDatas(files, {
      modulesFolderName: config.modulesFolderName
    })
    MetaFiles = keepIncludesModules(MetaFiles, config.includeModules)
    // debug.log(MetaFiles)
    // MetaFiles = KeepMetadataWithFieldValue(MetaFiles, 'module', ['Users', 'Accordeons'])
    // MetaFiles = ExcludeMetasWithFieldValue(MetaFiles, 'module', 'Users')
    let ToProcess = removeExcludesFiles(MetaFiles, config.excludeModules, config.excludeTypes, config.inModule)
    // let ToProcess = removeExcludesFiles(MetaFiles, excludeModules, excludeTypes, inModule)
    if (config.verbose) {
      console.log(ToProcess.length + ' files has been found for ' + config.input + ' request.')
    }
    // let Modules = convertMetadataToTree(ToProcess)
    let formatedDoc = ''
    renderDispatch(ToProcess, config).then(doc => {
      if (doc) {
        createDocFile(doc, config.output)
      } else {
        console.warn('No doc has been created, for ' + config.input + ' request')
      }
    }).catch(e => console.error(e))
  })
}

// vuedoc.md(options)
//   .then((document) => console.log(document))
//   .catch((err) => console.error(err))
