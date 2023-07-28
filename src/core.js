import { read_str } from './reader.js';
import { js_to_mal, resolve_js } from './interop.js';
import { _pr_str, _println } from './printer.js'

export function _obj_type(obj) {
    if (_symbol_Q(obj)) { return 'symbol'; }
    else if (_list_Q(obj)) { return 'list'; }
    else if (_vector_Q(obj)) { return 'vector'; }
    else if (_hash_map_Q(obj)) { return 'hash-map'; }
    else if (_set_Q(obj)) { return 'set'; }
    else if (_nil_Q(obj)) { return 'nil'; }
    else if (_true_Q(obj)) { return 'true'; }
    else if (_false_Q(obj)) { return 'false'; }
    else if (_atom_Q(obj)) { return 'atom'; }
    else {
        switch (typeof (obj)) {
            case 'number': return 'number';
            case 'function': return 'function';
            case 'string': return obj[0] == '\u029e' ? 'keyword' : 'string';
            default: throw new Error("Unknown type '" + typeof (obj) + "'");
        }
    }
}

export function _sequential_Q(lst) { return _list_Q(lst) || _vector_Q(lst); }

export function _equal_Q(a, b) {
    var ota = _obj_type(a), otb = _obj_type(b);
    if (!(ota === otb || (_sequential_Q(a) && _sequential_Q(b)))) {
        return false;
    }
    switch (ota) {
        case 'symbol': return a.value === b.value;
        case 'list':
        case 'vector':
            if (a.length !== b.length) { return false; }
            for (var i = 0; i < a.length; i++) {
                if (!_equal_Q(a[i], b[i])) { return false; }
            }
            return true;
        case 'hash-map':
            if (Object.keys(a).length !== Object.keys(b).length) { return false; }
            for (var k in a) {
                if (!_equal_Q(a[k], b[k])) { return false; }
            }
            return true;
        default:
            return a === b;
    }
}

export function _clone(obj) {
    var new_obj;
    switch (_obj_type(obj)) {
        case 'list':
            new_obj = obj.slice(0);
            break;
        case 'vector':
            new_obj = obj.slice(0);
            new_obj.__isvector__ = true;
            break;
        case 'hash-map':
            new_obj = {};
            for (var k in obj) {
                if (obj.hasOwnProperty(k)) { new_obj[k] = obj[k]; }
            }
            break;
        case 'function':
            new_obj = obj.clone();
            break;
        default:
            throw new Error("Cannot clone a " + _obj_type(obj));
    }
    Object.defineProperty(new_obj, "__meta__", {
        enumerable: false,
        writable: true
    });
    return new_obj;
}

// Scalars
export function _nil_Q(a) { return a === null ? true : false; }
export function _true_Q(a) { return a === true ? true : false; }
export function _false_Q(a) { return a === false ? true : false; }
export function _number_Q(obj) { return typeof obj === 'number'; }
export function _string_Q(obj) {
    return typeof obj === 'string' && obj[0] !== '\u029e';
}

// Symbols
export function Symbol(name) {

    this.value = name;
    return this;
}
Symbol.prototype.toString = function () { return this.value; }
export function _symbol(name) { return new Symbol(name); }
export function _symbol_Q(obj) { return obj instanceof Symbol; }


// Keywords
export function _keyword(obj) {
    if (typeof obj === 'string' && obj[0] === '\u029e') {
        return obj;
    } else {
        return "\u029e" + obj;
    }
}

export function _keyword_Q(obj) {
    return typeof obj === 'string' && obj[0] === '\u029e';
}

function walk(inner, outer, form) {
    //console.log("Walking form:", form)
    if (form == null) {
        return null
    }
    if (_list_Q(form)) {
        return outer(form.map(inner))
    } else if (_vector_Q(form)) {
        let v = outer(form.map(inner))
        v.__isvector__ = true;
        return v
    } else if (_hash_map_Q(form)) {
        const entries = seq(form).map(inner)
        let newMap = {}
        entries.forEach(mapEntry => {
            newMap[mapEntry[0]] = mapEntry[1]
        });
        return outer(newMap)
    } else if (form.__mapEntry__) {
        const k = inner(form[0])
        const v = inner(form[1])
        let mapEntry = [k, v]
        mapEntry.__mapEntry__ = true
        return outer(mapEntry)
    } else {
        return outer(form)
    }
}

export function postwalk(f, form) {
    return walk(x => postwalk(f, x), f, form)
}

