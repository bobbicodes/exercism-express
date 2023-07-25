import './style.css'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { clojure } from "./src/clojure"
import { evalString, EVAL, deftests, clearTests } from "./src/interpreter"
import { Env } from "./src/env"
import config from './config.json';
import exercises from './exercises.json';
import instructions from './instructions.json';
import testSuites from './tests.json';
import {testCodeBeforeEval} from './src/eval-region'

let editorState = EditorState.create({
  doc: `(defn two-fer
    ([] (str "One for you, one for me."))
    ([name] (str "One for " name ", one for me.")))`,
  extensions: [basicSetup, clojure()]
})

let view = new EditorView({
  state: editorState,
  parent: document.querySelector('#app')
})

let testState = EditorState.create({
  readOnly: true,
  extensions: [
    //EditorView.editable.of(false),
    basicSetup, clojure()]
})

let testView = new EditorView({
  state: testState,
  parent: document.querySelector('#test')
})

let topLevelText = "Alt+Enter = Eval top-level form"
let keyBindings = "<strong>Key bindings:</strong>,Shift+Enter = Eval cell," +
  topLevelText + ",Ctrl/Cmd+Enter = Eval at cursor";
keyBindings = keyBindings.split(',');
for (let i = 0; i < keyBindings.length; i++)
  keyBindings[i] = "" + keyBindings[i] + "<br>";
keyBindings = keyBindings.join('');
document.getElementById("keymap").innerHTML = keyBindings;

for (const exercise of config.exercises.practice) {
  const select = document.getElementById("exercise-select")
  const opt = document.createElement('option')
  opt.value = exercise.slug
  opt.innerHTML = exercise.name
  select.appendChild(opt)
}

const select = document.getElementById("exercise-select")
const opt = document.createElement('option')
select.addEventListener('change', function () {
  const doc = view.state.doc.toString()
  const end = doc.length
  loadExercise(select.value)
});

let exercise = null
const results = document.getElementById("results")

function loadExercise(slug) {
  results.innerHTML = ""
  exercise = slug
  const instructionsElement = document.getElementById("instructions")
  const k = slug.replaceAll("-", "_")
  const src = exercises[k].trim()
  const testSuite = testSuites[k + "_test"].trim()
  //clearTests()
  //evalString("(do " + testSuite + ")")
  //console.log("Deftests:", deftests)
  const doc = view.state.doc.toString()
  const testDoc = testView.state.doc.toString()
  const end = doc.length
  instructionsElement.innerHTML = instructions[k].substring(17).trim()
  view.dispatch({
    changes: { from: 0, to: end, insert: src},
    selection: { anchor: 0, head: 0 }
  })
  testView.dispatch({
    changes: { from: 0, to: testDoc.length, insert: testSuite},
    selection: { anchor: 0, head: 0 }
  })
}

const button = document.getElementById("button")

button.addEventListener('click', function () {
  const k = exercise.replaceAll("-", "_")
  const testSuite = testSuites[k + "_test"].trim()
  clearTests()
  //console.log("Running tests")
  //let testEnv = new Env()
  const doc = view.state.doc.toString()
  //console.log("Doc:", doc)
  evalString("(do " + doc + ")")
  //console.log("testEnv:", testEnv)
  try {
    evalString("(do " + testSuite + ")")
  } catch (error) {
    results.innerHTML = error
    results.style.color = 'red';
    return null
  }
  
  let fails = []
  for (const test of deftests) {
    if (!test.result) {
      fails.push(test.test.value)
    }
    //console.log("fails:", fails)
  }
  const uniqueFails = [...new Set(fails)];
  //console.log("uniqueFails: ", uniqueFails)
  if (uniqueFails.length == 1) {
    results.innerHTML = "1 fail: " + uniqueFails[0]
    results.style.color = 'red';
  } else if (uniqueFails.length > 1) {
    results.innerHTML = uniqueFails.length + " fails: " + uniqueFails.join(", ")
    results.style.color = 'red';
  }
   else {
    results.innerHTML = "Passed 😍"
    results.style.color = 'green';
  }
})

//loadExercise("two-fer")
