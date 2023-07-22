import './style.css'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { clojure } from "./src/clojure"
import config from './config.json';
import exercises from './exercises.json';
import instructions from './instructions.json';
import testSuites from './tests.json';
import {testCodeBeforeEval} from './src/eval-region'

let editorState = EditorState.create({
  doc: `(defn pos-neg-or-zero [n]
  (cond
    (< n 0) "negative"
    (> n 0) "positive"
    :else "zero"))
      
(pos-neg-or-zero -6)`,
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
  console.log("set to", select.value)
});

function loadExercise(slug) {
  const instructionsElement = document.getElementById("instructions")
  const k = slug.replaceAll("-", "_")
  const src = exercises[k].trim()
  const testSuite = testSuites[k + "_test"].trim()
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

loadExercise("hello-world")