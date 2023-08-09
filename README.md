﻿# exercism-express

Platform for doing Exercism exercises with live evaluation

Live app: https://bobbicodes.github.io/exercism-express/

## About the interpreter

The interpreter that powers the platform is written in JavaScript, and is only meant to implement a subset of Clojure for the purpose of education. The eventual goal is to reach feature parity with Clojure so that it will be able to run arbitrary code, but certain things, like namespaces, are not implemented because they are mostly necessary for libraries and applications which are out of scope for a basic teaching language.

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
