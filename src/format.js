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

// Convert an integer to a octal string
function oct(n) {
    if (n > 0) {
        return n.toString(8)
    } else {
        if (n < -377777777777777777) {
            throw new Error('"Number out of range for conversion to octal"');
        } else {
            const pn = Number.MAX_SAFE_INTEGER + n + 1
            const s = pn.toString(8)
            if (pn > 0o77777777777777777) {
                let r
                switch (s[0]) {
                    case "3":
                        r = "7"
                        break;
                    case "2":
                        r = "6"
                        break;
                    case "1":
                        r = "5"
                        break;
                    default:
                        break;
                }
                return r + s.substring(1)
            } else {
                const lead = 18 - s.length
                return "40000000000000000".substring(0, lead) + s
            }
        }
    }
}

console.log(oct(-1))