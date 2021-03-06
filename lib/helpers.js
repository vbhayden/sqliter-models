const exec = async(db, method, sql, params) => {
	return new Promise((resolve, reject) => {
        try {
            let prepared = db.prepare(sql, error => {
                if (error) {
                    console.log("[SQLite Query Prep]:", error, "\nQuery: ", sql)
                    reject(error);
                } else {
                    prepared[method](params, (error, result) => {
                        if (error) reject(error)
                        else resolve(result);
                    }).finalize();
                }
            })
            
        } catch (err) {
            console.log("[SQLite Query Prep]:", error)
            reject(err);
        }
	})
}
const run = async(db, sql, params) => exec(db, "run", sql, params)
const get = async(db, sql, params) => exec(db, "all", sql, params)

const comparison = (propertyName, operator, value) => `${propertyName} ${operator} ${value}`
const where = (propertyName) => {
    return {
        equals: (value) => comparison(propertyName, "=", value),
        notEquals: (value) => comparison(propertyName, "<>", value),
        greaterThan: (value) => comparison(propertyName, ">", value),
        greaterThanOrEqualTo: (value) => comparison(propertyName, ">=", value),
        lessThan: (value) => comparison(propertyName, "<", value),
        lessThanOrEqualTo: (value) => comparison(propertyName, "<=", value)
    }
}

module.exports = { exec, run, get, where }