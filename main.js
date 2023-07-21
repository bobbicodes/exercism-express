import './style.css'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { clojure } from "./src/clojure"
import config from './config.json';
import exercises from './exercises.json';

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
  const k = slug.replaceAll("-", "_")
  const src = exercises[k]
  const doc = view.state.doc.toString()
  const end = doc.length
  view.dispatch({
    changes: { from: 0, to: end, insert: src},
    selection: { anchor: 0, head: 0 }
  })
}
