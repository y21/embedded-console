# embedded-console
A minimalistic Chrome-like embedded console

## Features
- Tiny (few KB)
- No webpack or other bundling bullshit required
- Embeddable into any website
- Supports `console.{info|warn|log|error|assert}`
- `console.time` with nanosecond precision
- Formatting (e.g. `.log('%d', 5)`)
- Matching colors

# API
embedded-console supports most (common) functions that exist on the `console` object.

## `constructor(options?)`
Creates an instance of `EmbeddedConsole`.
## `.log(message, ...params)`
Logs a message to the console. You can provide as many arguments as you want. <br />
If a format specifier (e.g. `%d`, `%s`) is found, it replaces that with the next additional `param`. If there is no matching argument, it leaves the format specifier.
## `.info(message, ...params)`
Currently an alias for `.log()`, but will soon have special style that indicates it's an information log.

## `.warn(message, ...params)`
Logs a message with yellow background and a brighter font color. It's used to warn the user (as the name suggests.)

## `.error(message, ...params)`
Used to log (thrown) errors.

## `.assert(condition, message)`
Asserts a condition. If `condition` is tru(thy), the function call has no effect.
If it's false(y) an assertion error is logged. Optionally, a message can be provided that is printed if an assertion error occurs.

## `.time(identifier = 'default')`
Starts a timer that can be used to benchmark or time JavaScript code.
The identifier needs to be unique: you cannot have multiple timers with the same identifier running at the same time. <br />
If no `identifier` is provided, `default` will be used. This is also Chrome's behavior when calling `console.time` with no parameters.
> Note that there's a little bit of overhead when calling this function, however this shouldn't be too much of a problem (should be no more than 0.1ms)

## `.timeEnd(identifier = 'default')`
Ends a timer that was previously created using `.time()`. If no timer was found/previously registered with the given name, a warning is logged (matches Chrome's behavior). Calling this function will print the time difference in ms between the call to `.time()` and `.timeEnd()`. Internally it uses `performance.now()`.

## `.clear()`
Clears all logs.

---
[Demo](https://y21.github.io/embedded-console)<br/>

## Using it as a React component
If you want to use this in a project that uses a bundler like webpack, you can simply add `export default EmbeddedConsole;` to the very bottom of `console.js` and it should work! A demo can be found [here](https://gist.github.com/y21/049bf9cf9238339a6ae4984a4a15eb55).

## Example
See `index.html`
