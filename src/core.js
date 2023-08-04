import { read_str } from './reader.js';
import { js_to_mal, resolve_js } from './interop.js';
import { _pr_str, _println } from './printer.js'
import * as types from './types.js'
import { evalString } from "./interpreter.js";
import zip from './clj/zip.clj?raw'
import { Range, Seq, getIn } from 'immutable'

function _getIn(coll, path, notSetValue) {
    return getIn(coll, path, notSetValue)
}

function reverse(coll) {
    if (types._string_Q(coll)) {
        coll = coll.split('')
    }
    return Seq(coll).reverse().toJS()
}

function _reduce(f, init, coll) {
    return coll.reduce(f, init)
}

function require(lib) {
    switch (lib) {
        case 'zip':
            evalString("(do " + zip + ")")
            break;
        default:
            break;
    }
}

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
    const res = Array.prototype.map.call(arguments, function (exp) {
        return _pr_str(exp, false);
    }).join("")
    //console.log(res)
    return res
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
    if (types._vector_Q(src)) {
        const index = arguments[1]
        const newVal = arguments[2]
        let vec = types._clone(src);
        const head = vec.slice(0, index)
        const tail = vec.slice(index + 1)
        head.push(newVal)
        vec = head.concat(tail)
        vec.__isvector__ = true;
        return vec
    }
    var hm = types._clone(src);
    var args = [hm].concat(Array.prototype.slice.call(arguments, 1));
    return types._assoc.apply(null, args);
}

function dissoc(src) {
    if (types._vector_Q(src)) {
        let vec = types._clone(src);
        const index = arguments[1]
        const head = vec.slice(0, index)
        const tail = vec.slice(index + 1)
        vec = head.concat(tail)
        vec.__isvector__ = true;
        return vec
    }
    var hm = types._clone(src);
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
    if (types._list_Q(lst)) {
        var v = Array.prototype.slice.call(lst, 0);
        v.__isvector__ = true;
        return v;
    } else {
        return lst;
    }
}

function nth(lst, idx) {
    return lst[idx]
}

function range(start, end, step) {
    if (step) {
        return Range(start, end, step)
    }
    if (end) {
        return Range(start, end)
    } else {
        return Range(0, start)
    }
}

function first(lst) { return (lst === null) ? null : lst[0]; }
function last(lst) { return (lst === null) ? null : lst.slice(-1)[0]; }

function rest(lst) { return (lst == null) ? [] : lst.slice(1); }
function next(lst) {
    if (lst.length === 0) {
        return null
    }
    return (lst == null) ? [] : lst.slice(1);
}

function empty_Q(lst) { return lst.length === 0; }

function count(s) {
    if (Array.isArray(s)) { return s.length; }
    else if (s === null) { return 0; }
    else { return Object.keys(s).length; }
}

function conj(lst) {
    if (types._list_Q(lst)) {
        return Array.prototype.slice.call(arguments, 1).reverse().concat(lst);
    } else {
        var v = lst.concat(Array.prototype.slice.call(arguments, 1));
        v.__isvector__ = true;
        return v;
    }
}

function pop(lst) {
    if (types._list_Q(lst)) {
        return lst.slice(1);
    } else {
        var v = lst.slice(0, -1);
        v.__isvector__ = true;
        return v;
    }
}

function peek(lst) {
    if (types._list_Q(lst)) {
        return lst[0]
    } else {
        return lst[lst.length-1]
    }
}

function sort(x) {
    if (types._string_Q(x)) {
        return x.split('').sort().join('');
    }
    if (types._list_Q(x)) {
        return x.sort()
    } else {
        var v = x.sort()
        v.__isvector__ = true;
        return v;
    }
}

