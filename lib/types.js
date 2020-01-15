const types = {

    AUTO_ID: {
        name: "AUTO_ID",
        class: "INTEGER",
        typeCheck: val => Number.isInteger(val),
        decorators: [
            "PRIMARY KEY",
            "AUTOINCREMENT"
        ],
    },
    UTC_DATE:  {
        name: "UTC_DATE",
        class: "INTEGER",
        typeCheck: val => !isNaN(new Date(val).getTime()),
        in: val => new Date(val).getTime(),
        out: storedVal => new Date(storedVal).toISOString(),
    },
    ISO_DATE:  {
        name: "ISO_DATE",
        class: "INTEGER",
        typeCheck: val => !isNaN(new Date(val).getTime()),
        in: val => new Date(val).getTime(),
        out: storedVal => new Date(storedVal).toISOString(),
    },
    TEXT:{
        name: "TEXT",
        class: "TEXT",
        typeCheck: val => typeof val == "string",
    },
    INTEGER: {
        name: "INTEGER",
        class: "INTEGER",
        in: val => Number.parseInt(val),
        typeCheck: val => !isNaN(Number.parseInt(val)),
    },
    REAL: {
        name: "REAL",
        class: "REAL",
        in: val => Number.parseFloat(val),
        typeCheck: val => !isNaN(Number.parseFloat(val)),
    },

    /**
     * @typedef ArrayRestrictionArgs Set of limiting factors for the array type
     * @property {Array<any>} predefined List of allowable array elements.
     */
    /**
     * @param {ArrayRestrictionArgs} args Restriction arguments.
     */
    ARRAY: args => {
        return {
            name: (args && args.predefined) ? "FLAGS" : "ARRAY",
            class: "TEXT",
            args: args,
            in: val => {
                let inbound = !val ? "[]" : JSON.stringify(val)
                return inbound;
            }, 
            out: storedVal => { 
                let outbound = !storedVal ? [] : JSON.parse(storedVal)
                return outbound;
            },
            typeCheck: val => {

                if (!Array.isArray(val)) {
                    console.log("NOT AN ARRAY");
                    return false
                }
                else if (!args)
                    return true;
                else {
                    if (args.predefined) {
                        for (let element of val) {
                            if (!args.predefined.includes(element)) {
                                console.log("ILLEGAL ELEMENT:", element, "NOT IN", args.predefined)
                                return false
                            }
                        }
                        return true;
                    }
                    return true
                }
            }
        }
    },

    BOOL : {
        name: "BOOL",
        class: "INTEGER",
        in: val => val ? 1 : 0,
        out: storedVal => storedVal == 1,
        typeCheck: val => typeof val == "boolean"
    },

    REFACTOR: (operation) => {
        return {
            name: "TEXT",
            class: "VIRTUAL",
            out: obj => operation(obj),
            readonly: true,
        }
    },
}

types.ENUM = {...types.TEXT, name: "ENUM"}

module.exports = types;