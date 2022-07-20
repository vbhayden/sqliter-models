const sqlite3 = require("better-sqlite3");
const helpers = require("./helpers");
const types = require("./types");

class Model {
    /**
     * @typedef SQLiterForeignOptions Indicates that this property is related to another table.
     * @property {Model} model An instance of the model we're linking.
     * @property {String} key The name of the field we're linking in the other model.
     * @property {Boolean} strict Whether this will actually influence the SQL table creation as a foreign key.
     */
    
    /**
     * @typedef SQLiterProperty
     * @property {String} class Datatype used to store this property within SQLite.
     * @property {Array<String>} decorators Additional SQL field properties to declare.
     * @property {any} default The default value to use when not supplied by a user.
     * @property {Boolean} required Whether or not this property is required for record creation.
     * @property {Boolean} readonly Whether or not this property can be written to after creation.
     * @property {SQLiterForeignOptions} foreign Options for linking this property with another model.
     * @property
     */

    constructor(name) {

        /** @type {String} */
        this.name = name;

        /** @type {String} */
        this.prettyName = name;

        /** @type {Object<string, SQLiterProperty>} */
        this.props = {}

        /** @type {sqlite3.Database} */
        this.db = null;
    }

    /**
     * 
     * @param {Object<string, SQLiterProperty>} props Model properties.
     */
    define(props) {
        this.props = {
            id: {
                name: "id",
                type: types.AUTO_ID,
                description: "Auto-ID",
            },
            ...props
        }
        this.finalize()
    }

    finalize() {
        let propKeys = Object.keys(this.props)

        /** 
         * Take the requested column names and construct a mapping function to process
         * the stored SQL data and return an expected format. 
         * @param {Array<string>} columns Array of the column names we're returning
         * @returns {Function<Object>}
         */
        this.postProcess = columns => obj => {

            let processed = {}

            // Every column we're going to return
            let returningColumns = columns == "*" ? propKeys : columns

            for (let column of returningColumns) {

                let prop = this.props[column]

                if (prop == undefined)
                    throw Error(`Invalid property for model (${this.name}): ${column}`)
                
                else if (prop.type.out != undefined) {
                    if (prop.type.class == "VIRTUAL") processed[column] = prop.type.out(obj)
                    else processed[column] = prop.type.out(obj[column])
                }
                else
                    processed[column] = obj[column]
            }

            if (returningColumns.length == 1)
                return processed[returningColumns[0]]
            else
                return processed
        }

        /** 
         * Processes the received object and converts it to a SQL-friendly format based on how
         * the model's corresponding properties are defined.
         * @param {Object<string, any>} obj The object we're processing
         * @returns {Object<string, any>}
         */
        this.preProcess = obj => {

            let processed = {
                ...obj
            }
            for (let propKey of propKeys) {
                let prop = this.props[propKey]
                
                let propName = prop.name
                if (processed[propName] != undefined && prop.type.in != undefined) 
                    processed[propName] = prop.type.in(processed[propName])

                if (prop.type.class == "VIRTUAL")
                    delete processed[propName]
            }

            return processed
        }
    }

    hasProperty(prop) {
        return this.props[prop] !== undefined
    }

    badProps(obj, isCreation) {
        let bads = []

        Object.keys(obj).forEach(prop => {

            let objValue = obj[prop]
            let modelProp = this.props[prop]

            try {
                if (modelProp == undefined)
                    bads.push(prop)

                else if (modelProp.type.typeCheck != undefined && modelProp.type.typeCheck(objValue) == false) {
                    bads.push(prop)
                }
            } catch (error) {
                console.log("ERROR:", error)
                bads.push(prop)
            }
        });
        return bads;
    }

    /**
     * Checks if a given object matches this model's schema.
     * @param {Object} obj Possible model match to verify.
     */
    verify(obj) {
        Object.keys(obj).forEach(prop => {

            let objValue = obj[prop]
            let modelProp = this.props[prop]

            try {

                if (modelProp == undefined) {
                    console.log(`[SQLiter]: Unknown property: ${this.name}.${prop}.  Received as ${prop}: ${objValue}`)
                    return false;
                }

                else if (modelProp.type.typeCheck != undefined && modelProp.type.typeCheck(objValue) == false) {
                    console.log(`[SQLiter]: Type check failed for ${this.name}.${prop}.  Received: ${objValue}`)
                    return false;
                }
            } catch (error) {
                console.log("SCHEMA VERIFICATION ERROR: ", error);
                return false;
            }

        });
        return true;
    }

    buildRelation(raw) {

        let parseMatches = (raw, matches, operatorLength) => {
            
            let operator = matches[0].substr(0, operatorLength)
            let parts = raw.split(operator, 2)
            return {
                field: parts[0],
                operator: operator,
                value: parts[1]
            }
        }

        let single = raw.match(/(<|=|>).*/g)
        if (single != undefined && single.length > 0) {

            let double = raw.match(/(<=|>=|<>).*/g)
            if (double != undefined && double.length > 0)
                return parseMatches(raw, double, 2)
            else
                return parseMatches(raw, single, 1)
        }

        return null;
    }

