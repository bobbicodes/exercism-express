import { read_str } from './reader.js';
import { _pr_str } from './printer.js';
import * as core from './core.js';
import * as types from './types.js'
import { Env } from './env.js'
import {Map, Seq} from 'immutable'

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
  //console.log("ast:", ast, "env:", env)
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
  //console.log("evaluating ast:", ast, "in", env)
  //console.log("symbol?", types._symbol_Q(ast))
  if (types._symbol_Q(ast)) {
    //console.log(ast.value, "resolved to", resolve(ast, env))
    return env.get(ast);
  } else if (types._list_Q(ast)) {
    return ast.map(function (a) { return EVAL(a, env); });
  } else if (types._vector_Q(ast)) {
    var v = ast.map(function (a) { return EVAL(a, env); });
    v.__isvector__ = true;
    return v;
  } else if (types._hash_map_Q(ast)) {
    const keys = ast.keySeq()
    const vals = ast.valueSeq().map(a => EVAL(a, env))
    return new Map(keys.zip(vals))
  } else {
    //console.log(ast, "is not a symbol, list, vector or map")
    return ast;
  }
}

export var namespace = "user"
export var namespaces = ["user"]
export var deftests = []
var testingString = ""
// loop variables are identified positionally by `recur`,
// so we keep track of the order they're defined
var loopVars = []
// We need to store the ast so we can
// pass it to recur later
var loopAST = []
var loop_env = new Env(repl_env)

var arglist
var fnBody
var isMultiArity

function fnConfig(ast) {
  var a0 = ast[0], a1 = ast[1], a2 = ast[2], a3 = ast[3], a4 = ast[4]
  if (types._string_Q(a2) && types._vector_Q(a3)) {
    //console.log("fn has a docstring and is single-arity")
    arglist = a3
    fnBody = a4
    isMultiArity = false
  }
  if (types._vector_Q(a2)) {
    //console.log("fn has no docstring and is single-arity")
    arglist = a2
    fnBody = a3
    isMultiArity = false
  }
  if (types._string_Q(a2) && types._list_Q(a3)) {
    //console.log("fn has a docstring and is multi-arity")
    fnBody = ast.slice(3)
    isMultiArity = true
  }
  if (types._list_Q(a2)) {
    //console.log("fn has no docstring and is multi-arity")
    fnBody = ast.slice(2)
    isMultiArity = true
  }
}

