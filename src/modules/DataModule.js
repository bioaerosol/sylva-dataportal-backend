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

const ID_BASE_PROJECTION = [
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
]

class DataModule {
    _dbConfig = null;

    constructor(dbConfig) {
        this._dbConfig = dbConfig;
    }

    async getLocations() {
        return await this._withLocationsCollection((locations) => locations.aggregate(locationsPipeline).toArray())
    }

    async getNonHiddenDevices() {
        const pipeline = [
            {
                "$match": {
                    "$or": [
                        { "hidden": { "$exists": false } },
                        { "hidden": false }
                    ]
                }
            },
            {
                "$unwind": {
                    "path": "$devices"
                }
            },
            {
                "$group": {
                    "_id": null,
                    "devices": {
                        "$push": "$devices"
                    }
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "devices": 1
                }
            }
        ]
        
        const result = await this._withLocationsCollection((locations) => locations.aggregate(pipeline).toArray())
        return result.length > 0 ? result[0].devices : []
    }

    _createTimeFilter(/** @type DateTime **/ from, /** @type DateTime **/ to) {
        if (from.isValid && to.isValid && from > to) {
            const temp = from
            from = to
            to = temp
        }

        let timeFilter = {}

        if (from.isValid && !to.isValid) {
            // only right border; start must be gte
            timeFilter = { "start": { "$gte": from.toJSDate() } }
        } else if (!from.isValid && to.isValid) {
            // only left border; end must be lt (exlc.)
            timeFilter = { "end": { "$lt": to.toJSDate() } }
        } else if (from.isValid && to.isValid) {
            // both are given; see https://stackoverflow.com/a/26877645/21658445
            timeFilter = { "start": { "$lt": to.toJSDate() }, "end": { "$gte": from.toJSDate() } }
        }

        return timeFilter
    }

    async findIDsOfDataset(/** @type string **/ datasetName) {
        // Get non-hidden devices
        const nonHiddenDevices = await this.getNonHiddenDevices()
        
        const pipeline = [
            {
                '$match': {
                    'name': datasetName
                }
            }, {
                '$lookup': {
                    'from': 'storage',
                    'localField': 'documents',
                    'foreignField': '_id',
                    'as': 'matched_docs'
                }
            }, {
                '$unwind': '$matched_docs'
            }, {
                '$replaceRoot': {
                    'newRoot': '$matched_docs'
                }
            }, {
                '$match': {
                    'deviceLocation': { '$in': nonHiddenDevices }
                }
            }, ...ID_BASE_PROJECTION
        ]
        
        const idSearch = await this._withDatasetCollection((dataset) => dataset.aggregate(pipeline).toArray())

        return idSearch.length > 0 ? idSearch[0] : { ids: [], totalSize: 0, fileCount: 0 }
    }

    async findIDs(/** @type DateTime **/ from, /** @type DateTime **/ to, /** @type string[] **/ devices) {
        const idSearch = await this._getWithPipeline(from, to, devices, ID_BASE_PROJECTION)

        return idSearch.length > 0 ? idSearch[0] : { ids: [], totalSize: 0, fileCount: 0 }
    }

    async getTimeline(/** @type DateTime **/ from, /** @type DateTime **/ to, /** @type string[] **/ devices, /** @type Resolution **/ resolution) {
        return await this._getWithPipeline(from, to, devices, PipelineForResolution[resolution])
    }

    async _getWithPipeline(/** @type DateTime **/ from, /** @type DateTime **/ to, /** @type string[] **/ devices, pipeline) {
        // Get non-hidden devices
        const nonHiddenDevices = await this.getNonHiddenDevices()
        
        // Filter devices to only include non-hidden ones
        let devicesToUse = nonHiddenDevices
        if (devices) {
            // If specific devices are requested, only include those that are not hidden
            // Use Set for O(1) lookup performance
            const nonHiddenSet = new Set(nonHiddenDevices)
            devicesToUse = devices.filter(device => nonHiddenSet.has(device))
        }
        
        // Add device filter to pipeline
        if (devicesToUse.length > 0) {
            pipeline = [{
                "$match": { deviceLocation: { "$in": devicesToUse } }
            }, ...pipeline]
        } else {
            // No devices to show (all requested devices are hidden or no non-hidden devices exist)
            // Return empty result by matching nothing
            pipeline = [{
                "$match": { _id: null }
            }, ...pipeline]
        }
        
        if (from.isValid || to.isValid) {
            const timeFilter = this._createTimeFilter(from, to)

            pipeline = [{
                "$match": timeFilter
            }, ...pipeline]
        }

        return await this._withStorageCollection((storage) => storage.aggregate(pipeline).toArray())
    }


    async _getDatabase() {
        const mongoUrl = `mongodb://${this._dbConfig.username}:${this._dbConfig.password}@${this._dbConfig.host}:${this._dbConfig.port}/${this._dbConfig.database}?authSource=admin`;
        const client = new MongoClient(mongoUrl)
        await client.connect()
        return client.db('sylva')
    }

    async _withStorageCollection(callback) {
        const database = await this._getDatabase()
        try {
            const collection = database.collection('storage')
            return await callback(collection)
        }
        finally {
            await database.client.close()
        }
    }

    async _withLocationsCollection(callback) {
        const database = await this._getDatabase()
        try {
            const collection = database.collection('locations')
            return await callback(collection)
        }
        finally {
            await database.client.close()
        }
    }

    async _withDatasetCollection(callback) {
        const database = await this._getDatabase()
        try {
            const collection = database.collection('datasets')
            return await callback(collection)
        }
        finally {
            await database.client.close()
        }
    }
}

module.exports = { DataModule, Resolution }