    /**
     * @typedef QueryArgs
     * @property {Number} limit Number of records to influence.
     * @property {Number} offset Offset of the starting record.
     * @property {Number} order Ordering of records, "id DESC" for example.
     * @property {Array<string>} where Array of where conditions.
     */
    /**
     * Assemble the narrowing SQL clauses given these arguments
     * @param {QueryArgs} args 
     */
    buildClause(args) {

        if (args == undefined)
            return ""

        let clause = {
            string: "",
            args: []
        }

        if (Array.isArray(args.where) && args.where.length > 0) {
            clause.string += "WHERE " + args.where.map(relation => {

                let relationObj = this.buildRelation(relation)
                if (relationObj) {
                    clause.args.push(relationObj.value)
                    return `${relationObj.field} ${relationObj.operator} (?)`
                } else 
                    return ""

            }).join(" AND ");
        }

        if (args.order != undefined && typeof args.order == "string") {
            let parts = args.order.split(" ")
            let prop = parts[0]
            let mode = parts[1].toUpperCase();

            if (this.props[prop] != undefined && (mode == "ASC" || mode == "DESC")) {
                clause.string += ` ORDER BY ${prop} ${mode}`
            }
        }
    
        if (args.limit != undefined && Number.isInteger(args.limit)) {
            clause.string += ` LIMIT ${args.limit}`
        }

        if (args.offset != undefined && Number.isInteger(args.offset)) {
            clause.string += ` OFFSET ${args.offset}`
        }

        return clause;
    }

    async init(db) {

        this.db = db;

        let foreignKeys = []
        let tablePropsArr = Object.keys(this.props).map(propName => {
            
            let property = this.props[propName]
            let type = property.type

            if (type.class == "VIRTUAL")
                return null

            let decorators = (type.decorators) ? type.decorators.join(" ") : ""
            let defaultValue = (property.default) ? `DEFAULT ${property.type.in != undefined ? property.type.in(property.default) : property.default}` : ""

            if (property.foreign && property.foreign.strict) {
                let foreignKey = property.foreign.key
                let foreignModel = property.foreign.model.name;
                foreignKeys.push(`FOREIGN KEY(${property.name}) REFERENCES ${foreignModel}(${foreignKey})`)
            }

            return `${property.name} ${type.class} ${decorators} ${defaultValue}`
        })

        let tableProps = tablePropsArr.filter(val => val != null).join(", ")

        let query = `CREATE TABLE IF NOT EXISTS ${this.name} (${tableProps} ${foreignKeys.length > 0 ? "," + foreignKeys.join(", ") : ""});`;
        return helpers.run(this.db, query);
    }

     /**
      * 
      * @param {*} columns 
      * @param {QueryArgs} args 
      */
    async select(columns, args) {

        let columnChoice = Array.isArray(columns) ? columns : columns == "*" ? Object.keys(this.props) : [columns]

        // Remove any virtual properties they might've requested
        let sqlColumns = columnChoice.filter(column => this.props[column].class != "VIRTUAL")

        let clause = this.buildClause(args)
        let query = `SELECT * FROM ${this.name} ${clause.string};`

        let records = await helpers.get(this.db, query, clause.args);

        if (records == undefined)
            records = []

        let processed = records.map(this.postProcess(sqlColumns));

        return processed
    }

    async insert(props) {
        let bads = this.badProps(props, true)
        if (bads.length > 0) {
            throw TypeError("BAD PROPERTIES: " + bads)
        }

        let processed = this.preProcess(props)

        let columns = Object.keys(processed)
        let values = columns.map(column => processed[column])

        let query = `INSERT INTO ${this.name} (${columns.join(", ")}) VALUES (${values.map(value => "(?)").join(", ")});`

        let result = await helpers.run(this.db, query, values)
        let inserted = await this.select("id", {
            limit: 1,
            order: "id DESC"
        })

        return inserted
    }

    async update(props, args) {

        let bads = this.badProps(props, false)
        if (bads.length > 0) {
            throw TypeError("BAD PROPERTIES: " + bads)
        }

        let processed = this.preProcess(props)
        
        // You can't update the ID
        let propsAdj = {...processed}
        if (propsAdj.id)
            delete propsAdj["id"]

        let updates = Object.keys(propsAdj).map(prop => `${prop} = (?)`).join(", ")
        let values = Object.keys(propsAdj).map(prop => propsAdj[prop])

        let clause = this.buildClause(args)
        let query = `UPDATE ${this.name} SET ${updates} ${clause.string};`

        await helpers.run(this.db, query, [...values, ...clause.args])
        let updated = await this.select("id", args)
        
        return updated
    }

    async delete(args) {

        if (!args || args.where == undefined || args.where.length == 0) {
            throw TypeError("TABLE DROP REQUESTED, REFUSING");
        }

        let clause = this.buildClause(args)
        let query = `DELETE FROM ${this.name} ${clause.string};`;

        let deleted = await this.select("id", args)
        await helpers.run(this.db, query, clause.args)
        
        return deleted
    }
}

module.exports = Model;