const TAG_REGEX = /[<>]/g,
  PLACEHOLDER_REGEX = /%[oOdisf]/g;

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
  strictObject(value) {
    return !this.nullish(value) && typeof value === 'object' && !Array.isArray(value);
  },
  array(value) {
    return Array.isArray(value);
  }
};

function tryStringify(value, maxLen = 32) {
  try {
    const str = JSON.stringify(value, null, 2);

    const strippedStr = ((str.startsWith('{') && str.endsWith('}')) || (str.startsWith('[') && str.endsWith(']'))) ?
      str.slice(1, -1).trim() :
      str;

    const substr = strippedStr.length > maxLen ? strippedStr.substr(0, 32) + '...' : strippedStr;

    return substr;
  } catch {
    return '<circular>';
  }
}

function escapeHtml(value) {
  return value.replace(TAG_REGEX, (match) => {
    if (match === '<') return '&lt;';
    else return '&gt;';
  });
}

function valueToClass(value) {
  if (is.nullish(value)) return 'ec-nullish';
  else if (is.number(value) || is.bool(value)) return 'ec-numeric';
  else if (is.strictObject(value) || is.array(value)) return 'ec-object';
  else return 'ec-string';
}

function formatValue(value) {
  if (is.string(value)) return value;
  else if (is.strictObject(value)) return `${value?.constructor?.name ?? ''} { ${tryStringify(value)} }`;
  else if (is.array(value)) return `[ ${tryStringify(value)} ]`;
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
      let idx = 0;


      data[0] = initial.replace(PLACEHOLDER_REGEX, (match) => {
        return data[++idx] ?? match;
      });
      data.splice(1, idx);
    }

    return data.map((param) => {
      const value = formatValue(param);
      return `<span class="${valueToClass(param)}">${
      	this.allowHtml ? value : escapeHtml(value)
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
