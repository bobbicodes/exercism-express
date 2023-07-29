// Ported from https://github.com/quoll/clormat/

// Convert an integer to a hexadecimal string
function hex(n) {
    if (n > 0) {
        return n.toString(16)
    } else {
        const pn = Number.MAX_SAFE_INTEGER + n + 1
        const s = pn.toString(16)
        if (pn > 0x0FFFFFFFFFFFFF) {
            return "3" + s.substring(1)
        } else {
            const lead = 14 - s.length
            return "20000000000000".substring(0, lead) + s
        }
    }
}

console.log(hex(15))