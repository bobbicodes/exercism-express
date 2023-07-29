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

function setWidth(s, w, decr, l, c) {
  /* "Sets the minimum width of a string, padding with a provided character if needed.
     s: The string to set the minimum width for.
     w: The minimum width, as a character count.
     decr: a decrement to use on the width, if not nil
     l: If true, the the output should be left-justified
     c: The character to pad the width, or space if not provided." */
     const wdth = w - decr
     const size = s.length
     const block = Array(wdth - size).fill(c)
     let result
     if (l) {
        result = s + block.join('')
     } else {
        result = block.join('') + s
     }
     if (w && (wdth > size)) {
        return result
     }
     return s
}

//console.log(oct(-1))