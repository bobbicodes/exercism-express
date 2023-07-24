import { read_str } from './reader.js';
import { _pr_str } from './printer.js';
import * as core from './core.js';
import * as types from './types.js'
import { Env } from './env.js'

// read
function READ(str) {
  return read_str(str);
}

// eval
function qqLoop(acc, elt) {
  if (types._list_Q(elt) && elt.length
    && types._symbol_Q(elt[0]) && elt[0].value == 'splice-unquote') {
    return [types._symbol("concat"), elt[1], acc];
  } else {
    return [types._symbol("cons"), quasiquote(elt), acc];
  }
}
function quasiquote(ast) {
  if (types._list_Q(ast) && 0 < ast.length
    && types._symbol_Q(ast[0]) && ast[0].value == 'unquote') {
    return ast[1];
  } else if (types._list_Q(ast)) {
    return ast.reduceRight(qqLoop, []);
  } else if (types._vector_Q(ast)) {
    return [types._symbol("vec"), ast.reduceRight(qqLoop, [])];
  } else if (types._symbol_Q(ast) || types._hash_map_Q(ast)) {
    return [types._symbol("quote"), ast];
  } else {
    return ast;
  }
}

function is_macro_call(ast, env) {
  return types._list_Q(ast) &&
    types._symbol_Q(ast[0]) &&
    env.find(ast[0]) &&
    env.get(ast[0])._ismacro_;
}

function macroexpand(ast, env) {
  while (is_macro_call(ast, env)) {
    var mac = env.get(ast[0]);
    ast = mac.apply(mac, ast.slice(1));
  }
  return ast;
}

function eval_ast(ast, env) {
  //  console.log("AST:", ast)
  if (types._symbol_Q(ast)) {
    return env.get(ast);
  } else if (types._list_Q(ast)) {
    return ast.map(function (a) { return EVAL(a, env); });
  } else if (types._vector_Q(ast)) {
    var v = ast.map(function (a) { return EVAL(a, env); });
    v.__isvector__ = true;
    return v;
  } else if (types._hash_map_Q(ast)) {
    var new_hm = {};
    for (const k in ast) {
      new_hm[k] = EVAL(ast[k], env);
    }
    return new_hm;
  } else {
    return ast;
  }
}

export let namespace = "user"
export let deftests = []
let testingString = ""
// loop variables are identified positionally by `recur`,
// so we keep track of the order they're defined
let loopVars = []
// We need to store the ast so we can
// pass it to recur later
let loopAST = []
var loop_env = new Env(repl_env)

// We need a function that will tell us if the ast 
// has a `loop` in it.

