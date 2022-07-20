const sqlite = require("better-sqlite3");

/**
 * 
 * @param {sqlite.Database} db 
 * @param {String} method Either 'run' or 'all'
 * @param {String} sql The actual query to execute.
 * @param {*} params Extra request parameters.
 * @returns 
 */
const exec = async(db, method, sql, params) => {
	return new Promise((resolve, reject) => {
        try {

            let prepared = db.prepare(sql);
            let actualParams = params != null && Array.isArray(params) && params.length > 0 ? params : undefined;

            if (method == "run") {
                let results = actualParams ? prepared.run(actualParams) : prepared.run();    
                resolve(results.changes);
            } 
            
            else {
                let results = actualParams ? prepared.all(actualParams) : prepared.all(); 
                resolve(results);
            }
        
        } catch (err) {
            console.log("[SQLite Query Prep]:", err)
            reject(err);
        }
	})
}
const run = async(db, sql, params) => exec(db, "run", sql, params);
const get = async(db, sql, params) => exec(db, "get", sql, params);

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