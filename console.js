const placeholders = new Set([
  'o', 'O', 'd', 'i', 's', 'f'
]);

const NEWLINE_REGEX = /\n/g;
const COLLAPSED_CHAR = '…';

const is = {
  nullish(value) {
    return value === null || value === undefined;
  },
  number(value) {
    return typeof value === 'number';
  },
  bool(value) {
    return typeof value === 'boolean';
  },
  string(value) {
    return typeof value === 'string';
  },
  bigint(value) {
    return typeof value === 'bigint';
  },
  fn(value) {
    return typeof value === 'function';
  },
  strictObject(value) {
    return this.loseObject(value) && !Array.isArray(value);
  },
  loseObject(value) {
    return !this.nullish(value) && typeof value === 'object'
  },
  array(value) {
    return Array.isArray(value);
  },
  error(value) {
    return value instanceof Error;
  },
  regexp(value) {
    return value instanceof RegExp;
  },
  set(value) {
    return value instanceof Set;
  },
  map(value) {
    return value instanceof Map;
  },
  function (value) {
    return typeof value === 'function';
  }
};

function inspect(obj, visited = new WeakSet(), maxDepth = Infinity, curDepth = 0) {
  // Return early if primitive, i.e.: 1, 'hello'
  if (!is.loseObject(obj)) return formatValue(obj, true, visited, maxDepth, curDepth + 1);

  const isArray = is.array(obj);

  let str = '';

  for (const key of Object.keys(obj)) {
    const value = obj[key];

    let result;
    if (visited.has(value)) {
      result = '[Circular]';
    } else {
      if (is.loseObject(value)) {
        // Add to WeakSet to prevent infinite loops if value has
        // circular structure
        visited.add(value);
      }

      result = formatValue(value, true, visited, maxDepth, curDepth + 1);
    }

    if (str.length > 0) {
      str += ', ';
    }

    if (!isArray) {
      str += key + ': ' + result;
    } else {
      str += result;
    }
  }

  return !isArray ? `{ ${str} }` : `[ ${str} ]`;
}

function escapeHtml(value) {
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

function valueToClass(value) {
  if (is.nullish(value)) return 'ec-nullish';
  else if (is.error(value)) return 'ec-string';
  else if (is.number(value) || is.bool(value)) return 'ec-numeric';
  else if (is.regexp(value)) return 'ec-regexp';
  else if (is.strictObject(value) || is.array(value) || is.fn(value)) return 'ec-object';
  else return 'ec-string';
}


function formatValue(value, collapse, visited, maxDepth = Infinity, curDepth = 0) {
  const self = (value) => formatValue(value, collapse, visited, maxDepth, curDepth + 1);

  const valueConstructor = is.nullish(value) ? value : value.constructor;

  if (curDepth >= maxDepth) {
    if (is.nullish(value)) return String(value);
    else return `[${valueConstructor.name}]`;
  }

  // TODO: strings do not have quotes in object literals because of this
  if (is.string(value))
    return value;

  else if (is.error(value) || is.regexp(value))
    return String(value);

  else if (is.set(value))
    return `Set(${value.size}) {${self(Array.from(value.keys()))}}`;

  else if (is.map(value))
    return `Map(${value.size}) {${Array.from(value.entries()).map(([k, v]) => 
      `${k} => ${self(v)}`).join(', ')}}`;

  else if (is.strictObject(value)) {
    const result = inspect(value, visited, maxDepth, curDepth);
    let prefix = '';

    // Chrome prefixes constructor name if prototype isn't object
    if (valueConstructor && valueConstructor !== Object)
      prefix = valueConstructor.name;
    
    return prefix + result;
  }

  else if (is.array(value)) {
    // Chrome console only displays prefix (<count>)
    // if array has two or more elements
    if (value.length < 2) return inspect(value, visited, maxDepth, curDepth);
    else return `(${value.length}) ${inspect(value, visited, maxDepth, curDepth)}`
  } else if (is.function(value) && collapse) {
    const name = value.name;

    if (name) return `${name}()`;
    else return `() => {${COLLAPSED_CHAR}}`;
  }

  else return String(value);
}

class EmbeddedConsole {
  constructor(element, options = {}) {
    this.options = options;
    this.element = element;
    this.timers = new Map;

    element.style.width = options.width ?? '100%';
    element.style.height = options.height ?? '100%';
    element.classList.add('embedded-console');
  }

  _add(innerHTML, logLevel) {
    const el = document.createElement('div');
    el.classList.add('ec-entry', logLevel);
    el.innerHTML = innerHTML;

    this.element.appendChild(el);
  }

  _formatString(...data) {
    const [initial] = data;
    if (typeof initial === 'string') {
      let idx = 0,
        res = '';

      for (let i = 0; i < initial.length; ++i) {
        const char = initial[i];
        if (placeholders.has(char) && initial[i - 1] === '%') res += data[++idx] ?? `%${char}`;
        else if (char === '%') continue;
        else res += char;
      }

      data[0] = res;
      data.splice(1, idx);
    }

    return data.map((param) => {
      let value;
      try {
        value = formatValue(param, false, undefined, this.options.maxDepth);
      } catch {
        // Don't do anything with error because it could throw another error
        // i.e. accessing `e.message` could invoke a throwing getter

        // Code like this will now return `<unknown>` rather than an unhandled error:
        // .log(new Proxy({}, { get() { throw 1; } }));
        value = '<unknown>';
      }

      return `<span class="${valueToClass(param)}">${
      	this.options.allowHtml ? value : escapeHtml(value)
      }</span>`;
    }).join(' ');
  }

  // count() {}
  // countReset() {}
  // debug() {}
  // dir() {}
  // dirxml() {}
  // group() {}
  // groupCollapsed() {}
  // groupEnd() {}
  // table() {}
  info(...data) {
    return this.log(...data);
  }
  warn(...data) {
    return this._add(this._formatString(...data), 'ec-warning');
  }
  log(...data) {
    return this._add(this._formatString(...data), 'ec-log');
  }
  error(...data) {
    return this._add(this._formatString(...data), 'ec-error');
  }
  time(specifier) {
    this.timers.set(specifier, performance.now());
  }
  timeEnd(specifier) {
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
}