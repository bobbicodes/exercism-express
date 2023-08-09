import { _obj_type } from './types.js'
import { Seq } from 'immutable'

export function _println() {
    console.log.apply(console, arguments)
}

export function _pr_str(obj, print_readably) {
    if (typeof print_readably === 'undefined') { print_readably = true; }
    var _r = print_readably;
    //console.log("obj:", obj)
    var ot = _obj_type(obj);

    //console.log("ot:", ot)
    switch (ot) {
        case 'lazy-list':
            return obj
        case 'list':
            var ret = obj.map(function (e) { return _pr_str(e, _r); });
            return "(" + ret.join(' ') + ")";
        case 'vector':
            var ret = obj.map(function (e) { return _pr_str(e, _r); });
            return "[" + ret.join(' ') + "]";
        case 'seq':
            var ret = obj.toArray().map(function (e) { return _pr_str(e, _r); });
            return "(" + ret.join(' ') + ")";
        case 'hash-map':
            var keys = obj.keySeq().toArray().map(function (e) { return _pr_str(e, _r); });
            var vals = obj.valueSeq().toArray().map(function (e) { return _pr_str(e, _r); });
            let kvstring = Seq(keys).interleave(Seq(vals)).join(' ')
            return "{" + kvstring + "}"
        case 'set':
            var arr = Array.from(obj)
            var ret = arr.map(function (e) { return _pr_str(e, _r); });
            return "#{" + ret.join(' ') + "}";
        case 'string':
            if (obj[0] === '\u029e') {
                return ':' + obj.slice(1);
            } else if (_r) {
                return '"' + obj.replace(/\\/g, "\\\\")
                    .replace(/"/g, '\\"')
                    .replace(/\n/g, "\\n") + '"'; // string
            } else {
                return obj;
            }
        case 'keyword':
            return ':' + obj.slice(1);
        case 'nil':
            return "nil";
        case 'atom':
            return "(atom " + _pr_str(obj.val, _r) + ")";
        case 'lazy-seq':
            return obj.ast
        default:
            return obj.toString();
    }
}