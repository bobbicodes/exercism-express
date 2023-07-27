import {  expect, test } from 'vitest'
import { evalString, deftests} from "../src/interpreter"
import solutions from '../solutions.json';
import testSuites from '../tests.json';

test('Exercism exercises', () => {
    const testExercises = ['two_fer', 'hello_world', 'diamond']
    for (let exercise = 0; exercise < testExercises.length; exercise++) {
        console.log("testing", testExercises[exercise])
        evalString("(do " + solutions[testExercises[exercise]] + ")")
        evalString("(do " + testSuites[testExercises[exercise] + "_test"] + ")")
        let fails = []
        for (const test of deftests) {
            if (!test.result) {
                fails.push(test.test.value)
            }
            expect(fails).toStrictEqual([])
        }
    }
})

