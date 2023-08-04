import './style.css'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { clojure } from "./src/clojure"
import { evalString, EVAL, deftests, clearTests, loadLib } from "./src/interpreter"
import { Env } from "./src/env"
import config from './test/config.json';
import exercises from './test/exercises.json';
import solutions from './test/solutions.json';
import instructions from './test/instructions.json';
import testSuites from './test/tests.json';
import {testCodeBeforeEval} from './src/eval-region'
import core from './src/clj/core.clj?raw'

let editorState = EditorState.create({
  doc: `(partition 3 1 [0 1 2 3 1 2 5 6])`,
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

function loadSolution(slug) {
  loadExercise(slug)
  const k = slug.replaceAll("-", "_")
  const src = solutions[k].trim()
  let doc = view.state.doc.toString()
  const end = doc.length
  view.dispatch({
    changes: { from: 0, to: end, insert: src},
    selection: { anchor: 0, head: 0 }
  })
}

function testSolution(slug) {
  loadExercise(slug)
  const k = slug.replaceAll("-", "_")
  const src = solutions[k].trim()
  let doc = view.state.doc.toString()
  const end = doc.length
  view.dispatch({
    changes: { from: 0, to: end, insert: src},
    selection: { anchor: 0, head: 0 }
  })
  clearTests()
  doc = view.state.doc.toString()
  const testSuite = testSuites[k + "_test"].trim()
  try {
    evalString("(do " + doc + ")")
  } catch (error) {
    results.innerHTML = error
    results.style.color = 'red';
    return null
  }
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
}

function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

//const exercisesToTest = ["hello-world", "two-fer", "reverse-string", "accumulate", "series"]
const exercisesToTest = shuffle(Object.keys(exercises))

function testExercises() {
  let passes = []
  let fails = []
  for (let exercise = 0; exercise < exercisesToTest.length; exercise++) {
    console.log("Testing ", exercisesToTest[exercise])
    testSolution(exercisesToTest[exercise])
    if (results.innerHTML === "Passed 😍") {
      passes.push(exercisesToTest[exercise])
      results.innerHTML = passes.length + " solutions passed 😍"
    } else {
      results.innerHTML = passes.length + " solutions passed, " + exercisesToTest[exercise] + " failed"
      fails.push(exercisesToTest[exercise])
    }
  }
  console.log("Passes:", passes)
  console.log("Fails:", fails)
}

function randExercise() {
  return exercisesToTest[Math.floor(Math.random() * exercisesToTest.length)]
}

evalString("(do " + core + ")")

//loadExercise(randExercise())
//loadExercise("armstrong_numbers")
//oadSolution(randExercise())
//testSolution("armstrong_numbers")
//loadSolution("nth_prime")
//testSolution("accumulate")

testExercises()