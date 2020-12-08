const EmbeddedConsole = (() => {

  const placeholders = new Set([...'oOdisf']);

  const COLLAPSED_CHAR = '…';
  const COLLAPSED_ARROW_RAW = '⯈';
  const EXPANDED_ARROW_RAW = '⯆';
  const MAX_COLLAPSED_PROPERTIES = 5;

  const ClassNames = Object.freeze({
    NULLISH: 'ec-nullish',
    STRING: 'ec-string',
    // Strings in object literals have the same style as regular expressions
    STRING_OBJECT: 'ec-regexp',
    NUMERIC: 'ec-numeric',
    REGEXP: 'ec-regexp',
    OBJECT: 'ec-object',
    FUNCTION: 'ec-function',
    // Object properties that are not enumerable have a pink-ish color
    OBJECT_HIDDEN_PROPERTY: 'ec-hidden',
    // Set and Map both have the same style as objects
    // They have separate properties so it will be easier to change it
    SET: 'ec-object',
    MAP: 'ec-object',
    FUNCTION_SIGNATURE: 'ec-function-signature',
    ARROW: 'ec-collapse-arrow',
    // All other "unknown" types have the same style as regular strings
    DEFAULT: 'ec-string',

    WARNING: 'ec-warning',
    LOG: 'ec-log',
    ERROR: 'ec-error'
  });

  const FUNCTION_SIGNATURE_PREFIX = wrapInSpan(ClassNames.FUNCTION_SIGNATURE, 'ƒ ', false);
  const COLLAPSED_ARROW = wrapInSpan(ClassNames.ARROW, COLLAPSED_ARROW_RAW, false);
  const EXPANDED_ARROW = wrapInSpan(ClassNames.ARROW, EXPANDED_ARROW_RAW, false);


  // Helper functions for getting the type of a value
  const is = {
    nullish: (value) => value === null || value === undefined,
    number: (value) => typeof value === 'number',
    bool: (value) => typeof value === 'boolean',
    string: (value) => typeof value === 'string',
    bigint: (value) => typeof value === 'bigint',
    function: (value) => typeof value === 'function',
    array: (value) => Array.isArray(value),
    error: (value) => value instanceof Error,
    regexp: (value) => value instanceof RegExp,
    set: (value) => value instanceof Set,
    map: (value) => value instanceof Map,
    loseObject(value) {
      return !this.nullish(value) && typeof value === 'object'
    },
    strictObject(value) {
      return this.loseObject(value) && !Array.isArray(value)
    },
  };

  function escapeHtml(value) {
    if (typeof value !== 'string') value = String(value);

    let result = '';
    for (let i = 0; i < value.length; ++i) {
      const char = value[i];

      switch (char) {
        case '<':
          result += '&lt;';
          break;
        case '>':
          result += '&gt;';
          break;
        case ' ':
          result += '&nbsp;';
          break;
        case '\n':
          result += '<br />';
          break;
        default:
          result += char;
          break;
      }
    }
    return result;
  }

  function wrapInSpan(className, value, doEscape = true) {
    const escaped = doEscape ? escapeHtml(value) : value;

    return `<span class="${className}">${escaped}</span>`;
  }

  function trimString(str, maxLen = 100) {
    const len = Math.min(str.length, maxLen);

    return str.substr(0, len) + (str.length > maxLen ? COLLAPSED_CHAR : '');
  }

  function inspect(
    value,
    visited = new WeakSet(),
    inObject = false,
    collapsed = true
  ) {
    const self = (value, inObject, collapsed) => inspect(value, visited, inObject, collapsed);
    const selfRecursive = (value) => {
      visited.add(value);
      return recursiveInspect(value, visited, inObject, collapsed);
    }
    const ARROW = collapsed ? COLLAPSED_ARROW : EXPANDED_ARROW;

    if (is.string(value)) {
      if (inObject) {
        // Strings in object literals look different:
        // They are surrounded by double quotes and look like RegExp literals
        // To see the difference, run this in chrome console:
        // console.log('test') // console.log(['test'])

        // Chrome also cuts strings if they are too long
        return wrapInSpan(ClassNames.STRING_OBJECT, `"${trimString(value)}"`);
      }

      return wrapInSpan(ClassNames.STRING, value);
    }

    else if (is.nullish(value)) {
      return wrapInSpan(ClassNames.NULLISH, value);
    }
    
    else if (is.error(value)) {
      // Error objects are special cases and need to be handled
      // since otherwise they'd be inspected and treated as a regular object
      // Chrome console seems to just stringify it, rather than fully inspecting
      return wrapInSpan(ClassNames.DEFAULT, value.stack || value);
    }
    
    else if (is.regexp(value)) {
      return wrapInSpan(ClassNames.REGEXP, value);
    }
    
    else if (is.set(value)) {
      const prefix = `Set(${value.size})`;
      const inspected = Array.from(value.keys())
        .map((k) => self(k, true))
        .join(', ');

      const fmt = `${prefix} {${inspected}}`;

      return wrapInSpan(ClassNames.SET, fmt, false);
    }
    
    else if (is.map(value)) {
      const prefix = `Map(${value.size})`;
      const inspected = Array.from(value.entries())
        .map(([k, v]) => `${self(k, true)} => ${self(v, true)}`)
        .join(', ');

      const fmt = `${prefix} {${inspected}}`;

      return wrapInSpan(ClassNames.MAP, fmt, false);
    }
    
    else if (is.strictObject(value)) {
      const result = selfRecursive(value);
      let prefix = `${ARROW} `;

      const valueConstructor = value.constructor;
      if (valueConstructor && valueConstructor !== Object) prefix += `${valueConstructor.name} `;

      // We can't escape HTML here since that would break formatting for nested elements
      // Individual key/values are already escaped
      return wrapInSpan(ClassNames.OBJECT, prefix + result, false);
    }
    
    else if (is.array(value)) {
      const result = selfRecursive(value);
      let prefix = `${ARROW} `;
      
      if (value.length >= 2) prefix += `(${value.length}) `;

      return wrapInSpan(ClassNames.OBJECT, prefix + result, false);
    }
    
    else if (is.function(value)) {
      const {name} = value;

      if (name) {
        let val = String(value);
        if (inObject) val = `${name}()`;

        return FUNCTION_SIGNATURE_PREFIX + wrapInSpan(ClassNames.FUNCTION, trimString(val));
      }
      else return wrapInSpan(ClassNames.FUNCTION, `() => ${COLLAPSED_CHAR}`);
    }
    
    else if (is.number(value) || is.bool(value)) {
      return wrapInSpan(ClassNames.NUMERIC, value);
    }

    else if (is.bigint(value)) {
      // BigInt literals have suffix "n"
      return wrapInSpan(ClassNames.STRING, value + 'n');
    }
    
    else {
      return wrapInSpan(ClassNames.DEFAULT, value);
    }
  }

  // "Internal properties" are properties that will be interpreted as object keys, regardless if the value is an array or object
  const internalProperties = new Set(['length']);

  function recursiveInspect(
    obj,
    visited = new WeakSet(),
    inObject,
    collapsed
  ) {
    if (!is.loseObject(obj)) return inspect(obj, visited, inObject, collapsed);

    const isArray = is.array(obj);

    let str = '';

    const descriptors = Object.getOwnPropertyDescriptors(obj);
    const keys = Object.getOwnPropertyNames(obj);

    let count = 0;

    for (const key of keys) {
      count++;

      // Chrome only displays up to 5 properties in collapsed view
      if (collapsed && count >= MAX_COLLAPSED_PROPERTIES) {
        str += `, ${COLLAPSED_CHAR}`;
        break;
      }

      const descriptor = descriptors[key];

      let result;

      // Getters might do some heavy work or even throw an error, so we signalise it using [Getter] 
      if (descriptor && typeof descriptor.get === 'function') {
        result = `${FUNCTION_SIGNATURE_PREFIX} [Getter]`;
      } else {
        // We know it's not a getter so we can safely read its value
        const value = obj[key];

        if (visited.has(value)) {
          result = '[Circular]';
        } else {
          if (is.loseObject(value)) {
            visited.add(value);
          }
  
          result = inspect(value, visited, true, collapsed);
        }
      }

      if (str.length > 0) str += ', ';

      // If the object/array is expanded, we want to make the output a bit cleaner by adding linebreaks after each property
      if (!collapsed) str += '<br />';

      const hasInternalProperty = internalProperties.has(key);
      if (!isArray || hasInternalProperty) {
        let escapedKey = escapeHtml(key);
        if (hasInternalProperty) escapedKey = `[${escapedKey}]`;

        if (descriptor && !descriptor.enumerable) {
          // Property not enumerable, so we style it to signalise it's "hidden"
          str += wrapInSpan(ClassNames.OBJECT_HIDDEN_PROPERTY, escapedKey, false) + ': ' + result;
        } else {
          str += escapedKey + ': ' + result;
        }
      } else {
        str += result;
      }
    }

    return !isArray ? `{${str}}` : `[${str}]`;
  }

  class EmbeddedConsole {
    options = {};
    element = null;
    logs = new WeakMap();
    timers = new Map();

    constructor(element, options = {}) {
      this.element = element;
      this.options = options;

      element.style.width = options.width || '100%';
      element.style.height = options.height || '100%';
      element.classList.add('embedded-console');

      this.element.onclick = (event) => {

        let element = event.target, attempt = 0;
        do {
          // Continously try to find registered element, up to 5 times
          if (!this.logs.has(element)) {
            if (element === null) return;

            element = element.parentElement;
          } else {
            break;
          }
        } while(++attempt <= 5)

        const data = this.logs.get(element);
        if (!data) return;
        
        // We only care about expandable items (arrays/objects)
        const child = Array.from(element.children).find((el) => el.classList.contains(ClassNames.OBJECT));
        if (!child) return;

        // Hacky way to check if element is collapsed
        const collapsed = child.innerText.charAt(0) === COLLAPSED_ARROW_RAW;

        const html = this._formatString(!collapsed, ...data);
        element.innerHTML = html;
      };
    }

    _add(innerHTML, logLevel) {
      const el = document.createElement('div');
      el.classList.add('ec-entry', logLevel);
      el.innerHTML = innerHTML;

      this.element.appendChild(el);

      return el;
    }

    _formatString(collapsed, ...data) {
      const [initial] = data;
      if (typeof initial === 'string') {
        let idx = 0,
          res = '';

        for (let i = 0; i < initial.length; ++i) {
          const char = initial[i];
          if (placeholders.has(char) && initial[i - 1] === '%') res += data[++idx] || `%${char}`;
          else if (char === '%') continue;
          else res += char;
        }

        data[0] = res;
        data.splice(1, idx);
      }

      return data.map((param) => {
        let value;
        try {
          value = inspect(param, undefined, false, collapsed);
        } catch(e) {
          // Don't do anything with error because it could throw another error
          // i.e. accessing `e.message` could invoke a throwing getter

          // Code like this will now return `[Unknown]` rather than an unhandled error:
          // .log(new Proxy({}, { get() { throw 1; } }));
          value = '[Unknown]';
        }

        return value;

      }).join(' ');
    }

    info(...data) {
      return this.log(...data);
    }
    warn(...data) {
      this.logs.set(this._add(this._formatString(true, ...data), ClassNames.WARNING), data);
    }
    log(...data) {
      this.logs.set(this._add(this._formatString(true, ...data), ClassNames.LOG), data);
    }
    error(...data) {
      this.logs.set(this._add(this._formatString(true, ...data), ClassNames.ERROR), data);
    }
    time(specifier = 'default') {
      this.timers.set(specifier, performance.now());
    }
    timeEnd(specifier = 'default') {
      const p = this.timers.get(specifier);
      if (p === undefined) return this.warn(`Timer ${specifier} does not exist`);
      this.log(`${specifier}:`, `${performance.now() - p}ms`);

      this.timers.delete(specifier);
    }
    assert(condition, ...data) {
      // console.assert checks if condition is falsy
      if (!condition) {
        this.error('Assertion failed:', ...data);
      }
    }
    clear() {
      this.element.innerText = '';
    }
    cleanup() {
      this.element = null;
    }
  };

  return EmbeddedConsole;
})();