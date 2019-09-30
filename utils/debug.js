Function.prototype.clone = function () {
  let that = this
  let temp = function temporary () { return that.apply(this, arguments) }
  for (var key in this) {
    if (this.hasOwnProperty(key)) {
      temp[key] = this[key]
    }
  }
  return temp
}
debug = {}
const meths = ['log', 'warn', 'error']
meths.forEach((meth) => {
  debug[meth] = console[meth].clone()
})
meths.forEach((methodName) => {
  const originalMethod = debug[methodName]
  debug[methodName] = (...args) => {
    try {
      throw new Error()
    } catch (error) {
      originalMethod.apply(
        debug,
        [
          (
            error
              .stack // Grabs the stack trace
              .split('\n')[2] // Grabs third line
              .trim() // Removes spaces
              .substring(3) // Removes three first characters ("at ")
              .replace(__dirname, '') // Removes script folder path
              .replace(/\s\(./, ' function at ') // Removes first parentheses and replaces it with " at "
              .replace(/\)/, '') // Removes last parentheses
          ),
          '\n',
          ...args
        ]
      )
    }
  }
})
