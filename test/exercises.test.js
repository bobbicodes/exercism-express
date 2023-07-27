import { assert, expect, test } from 'vitest'
import { evalString, EVAL, deftests, clearTests } from "../src/interpreter"
import exercises from '../exercises.json';
import solutions from '../solutions.json';
import testSuites from '../tests.json';

// Edit an assertion and save to see HMR in action

test('Exercism exercises', () => {

    //for (let exercise = 0; exercise < Object.keys(solutions).length; exercise++) {        }

    evalString("(do " + solutions.two_fer + ")")
    evalString("(do " + testSuites.two_fer_test + ")")
    //evalString("testSuites.two_fer_test")
    console.log(testSuites.two_fer_test)




    expect(Math.sqrt(4)).toBe(2)
})

