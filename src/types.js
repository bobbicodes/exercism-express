import { Env } from './env.js'
import { seq } from './core.js'
import {isSeq, Map, is, Seq} from 'immutable'

export function _obj_type(obj) {
    console.log(obj)
    console.log(_lazy_seq_Q(obj))
    if (_symbol_Q(obj)) { return 'symbol'; }
    else if (_list_Q(obj)) { return 'list'; }
    else if (_vector_Q(obj)) { return 'vector'; }
    else if (_seq_Q(obj)) { return 'seq'; }
    else if (_hash_map_Q(obj)) { return 'hash-map'; }
    else if (_set_Q(obj)) { return 'set'; }
    else if (_char_Q(obj)) { return 'char'; }
    else if (_nil_Q(obj)) { return 'nil'; }
    else if (_true_Q(obj)) { return 'true'; }
    else if (_false_Q(obj)) { return 'false'; }
    else if (_atom_Q(obj)) { return 'atom'; }
    else if (_lazy_seq_Q(obj)) { return 'lazy-seq'; }
    else {
        switch (typeof (obj)) {
            case 'number': return 'number';
            case 'function': return 'function';
            case 'string': return obj[0] == '\u029e' ? 'keyword' : 'string';
            default: throw new Error("Unknown type '" + typeof (obj) + "'");
        }
    }
}

export function _seq_Q(x) {
    return isSeq(x)
}

export function _lazy_seq_Q(x) {
    console.log(x)
    if (x != null && typeof x === 'object' && x.__lazy_seq__ === true) {
        return x.__lazy_seq__
    }
    return false
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
        case 'set':
            //console.log("comparing", ota, "and", otb)
            if (a.length !== b.length) { return false; }
            for (var i = 0; i < a.length; i++) {
                if (!_equal_Q(a[i], b[i])) { return false; }
            }
            return true;
        case 'hash-map':
            a = a.toObject()
            b = b.toObject()
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

// Chars
export function _char(obj) {
    if (typeof obj === 'string' && obj[0] === '\\') {
        return obj;
    } else {
        return "\\" + obj
    }
}

export function _char_Q(obj) {
    return typeof obj === 'string' && obj[0] === '\\';
}

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
       // console.log("Walking hash-map. Entries:", entries)
        const newMap = new Map(entries)
        //console.log("newMap:", newMap)
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
    //console.log("fn AST:", ast)
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
    //console.log("fn AST (after):", ast)
    //downloadObjectAsJson(ast, "ast.json")
    fn.__meta__ = null;
    //console.log("setting fn __ast__ to", ast)
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
export function _vector_Q(obj) {
    return Array.isArray(obj) && !!obj.__isvector__;
}

// Hash Maps
export function _hash_map() {
    let args = []
    for (let i = 0; i < arguments.length; i+=2) {
        args.push([arguments[i], arguments[i+1]])
    }
    return Map(args)
}

export function _hash_map_Q(hm) {
    return Map.isMap(hm)
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
function Atom(val) { this.val = val; }
export function _atom(val) { return new Atom(val); }
export function _atom_Q(atm) { return atm instanceof Atom; }