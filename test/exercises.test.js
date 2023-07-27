import { assert, expect, test } from 'vitest'
import { evalString, EVAL, deftests, clearTests } from "../src/interpreter"
import exercises from '../exercises.json';
import solutions from '../solutions.json';
import testSuites from '../tests.json';

// Edit an assertion and save to see HMR in action

test('Exercism exercises', () => {
    console.log(Object.keys(solutions)[0])
    //for (let exercise = 0; exercise < Object.keys(solutions).length; exercise++) {        }

    evalString("(do " + solutions.two_fer + ")")
    //evalString("(do " + testSuites.two_fer_test + ")")
    console.log(testSuites.two_fer_test)




    expect(Math.sqrt(4)).toBe(2)
    expect(Math.sqrt(144)).toBe(12)
    expect(Math.sqrt(2)).toBe(Math.SQRT2)
})

test('JSON', () => {
    const input = {
        foo: 'hello',
        bar: 'world',
    }

    const output = JSON.stringify(input)

    expect(output).eq('{"foo":"hello","bar":"world"}')
    assert.deepEqual(JSON.parse(output), input, 'matches original')
})