function _EVAL(ast, env) {
  //console.log("Calling _EVAL", ast)

  while (true) {
    if (!types._list_Q(ast)) {
      //console.log("not a list, passing", ast, "to eval_ast")
      return eval_ast(ast, env);
    }

    // apply list
    //console.log("macroexpanding", ast)
    ast = macroexpand(ast, env);

    if (ast.length === 0) {
      return ast;
    }

    var a0 = ast[0], a1 = ast[1], a2 = ast[2], a3 = ast[3], a4 = ast[4]
    // Keyword functions:
    // If the first element is a keyword,
    // it looks up its value in its argument
    if (types._keyword_Q(a0)) {
      return EVAL([types._symbol("get"), a1, a0], env)
    }

    switch (a0.value) {
      case "comment":
      case "discard":
        return null
      case "ns":
        namespace = a1.value
        namespaces.push(namespace)
        //console.log("namespace changed to", namespace)
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
        env.set(types._symbol(a1), res);
        //console.log("defined", a1.value, "in env:", env)
        return "#'" + namespace + "/" + a1 + " defined"
      case "fn":
        return types._function(EVAL, Env, a2, env, a1);
      case "defn":
      case "defn-":
        // analyze fn signature for docstring/arity 
        fnConfig(ast, env)
        if (isMultiArity) {
          // Create list of fn bodies, one for each arity
          let arities = []
          for (let i = 0; i < fnBody.length; i++) {
            if (types._list_Q(fnBody[i])) {
              arities.push(fnBody[i])
            }
          }
          //console.log("arities", arities)
          // Define each arity as a separate function
          // Check if arglist contains a rest param (&)
          // There can only be one.
          // If so, store it accordingly
          for (let i = 0; i < arities.length; i++) {
            const args = arities[i][0]
            const body = arities[i][1]
            //console.log("args:", args)
            //console.log("body:", body)
            let variadic = false
            for (let i = 0; i < args.length; i++) {
              if (args[i].value === '&') {
                variadic = true
              }
            }
            const fn = types._function(EVAL, Env, body, env, args);
            var fnName
            if (variadic) {
              fnName = a1 + "-variadic"
            } else {
              fnName = a1 + "-arity-" + args.length
            }
            //console.log(fnName)
            env.set(types._symbol(fnName), fn)
          }
          //console.log("env", env)
          return "#'" + namespace + "/" + a1 + " defined"
        } else {
          //console.log("fnbody:", fnBody)
          const fn = types._function(EVAL, Env, fnBody, env, arglist);
          env.set(types._symbol(a1), fn)
          //console.log("function defined:", namespace + "/" + a1)
          //console.log("env:", env)
          return "#'" + namespace + "/" + a1 + " defined"
        }
        var loop_env = new Env(env)
        loopVars = arglist
        loopAST = fnBody
        for (var i = 0; i < a1.length; i += 2) {
          loop_env.set(a1[i], EVAL(a1[i + 1], loop_env))
          loopVars.push(a1[i])
        }
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
          console.log("setting", loopVars[i].value, "to", savedAST[i])
          loop_env.set(loopVars[i], savedAST[i]);
        }
        ast = loopAST[0]
        break;
      case "dispatch":
        // Regex
        if (types._string_Q(a1)) {
          const re = new RegExp(a1, 'g')
          return re
        }
        // Anonymous function shorthand
        if (types._list_Q(a1)) {
          let fun = [types._symbol('fn')]
          const args = ast.toString().match(/%\d?/g).map(types._symbol)
          let body = ast.slice(1)[0]
          fun.push(args)
          fun.push(body)
          return types._function(EVAL, Env, body, env, args);
        }
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
        //console.log("Unit tests:", deftests)
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
        const args = eval_ast(ast.slice(1), env)
        const arity = args.length
        var f
        var fSym
        fnName = ast[0].value.split("/")[1] || ast[0].value
        // First check if there is a variadic arity defined
        if (Object.keys(env.data).includes(fnName + "-variadic")) {
          console.log("Fn has variadic arity defined")
          // if there is, then check if there's a fixed arity that matches
          if (Object.keys(env.data).includes(fnName + "-arity-" + arity)) {
            fSym = types._symbol(ast[0] + "-arity-" + arity)
            //console.log("Calling multi-arity function:", f)
          } else {
            fSym = types._symbol(ast[0] + "-variadic")
            console.log("Calling variadic function:", f)
          }
          f = EVAL(fSym, env)
          //console.log("env:", env)
          // check again if there's a (fixed) multi-arity that matches
        } else if (Object.keys(env.data).includes(fnName + "-arity-" + arity)) {
          fSym = types._symbol(fnName + "-arity-" + arity)
          f = EVAL(fSym, env)
          //console.log("Calling multi-arity function:", f)
        } else {
          fSym = types._symbol(fnName)
          f = EVAL(fSym, env)
          //console.log("Calling single-arity function:", f)
          //console.log("ast:", ast)
          //console.log("args:", args)
        }
        if (f.__ast__) {
          //console.log("setting env to function scope")
          ast = f.__ast__;
          env = f.__gen_env__(args);
        } else {
          return f.apply(f, args);
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
export var repl_env = new Env();
export const evalString = function (str) { return PRINT(EVAL(READ(str), repl_env)); };

// core.js: defined using javascript
for (var n in core.ns) { repl_env.set(types._symbol(n), core.ns[n]); }
repl_env.set(types._symbol('eval'), function (ast) {
  return EVAL(ast, repl_env);
});

export function loadLib(lib) {
  evalString("(do " + lib + ")")
}

//evalString("(def a \"hi\")")
//console.log("env:", repl_env)
//console.log("resolving", resolve("a", repl_env))