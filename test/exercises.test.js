import {  expect, test } from 'vitest'
import { evalString, deftests, clearTests} from "../src/interpreter"
import solutions from '../solutions.json';
import testSuites from '../tests.json';
import config from '../config.json';

let testExercises = []
for (const exercise of config.exercises.practice) {
    if (exercise.difficulty === 1) {
        //console.log(exercise)
        testExercises.push(exercise.slug.replaceAll("-", "_"))
    }
}
//console.log(testExercises)

test('Exercism exercises', () => {
    //const testExercises = ['two_fer', 'hello_world']
    for (let exercise = 0; exercise < 3; exercise++) {
        console.log("testing", testExercises[exercise])
        evalString("(do " + solutions[testExercises[exercise]] + ")")
        evalString("(do " + testSuites[testExercises[exercise] + "_test"] + ")")
        let fails = []
        console.log("deftests:", deftests)
        clearTests()
        for (const test of deftests) {
            if (!test.result) {
                fails.push(test.test.value)
            }
            expect(fails).toStrictEqual([])
        }
    }
})

