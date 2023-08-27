# exercism-express

## Archived August 2023

Development has moved to https://github.com/bobbicodes/bien

Platform for doing Exercism exercises with live evaluation

Live app: https://bobbicodes.github.io/exercism-express/

## About the interpreter

The interpreter that powers the platform is written in JavaScript, and is only meant to implement a subset of Clojure for the purpose of learning. The project's long term goal is to support most of the language, but does not strive to be used for production software. It is intentionally written in a very naïve style in order to be as easy to understand as possible, in the spirit of the [Mal (Make a Lisp)](https://github.com/kanaka/mal) process upon which this is built.

## Built-in libraries

[Zippers](https://www.st.cs.uni-saarland.de/edu/seminare/2005/advanced-fp/docs/huet-zipper.pdf) have been implemented, and are available as a library that can be loaded:

```clojure
(require "zip")
```

## Dev

```
npm install
npm run dev
```

## Build

```
npm run build
npm run preview
```

## Test

The application has a built-in test function. To activate it, simply uncomment the last line of `main.js`:

```javascript
testExercises()
```
