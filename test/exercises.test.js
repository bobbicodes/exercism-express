import { assert, expect, test } from 'vitest'
import { evalString, EVAL, deftests, clearTests } from "../src/interpreter"
import exercises from '../exercises.json';
import solutions from '../solutions.json';
import testSuites from '../tests.json';

test('Exercism exercises', () => {
    const testExercises = ['two_fer']
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

