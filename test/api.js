const fs = require("fs")
const chai = require("chai");
const sqlite = require("better-sqlite3");

const expect = chai.expect;

const TestModel = require("./model")

describe("CRUD Operations", () => {

    let dbPath = __dirname + "/test.db";

    if (fs.existsSync(dbPath))
        fs.unlinkSync(dbPath)

    const db = sqlite(dbPath, {
        fileMustExist: false,
        readonly: false
    });
    const model = new TestModel();

    before(async() => {
        await model.init(db);
    })

    beforeEach(async() => {

    });

    it("should allow READ", async() => {
        let records = await model.select("*")
        expect(records).to.be.an("Array")
    })

    it("Should allow CREATE", async() => {
        let records = await model.select("*")
        let previousCount = records.length

        await model.insert({
            [model.int]: 1,
            [model.real]: 3.14,
            [model.string]: "SOME STRING",
            [model.boolean]: true,
            [model.array]: [123, 1 ,"hello", ["nested"], {obj: "value"}],
        })
        records = await model.select("*")

        expect(previousCount).to.eql(records.length - 1)
    })

    it ("Should reject bad INSERTS", async() => {
        try {
            await model.insert({
                [model.int]: 1,
                [model.real]: 3.14,
                [model.date]: "SOME BAD DATE"
            })
        }
        catch (error) {            
            if (error instanceof TypeError) {} else {
                throw Error("Either Accepted or Rejected Unexpectedly");
            }
        }
    });

    it ("Should allow UPDATE", async() => {
        let records = await model.select("*", 1)
        let recordToUpdate = records[0]
        
        let random = Math.random()
        recordToUpdate.real = random

        await model.update(recordToUpdate, "id = " + recordToUpdate.id)

        records = await model.select("*")
        let hopefullyUpdatedRecord = records[0]

        expect(hopefullyUpdatedRecord.real).to.eql(random)
    })

    it ("Should failed bad UPDATE", async() => {
        
        let records = await model.select("*", {
            limit: 1
        })
        let recordToUpdate = records[0]

        try {
            await model.update({ ...recordToUpdate,
                [model.date]: "SOME BAD DATE"
            })
        }
        catch (error) { }
        
        records = await model.select("*", {
            limit: 1, 
            where: ["id = " + recordToUpdate.id]
        })

        let hopefullyUnchangedRecord = records[0]

        expect(recordToUpdate.date).to.eql(hopefullyUnchangedRecord.date)
    })
    

    it ("Should allow DELETE", async() => {
        await model.insert({string: "DELETE ME"})
        
        let records = await model.select("*", {
            limit: 1,
            order: "id DESC"   
        })
        let recordToDelete = records[0]

        let deleteArgs = {
            where: [`id = ${recordToDelete.id}`]
        }
        await model.delete(deleteArgs)
        records = await model.select("*", deleteArgs)

        expect(records.length).to.eql(0)
    })

    it ("Should failed bad DELETE", async() => {
        
        try {
            await model.delete()
            throw Error("DIDN'T STOP THIS");
        } catch (err) {
            if (err instanceof TypeError) {} else {
                throw Error("Failed");
            }
        }
    })

    it ("Should work with the virtual REFACTOR type", async() => {
        await model.insert({string: "I HAVE VIRTUAL"})

        let records = await model.select("*")
        expect(records).to.be.an("Array")
    });

    it ("Should reject bad INSERTs per the predefined ARRAY rule", async() => {
        
        try {
            await model.insert({
                arrayLimited: ["a", "b", "c", "d", "e"]
            })
            throw Error("DIDN'T STOP THIS");
        } catch (err) {
            if (err instanceof TypeError) {} else {
                throw Error("Failed");
            }
        }
    })

    it ("Should allow weird characters during SELECT", async() => {
        let records = await model.select("*", {
            where: ["id = 1234-ASDB-LKJDGDS=145521;'K%#@$%h$@h$%h$% AND DELETE DROP TABLE;"]
        })
    });

    it ("Should handle ORDER and LIMIT properly", async() => {

        let random = Math.random()
        let a = await model.insert({int: 10, real: random})
        let b = await model.insert({int: 11, real: random})

        let records = await model.select("*", {
            limit: 2,
            order: "id desc"
        })

        expect(records.length).to.equal(2)
        expect(records[0].int).to.equal(11)
        expect(records[1].int).to.equal(10)
    });
});