// Ported from clojure.walk: https://github.com/clojure/clojure/blob/master/src/clj/clojure/walk.clj
function walk(inner, outer, form) {
  //console.log("Walking form:", form)
  if (types._list_Q(form)) {
      return outer(form.map(inner))
  } else if (types._vector_Q(form)) {
      let v = outer(form.map(inner))
      v.__isvector__ = true;
      return v
  } else if (form.__mapEntry__) {
      const k = inner(form[0])
      const v = inner(form[1])
      let mapEntry = [k, v]
      mapEntry.__mapEntry__ = true
      return outer(mapEntry)
  } else if (types._hash_map_Q(form)) {
      const entries = seq(form).map(inner)
      let newMap = {}
      entries.forEach(mapEntry => {
          newMap[mapEntry[0]] = mapEntry[1]
      });
      return outer(newMap)
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
      if (x.value == types._symbol("loop")) {
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

function _EVAL(ast, env) {
  // console.log("Calling _EVAL", ast, env)

  while (true) {

    //printer.println("EVAL:", printer._pr_str(ast, true));
    if (!types._list_Q(ast)) {
      return eval_ast(ast, env);
    }

    // apply list
    ast = macroexpand(ast, env);
    if (!types._list_Q(ast)) {
      return eval_ast(ast, env);
    }
    if (ast.length === 0) {
      return ast;
    }

    var a0 = ast[0], a1 = ast[1], a2 = ast[2], a3 = ast[3], a4 = ast[4]
    switch (a0.value) {
      case "ns":
        namespace = a1
        return null
      case "let":
        var let_env = new Env(env);
        for (var i = 0; i < a1.length; i += 2) {
          let_env.set(a1[i], EVAL(a1[i + 1], let_env));
        }
        ast = a2;
        env = let_env;
        break;
      case "def":
        var res = EVAL(a2, env);
        return env.set(a1, res);
      case "fn":
        return types._function(EVAL, Env, a2, env, a1);
      case "defn":
      case "defn-":
        // Support docstrings
        let fnbody = a3
        let fnargs = a2
        if (types._string_Q(a2) && types._vector_Q(a3)) {
          fnbody = a4
          fnargs = a3
        }
        var loop_env = new Env(env)
        loopVars = fnargs
        loopAST = fnbody
        for (var i = 0; i < a1.length; i += 2) {
          loop_env.set(a1[i], EVAL(a1[i + 1], loop_env))
          loopVars.push(a1[i])
        }
        const fn = types._function(EVAL, Env, fnbody, env, fnargs);
        env.set(a1, fn)
        return "Defined: " + "#'" + namespace + "/" + a1
      case "loop":
        loopVars = []
        loop_env = new Env(env)
        loopAST = ast.slice(2)
        for (var i = 0; i < a1.length; i += 2) {
          loop_env.set(a1[i], EVAL(a1[i + 1], loop_env))
          loopVars.push(a1[i])
        }
        ast = a2;
        env = loop_env;
        break;
      case "recur":
        const savedAST = eval_ast(ast.slice(1), loop_env)
        for (var i = 0; i < loopVars.length; i += 1) {
          loop_env.set(loopVars[i], savedAST[i]);
        }
        ast = loopAST[0]
        break;
      case "dispatch":
        if (types._string_Q(a1)) {
          const re = new RegExp(a1, 'g')
          return re
        }
        let fun = [types._symbol('fn')]
        const args = ast.toString().match(/%\d?/g).map(types._symbol)
        let body = ast.slice(1)[0]
        fun.push(args)
        fun.push(body)
        return types._function(EVAL, Env, body, env, args);
      case "quote":
        return a1;
      case "quasiquoteexpand":
        return quasiquote(a1);
      case "quasiquote":
        ast = quasiquote(a1);
        break;
      case 'defmacro':
        var func = types._clone(EVAL(a2, env));
        func._ismacro_ = true;
        return env.set(a1, func);
      case 'deftest':
        var res = EVAL(a2, env);
        env.set(a1, res);
        deftests.push({ test: a1, result: res })
        console.log("Unit tests:", deftests)
        return EVAL(a2, env)
      //return "Defined test: " + a1
      case 'testing':
        testingString = testingString + a1
        return EVAL(a2, env)
      case 'macroexpand':
        return macroexpand(a1, env);
      case "try":
        try {
          return EVAL(a1, env);
        } catch (exc) {
          if (a2 && a2[0].value === "catch") {
            if (exc instanceof Error) { exc = exc.message; }
            return EVAL(a2[2], new Env(env, [a2[1]], [exc]));
          } else {
            throw exc;
          }
        }
      case "do":
        eval_ast(ast.slice(1, -1), env);
        ast = ast[ast.length - 1];
        break;
      case "if":
        var cond = EVAL(a1, env);
        if (cond === null || cond === false) {
          ast = (typeof a3 !== "undefined") ? a3 : null;
        } else {
          ast = a2;
        }
        break;
      default:
        var el = eval_ast(ast, env), f = el[0];
        if (f.__ast__) {
          ast = f.__ast__;
          env = f.__gen_env__(el.slice(1));
        } else {
          return f.apply(f, el.slice(1));
        }
    }

  }
}

export function clearTests() {
  deftests = []
}

export function EVAL(ast, env) {
  // console.log("Calling _EVAl:", ast, "in env", env)
  var result = _EVAL(ast, env);
  // console.log("Eval result:", result)
  return (typeof result !== "undefined") ? result : null;
}

// print
function PRINT(exp) {
  return _pr_str(exp, true);
}

// repl
var repl_env = new Env();
export const evalString = function (str) { return PRINT(EVAL(READ(str), repl_env)); };

// core.js: defined using javascript
for (var n in core.ns) { repl_env.set(types._symbol(n), core.ns[n]); }

evalString("(def not (fn (a) (if a false true)))");
evalString("(defmacro cond (fn (& xs) (if (> (count xs) 0) (list 'if (first xs) (if (> (count xs) 1) (nth xs 1) (throw \"odd number of forms to cond\")) (cons 'cond (rest (rest xs)))))))");
evalString("(def dec (fn (a) (- a 1)))")
evalString("(def zero? (fn (n) (= 0 n)))")
evalString("(def identity (fn (x) x))")
evalString(`(def reduce
  (fn (f init xs)
    (if (empty? xs)
      init
      (reduce f (f init (first xs)) (rest xs)))))`)
evalString("(def _iter-> (fn [acc form] (if (list? form) `(~(first form) ~acc ~@(rest form)) (list form acc))))")
evalString("(defmacro -> (fn (x & xs) (reduce _iter-> x xs)))")
evalString("(def _iter->> (fn [acc form] (if (list? form) `(~(first form) ~@(rest form) ~acc) (list form acc))))")
evalString("(defmacro ->> (fn (x & xs) (reduce _iter->> x xs)))")
evalString(`(def gensym
  (let [counter (atom 0)]
    (fn []
      (symbol (str "G__" (swap! counter inc))))))`)
evalString("(defmacro or (fn (& xs) (if (empty? xs) nil (if (= 1 (count xs)) (first xs) (let (condvar (gensym)) `(let (~condvar ~(first xs)) (if ~condvar ~condvar (or ~@(rest xs)))))))))")
evalString(`(def memoize
  (fn [f]
    (let [mem (atom {})]
      (fn [& args]
        (let [key (str args)]
          (if (contains? @mem key)
            (get @mem key)
            (let [ret (apply f args)]
              (do
                (swap! mem assoc key ret)
                ret))))))))`)
evalString(`(def partial (fn [pfn & args]
  (fn [& args-inner]
    (apply pfn (concat args args-inner)))))`)
evalString(`(def every?
  (fn (pred xs)
    (cond (empty? xs)       true
          (pred (first xs)) (every? pred (rest xs))
          true              false)))`)
evalString("(defn reverse [coll] (reduce conj () coll))")
evalString("(defmacro when (fn [x & xs] (list 'if x (cons 'do xs))))")