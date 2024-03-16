const { MongoClient } = require('mongodb')
const { DateTime } = require('luxon')
const timelinePipelineDayRes = require("./pipelines/timeline-day.json")
const timelinePipelineYearRes = require("./pipelines/timeline-year.json")
const timelinePipelineMonthRes = require("./pipelines/timeline-month.json")
const locationsPipeline = require("./pipelines/locations/locations.json")


const Resolution = {
    DAY: 'day',
    MONTH: 'month',
    YEAR: 'year',

    fromString: (value, /** @type Resolution */ defaultValue = Resolution.YEAR) => {
        value = value ? value.toLowerCase() : value

        if (value === Resolution.MONTH) {
            return Resolution.MONTH
        } else if (value === Resolution.DAY) {
            return Resolution.DAY
        } else if (value === Resolution.YEAR) {
            return Resolution.YEAR
        } else {
            return defaultValue
        }
    }
}

const PipelineForResolution = {
    "day": timelinePipelineDayRes,
    "month": timelinePipelineMonthRes,
    "year": timelinePipelineYearRes
}

class DataModule {
    _dbConfig = null;

    constructor(dbConfig) {
        this._dbConfig = dbConfig;
    }

    async getLocations() {
        const locations = await this._getLocationsCollection()
        return await locations.aggregate(locationsPipeline).toArray()
    }

    _createTimeFilter(/** @type DateTime **/ from, /** @type DateTime **/ to) {
        if (from > to) {
            const temp = from
            from = to
            to = temp
        }

        const timeFilter = { "$or": [{ start: {} }, { end: {} }] }

        if (from.isValid) {
            timeFilter["$or"][0].start = { "$gte": from.toJSDate() }
            timeFilter["$or"][1].end = { "$gte": from.toJSDate() }
        }
        if (to.isValid) {
            timeFilter["$or"][0].start = { "$lte": to.toJSDate() }
            timeFilter["$or"][1].end = { "$lte": to.toJSDate() }
        }
        if (from.isValid && to.isValid) {
            timeFilter["$or"].push({ start: { "$lte": from.toJSDate() }, end: { "$gte": to.toJSDate() } })
        }

        return timeFilter
    }

    async findIDs(/** @type DateTime **/ from, /** @type DateTime **/ to, /** @type string[] **/ devices) {        
        const idSearch = await this._getWithPipeline(from, to, devices, [
            {
                "$project": {
                    _id: 0,
                    id: { "$toString": "$_id" },
                    fileSize: 1
                }
            },
            {
                "$group":
                {
                    _id: null,
                    ids: {
                        $push: "$id"
                    },
                    totalSize: {
                        $sum: "$fileSize"
                    },
                    fileCount: {
                        $sum: 1
                    }
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "ids": 1,
                    "totalSize": 1,
                    "fileCount": 1
                }
            }
        ])

        return idSearch.length > 0 ? idSearch[0] : { ids: [], totalSize: 0, fileCount: 0 }
    }

    async getTimeline(/** @type DateTime **/ from, /** @type DateTime **/ to, /** @type string[] **/ devices, /** @type Resolution **/ resolution) {
        return await this._getWithPipeline(from, to, devices, PipelineForResolution[resolution])
    }

    async _getWithPipeline(/** @type DateTime **/ from, /** @type DateTime **/ to, /** @type string[] **/ devices, pipeline) {
        if (from.isValid || to.isValid) {
            const timeFilter = this._createTimeFilter(from, to)

            pipeline = [{
                "$match": timeFilter
            }, ...pipeline]
        }

        if (devices) {
            pipeline = [{
                "$match": { deviceLocation: { "$in": devices } }
            }, ...pipeline]
        }

        const storage = await this._getStorageCollection()
        return await storage.aggregate(pipeline).toArray()
    }


    async _getDatabase() {
        const mongoUrl = `mongodb://${this._dbConfig.username}:${this._dbConfig.password}@${this._dbConfig.host}:${this._dbConfig.port}/${this._dbConfig.database}?authSource=admin`;
        const client = new MongoClient(mongoUrl)
        await client.connect()
        return client.db('sylva')
    }

    async _getStorageCollection() {
        const database = await this._getDatabase()
        return database.collection('storage')
    }

    async _getLocationsCollection() {
        const database = await this._getDatabase()
        return database.collection('locations')
    }

}

module.exports = { DataModule, Resolution }