export function seq(obj) {
    if (types._list_Q(obj)) {
        return obj.length > 0 ? Seq(obj) : null;
    } else if (types._vector_Q(obj)) {
        return obj.length > 0 ? Seq(obj) : null;
    } else if (types._string_Q(obj)) {
        return obj.length > 0 ? Seq(obj.split('')) : null;
    } else if (types._hash_map_Q(obj)) {
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

function map(f, s) {
    if (types._string_Q(s)) {
        s = seq(s)
    }
    return s.map(function (el) { return f(el); });
}

function filter(f, lst) {
    return lst.filter(function (el) { return f(el); });
}

// Metadata functions
function with_meta(obj, m) {
    var new_obj = types._clone(obj);
    new_obj.__meta__ = m;
    return new_obj;
}

function meta(obj) {
    // TODO: support symbols and atoms
    if ((!_sequential_Q(obj)) &&
        (!(_hash_map_Q(obj))) &&
        (!(_function_Q(obj)))) {
        throw new Error("attempt to get metadata from: " + types._obj_type(obj));
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
    if (a) {
        return true
    } else {
        return false
    }
}

function _join(sep, coll) {
    if (!coll) {
        return coll.join()
    }
    return a.join(sep)
}

function reFind(re, s) {
    const array = [...s.match(re)];
    return array
}

function reSeq(re, s) {
    const array = [...s.matchAll(re)];
    return array
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
    return coll.slice(n)
}

function partition() {
    if (arguments.length === 2) {
        const n = arguments[0]
        const coll = arguments[1]
        return partition(n, n, coll)
    } else if (arguments.length === 3) {
        const n = arguments[0]
        const step = arguments[1]
        const seq = Seq(arguments[2])
        console.log("seq:", seq)
        const nParts = Math.floor(seq.size / step)
        console.log("nParts:", nParts)
        const indices = Range(0, n).map(i => Range(i, seq.size).map(j => seq.get(j)))
        return indices
        //const indices = Range(0, nParts).map(i => seq.get(i*step))
        //return indices
        //const ranges = Range(0, n).map(i => Range(seq.get(i), seq.size, step).toArray())
        //console.log("ranges:", ranges.toArray())
        //return ranges
        //const parts = Range(0, nParts).map(i => ranges.map(x => x[i])).toArray()
        //return parts
    }
}


function char(int) {
    return String.fromCharCode(int)
}

function int(x) {
    if (types._number_Q(x)) {
        return Math.floor(x)
    } else if (x[0] === '\\') {
        // is a char
        return x.charCodeAt(1)
    } else {
        return x.charCodeAt(0)
    }
}

function toSet() {
    return new Set(arguments[0])
}

function rand_int() {
    return Math.floor(Math.random() * arguments[0]);
}

function rand_nth() {
    const n = Math.floor(Math.random() * arguments[0].length)
    return arguments[0][n]
}

// https://stackoverflow.com/a/31042089
function format() {
    var args = Array.prototype.slice.call(arguments)
        // parameters for string
        , n = args.slice(1, -1)
        // string
        , text = args[0]
        // check for `Number`
        , _res = isNaN(parseInt(args[args.length - 1]))
            ? args[args.length - 1]
            // alternatively, if string passed
            // as last argument to `sprintf`,
            // `eval(args[args.length - 1])`
            : Number(args[args.length - 1])
        // array of replacement values
        , arr = n.concat(_res)
        // `res`: `text`
        , res = text;
    // loop `arr` items
    for (var i = 0; i < arr.length; i++) {
        // replace formatted characters within `res` with `arr` at index `i`
        res = res.replace(/%d|%s/, arr[i])
    }
    // return string `res`
    return res
}

function repeatedly(n, f) {
    let calls = []
    for (let i = 0; i < n; i++) {
        calls.push(f())
    }
    return calls
}

function frequencies(seq) {
    let freqs = {}
    for (let i = 0; i < seq.length; i++) {
        if (freqs[seq[i]]) {
            freqs[seq[i]] = freqs[seq[i]] + 1
        } else {
            freqs[seq[i]] = 1
        }
    }
    return freqs
}

function hasValue(x, coll) {
    let res = []
    for (let i = 0; i < coll.length; i++) {
        if (types._equal_Q(x, coll[i])) {
            res.push[coll[i]]
        }
        if (res.count === 0) {
            return true
        } else {
            return false
        }
    }
}

function distinct(coll) {
    let unique = [];
    coll.forEach((e) => {
        if (!(hasValue(e, unique))) {
            unique.push(e);
        }
    });
    return unique
}

function distinct_Q() {
    const set = new Set(arguments)
    return arguments.length === set.size
}

function trim(s) {
    return s.trim()
}

function int_Q(x) {
    return Number.isInteger(x)
}

function mod(x, y) {
    return x % y
}

function sqrt(n) {
    return Math.sqrt(n)
}

function minus(a, b) {
    if (!b && b != 0) {
        return -a
    }
    return a - b
}

function cycle(coll) {
    var c = seq(coll)
    c.__iscycle__ = true;
    return c
}

function min() {
    return Math.min.apply(null, arguments);
}

function max() {
    return Math.max.apply(null, arguments);
}

export const ns = {
    'require': require,
    'min': min,
    'max': max,
    'type': types._obj_type,
    'sqrt': sqrt,
    '=': types._equal_Q,
    'not=': notEquals,
    'throw': mal_throw,
    'mod': mod,
    'rem': mod,
    'nil?': types._nil_Q,
    'char': char,
    'true?': types._true_Q,
    'is': _is,
    'false?': types._false_Q,
    'number?': types._number_Q,
    'string?': types._string_Q,
    'symbol': types._symbol,
    'symbol?': types._symbol_Q,
    'keyword': types._keyword,
    'keyword?': types._keyword_Q,
    'fn?': types._fn_Q,
    'macro?': types._macro_Q,
    'pr-str': pr_str,
    'print': print,
    'reverse': reverse,
    'frequencies': frequencies,
    're-find': reFind,
    're-seq': reSeq,
    're-matches': re_matches,
    'str': str,
    'upper-case': upperCase,
    'reduce': _reduce,
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
    '-': minus,
    '*': function (a, b) { return a * b; },
    '/': function (a, b) { return a / b; },
    'inc': function (a) { return a + 1; },
    "time-ms": time_ms,
    'list': types._list,
    'list?': types._list_Q,
    'vector': types._vector,
    //'distinct': distinct,
    'distinct?': distinct_Q,
    'set': toSet,
    'vector?': types._vector_Q,
    'hash-map': types._hash_map,
    'map?': types._hash_map_Q,
    'assoc': assoc,
    'partition': partition,
    'dissoc': dissoc,
    'get': get,
    'contains?': contains_Q,
    'keys': keys,
    'vals': vals,
    'sequential?': types._sequential_Q,
    'take': take,
    'repeatedly': repeatedly,
    'drop': drop,
    'cons': cons,
    'concat': concat,
    'vec': vec,
    'nth': nth,
    'sort': sort,
    'first': first,
    'last': last,
    'rest': rest,
    'next': next,
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
    'peek': peek,
    'pop': pop,
    'with-meta': with_meta,
    'meta': meta,
    'atom': types._atom,
    'atom?': types._atom_Q,
    "deref": deref,
    "reset!": reset_BANG,
    "swap!": swap_BANG,
    'js-eval': js_eval,
    '.': js_method_call,
    'int': int,
    'rand-int': rand_int,
    'rand-nth': rand_nth,
    'format': format,
    'trim': trim,
    'int?': int_Q,
    'cycle': cycle,
    'get-in': _getIn
};
