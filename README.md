# exercism-express

Platform for doing Exercism exercises with live evaluation

Live app: https://bobbicodes.github.io/exercism-express/

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