import {namespace} from './interpreter'

// Env implementation
export function Env(outer, binds, exprs) {
    this.data = {};
    this.outer = outer || null;

    if (binds && exprs) {
        // Returns a new Env with symbols in binds bound to
        // corresponding values in exprs
        // TODO: check types of binds and exprs and compare lengths
        for (var i=0; i<binds.length;i++) {
            if (binds[i].value === "&") {
                // variable length arguments
                this.data[binds[i+1].value] = Array.prototype.slice.call(exprs, i);
                break;
            } else {
                this.data[binds[i].value] = exprs[i];
            }
        }
    }
    return this;
}
Env.prototype.find = function (key) {
    const k = key.value
    if (k in this.data) { return this; }
    else if (this.outer) {  return this.outer.find(key); }
    else { return null; }
};
Env.prototype.set = function(key, value) {
    this.data[key.value] = value;
    return value;
};
Env.prototype.get = function(key) {
    const k = key.value
    var env = this.find(key);
    if (!env) { throw new Error("'" + k + "' not found"); }
    return env.data[k];
};