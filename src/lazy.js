import {List, Set, Map,} from 'immutable'

export function _emptyList() {
    return List()
}

export function _emptyMap() {
    return Map()
}

export function _set(coll) {
    return Set(coll)
}