function hasLoop(ast) {
    let loops = []
    postwalk(x => {
        if (x.value == _symbol("loop")) {
            loops.push(true)
            return true
        } else {
            return x
        }
        return x
    }, ast)
    if (loops.length > 0) {
        return true
    } else {
        return false
    }
}

function downloadObjectAsJson(exportObj, exportName) {
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
    var downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Functions
export function _function(Eval, Env, ast, env, params) {
   // console.log("fn AST:", ast)
    var fn = function () {
        return Eval(ast, new Env(env, params, arguments))
    }
    let swapRecur = postwalk(x => {
        if (x.value == _symbol("recur")) {
            return fn
        } else {
            return x
        }
        return x
    }, ast)
    if (!hasLoop(ast)) {
        ast = swapRecur
        fn = function () {
            return Eval(ast, new Env(env, params, arguments))
        }
    }
    fn = function () {
        return Eval(ast, new Env(env, params, arguments))
    }
    //console.log("fn AST (after):", ast)
    //downloadObjectAsJson(ast, "ast.json")
    fn.__meta__ = null;
    fn.__ast__ = ast;
    fn.__gen_env__ = function (args) { return new Env(env, params, args); };
    fn._ismacro_ = false;
    return fn;
}

export function _function_Q(obj) { return typeof obj == "function"; }
Function.prototype.clone = function () {
    var that = this;
    var temp = function () { return that.apply(this, arguments); };
    for (const key in this) {
        temp[key] = this[key];
    }
    return temp;
};
export function _fn_Q(obj) { return _function_Q(obj) && !obj._ismacro_; }
export function _macro_Q(obj) { return _function_Q(obj) && !!obj._ismacro_; }


// Lists
export function _list() { return Array.prototype.slice.call(arguments, 0); }
export function _list_Q(obj) { return Array.isArray(obj) && !obj.__isvector__; }

// Vectors
export function _vector() {
    var v = Array.prototype.slice.call(arguments, 0);
    v.__isvector__ = true;
    return v;
}
export function _vector_Q(obj) { return Array.isArray(obj) && !!obj.__isvector__; }

// Hash Maps
export function _hash_map() {
    if (arguments.length % 2 === 1) {
        throw new Error("Odd number of hash map arguments");
    }
    var args = [{}].concat(Array.prototype.slice.call(arguments, 0));
    return _assoc.apply(null, args);
}

export function _hash_map_Q(hm) {
    return typeof hm === "object" &&
        !Array.isArray(hm) &&
        !(hm === null) &&
        !(hm instanceof Symbol) &&
        !(hm instanceof Set) &&
        !(hm instanceof Atom);
}

// Sets
export function _set() {
    return new Set(arguments)
}

export function _set_Q(set) {
    return typeof set === "object" &&
    (set instanceof Set)
}

export function _assoc(hm) {
    if (arguments.length % 2 !== 1) {
        throw new Error("Odd number of assoc arguments");
    }
    for (var i = 1; i < arguments.length; i += 2) {
        var ktoken = arguments[i],
            vtoken = arguments[i + 1];
        if (typeof ktoken !== "string") {
            throw new Error("expected hash-map key string, got: " + (typeof ktoken));
        }
        hm[ktoken] = vtoken;
    }
    return hm;
}
export function _dissoc(hm) {
    for (var i = 1; i < arguments.length; i++) {
        var ktoken = arguments[i];
        delete hm[ktoken];
    }
    return hm;
}

// Atoms
export class Atom {
    constructor(val) { this.val = val; }
}
export function _atom(val) { return new Atom(val); }
export function _atom_Q(atm) { return atm instanceof Atom; }


// Errors/Exceptions
function mal_throw(exc) { throw exc; }

// String functions
function pr_str() {
    return Array.prototype.map.call(arguments, function (exp) {
        return _pr_str(exp, true);
    }).join(" ");
}

function str() {
    return Array.prototype.map.call(arguments, function (exp) {
        return _pr_str(exp, false);
    }).join("");
}

function print() {
    return Array.prototype.map.call(arguments, function (exp) {
        return _pr_str(exp, false);
    }).join("");
}


function prn() {
    return Array.prototype.map.call(arguments, function (exp) {
        return _pr_str(exp, false);
    }).join("");
}


function println() {
    return Array.prototype.map.call(arguments, function (exp) {
        return _pr_str(exp, false);
    }).join("");
}


function slurp(f) {
    var req = new XMLHttpRequest();
    req.open("GET", f, false);
    req.send();
    if (req.status == 200) {
        return req.responseText;
    } else {
        throw new Error("Failed to slurp file: " + f);
    }
}


// Number functions
function time_ms() { return new Date().getTime(); }


// Hash Map functions
function assoc(src) {
    if (_vector_Q(src)) {
        const index = arguments[1]
        const newVal = arguments[2]
        let vec = _clone(src);
        const head = vec.slice(0, index)
        const tail = vec.slice(index + 1)
        head.push(newVal)
        vec = head.concat(tail)
        vec.__isvector__ = true;
        return vec
    }
    var hm = _clone(src);
    var args = [hm].concat(Array.prototype.slice.call(arguments, 1));
    return _assoc.apply(null, args);
}

function dissoc(src) {
    if (_vector_Q(src)) {
        let vec = _clone(src);
        const index = arguments[1]
        const head = vec.slice(0, index)
        const tail = vec.slice(index + 1)
        vec = head.concat(tail)
        vec.__isvector__ = true;
        return vec
    }
    var hm = _clone(src);
    var args = [hm].concat(Array.prototype.slice.call(arguments, 1));
    return _dissoc.apply(null, args);
}

function get(hm, key) {
    if (hm != null && key in hm) {
        return hm[key];
    } else {
        return null;
    }
}

function contains_Q(hm, key) {
    if (key in hm) { return true; } else { return false; }
}

function keys(hm) { return Object.keys(hm); }
function vals(hm) { return Object.keys(hm).map(function (k) { return hm[k]; }); }


// Sequence functions
function cons(a, b) { return [a].concat(b); }

function concat(lst) {
    lst = lst || [];
    return lst.concat.apply(lst, Array.prototype.slice.call(arguments, 1));
}
function vec(lst) {
    if (_list_Q(lst)) {
        var v = Array.prototype.slice.call(lst, 0);
        v.__isvector__ = true;
        return v;
    } else {
        return lst;
    }
}

function nth(lst, idx) {
    if (idx < lst.length) { return lst[idx]; }
    else { throw new Error("nth: index out of range"); }
}

function range(start, end) {
    if (!end) {
        return range(0, start)
    }
    var ans = [];
    for (let i = start; i < end; i++) {
        ans.push(i);
    }
    return ans;
}

function first(lst) { return (lst === null) ? null : lst[0]; }
function last(lst) { return (lst === null) ? null : lst.slice(-1)[0]; }

function rest(lst) { return (lst == null) ? [] : lst.slice(1); }

function empty_Q(lst) { return lst.length === 0; }

function count(s) {
    if (Array.isArray(s)) { return s.length; }
    else if (s === null) { return 0; }
    else { return Object.keys(s).length; }
}

function conj(lst) {
    if (_list_Q(lst)) {
        return Array.prototype.slice.call(arguments, 1).reverse().concat(lst);
    } else {
        var v = lst.concat(Array.prototype.slice.call(arguments, 1));
        v.__isvector__ = true;
        return v;
    }
}

function pop(lst) {
    if (_list_Q(lst)) {
        return lst.slice(1);
    } else {
        var v = lst.slice(0, -1);
        v.__isvector__ = true;
        return v;
    }
}

function sort(lst) {
    if (_list_Q(lst)) {
        return lst.sort()
    } else {
        var v = lst.sort()
        v.__isvector__ = true;
        return v;
    }
}

export function seq(obj) {
    if (_list_Q(obj)) {
        return obj.length > 0 ? obj : null;
    } else if (_vector_Q(obj)) {
        return obj.length > 0 ? Array.prototype.slice.call(obj, 0) : null;
    } else if (_string_Q(obj)) {
        return obj.length > 0 ? obj.split('') : null;
    } else if (_hash_map_Q(obj)) {
        let kvs = []
        Object.entries(obj).forEach(kv => {
            kv.__mapEntry__ = true;
            kvs.push(kv)
        })
        return kvs
    } else if (obj === null) {
        return null;
    } else {
        throw new Error("seq: called on non-sequence");
    }
}

function repeat(n, x) {
    return Array(n).fill(x)
}

function apply(f) {
    var args = Array.prototype.slice.call(arguments, 1);
    return f.apply(f, args.slice(0, args.length - 1).concat(args[args.length - 1]));
}

function map(f, lst) {
    if (_string_Q(lst)) {
        lst = seq(lst)
    }
    return lst.map(function (el) { return f(el); });
}

function filter(f, lst) {
    return lst.filter(function (el) { return f(el); });
}

// Metadata functions
function with_meta(obj, m) {
    var new_obj = _clone(obj);
    new_obj.__meta__ = m;
    return new_obj;
}

function meta(obj) {
    // TODO: support symbols and atoms
    if ((!_sequential_Q(obj)) &&
        (!(_hash_map_Q(obj))) &&
        (!(_function_Q(obj)))) {
        throw new Error("attempt to get metadata from: " + _obj_type(obj));
    }
    return obj.__meta__;
}

// Atom functions
function deref(atm) { return atm.val; }
function reset_BANG(atm, val) { return atm.val = val; }
function swap_BANG(atm, f) {
    var args = [atm.val].concat(Array.prototype.slice.call(arguments, 2));
    atm.val = f.apply(f, args);
    return atm.val;
}

export function js_eval(str) {
    return js_to_mal(eval(str.toString()));
}

function js_method_call(object_method_str) {
    var args = Array.prototype.slice.call(arguments, 1),
        r = resolve_js(object_method_str),
        obj = r[0], f = r[1];
    var res = f.apply(obj, args);
    return js_to_mal(res);
}

function _is(a) {
    return _true_Q(a)
}

function _join(sep, coll) {
    if (!coll) {
        return coll.join()
    }
    return a.join(sep)
}

function reSeq(re, s) {
    return s.match(re)
}

function upperCase(s) {
    return s.toUpperCase()
}

function lowerCase(s) {
    return s.toLowerCase()
}

function _replace(s, match, replacement) {
    return s.replace(match, replacement)
}

function re_matches(re, s) {
    return re.exec(s)
}

function _subs(s, start, end) {
    if (end) {
        return s.substring(start, end)
    }
    return s.substring(start)
}

function notEquals(a, b) {
    return a !== b
}

function take(n, coll) {
    return coll.slice(0, n)
}

function drop(n, coll) {
    return coll.slice(-n)
}

function partition(n, step, pad, coll) {
    if (arguments.length === 2) {
        const s = seq(step)
        return take(n, s)
    }
}


function char(int) {
    return String.fromCharCode(int)
}

export const ns = {
    'type': _obj_type,
    '=': _equal_Q,
    'not=': notEquals,
    'throw': mal_throw,
    'nil?': _nil_Q,
    'char': char,
    'true?': _true_Q,
    'is': _is,
    'false?': _false_Q,
    'number?': _number_Q,
    'string?': _string_Q,
    'symbol': _symbol,
    'symbol?': _symbol_Q,
    'keyword': _keyword,
    'keyword?': _keyword_Q,
    'fn?': _fn_Q,
    'macro?': _macro_Q,
    'pr-str': pr_str,
    'print': print,
    're-seq': reSeq,
    're-matches': re_matches,
    'str': str,
    'upper-case': upperCase,
    'lower-case': lowerCase,
    'prn': prn,
    'println': println,
    'subs': _subs,
    'read-string': read_str,
    'slurp': slurp,
    '<': function (a, b) { return a < b; },
    '<=': function (a, b) { return a <= b; },
    '>': function (a, b) { return a > b; },
    '>=': function (a, b) { return a >= b; },
    '+': function (a, b) { return a + b; },
    '-': function (a, b) { return a - b; },
    '*': function (a, b) { return a * b; },
    '/': function (a, b) { return a / b; },
    'inc': function (a) { return a + 1; },
    "time-ms": time_ms,
    'list': _list,
    'list?': _list_Q,
    'vector': _vector,
    'vector?': _vector_Q,
    'hash-map': _hash_map,
    'map?': _hash_map_Q,
    'assoc': assoc,
    'partition': partition,
    'dissoc': dissoc,
    'get': get,
    'contains?': contains_Q,
    'keys': keys,
    'vals': vals,
    'sequential?': _sequential_Q,
    'take': take,
    'drop': drop,
    'cons': cons,
    'concat': concat,
    'vec': vec,
    'nth': nth,
    'sort': sort,
    'first': first,
    'last': last,
    'rest': rest,
    'empty?': empty_Q,
    'count': count,
    'apply': apply,
    'map': map,
    'filter': filter,
    'range': range,
    'repeat': repeat,
    'conj': conj,
    'join': _join,
    'replace': _replace,
    'seq': seq,
    'pop': pop,
    'with-meta': with_meta,
    'meta': meta,
    'atom': _atom,
    'atom?': _atom_Q,
    "deref": deref,
    "reset!": reset_BANG,
    "swap!": swap_BANG,
    'js-eval': js_eval,
    '.': js_method_call
};
