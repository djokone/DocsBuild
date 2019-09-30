/**
 * Update semantic titles in a markdown input
 * @param {string} input - Markdown string content to update
 * @param {string} mode - 'up' for upgrade or 'down' for downgrade the importance
 * @param {number} semantic - Number of importance you want to add or remove to your titles
 * @todo Add downgrade mode
 */
function updateSemanticTitles (input, mode = 'up', semantic = 2) {
  let n = 0
  let rep = '#'
  while (n < semantic) {
    rep += '#'
    n++
  }
  return input.replace(/(#)\s/gi, '$1' + rep + ' ')
}

module.exports = {
  updateSemanticTitles
}
