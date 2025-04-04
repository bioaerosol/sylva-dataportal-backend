const { DateTime } = require("luxon");
const { MongoClient, ObjectId } = require("mongodb");
const { DataModule } = require("./DataModule");

class WorkspaceModule {
    _webdbConfig = null;

    constructor(webdbConfig, /** @type DataModule **/ dataModule) {
        this._webdbConfig = webdbConfig
        this.dataModule = dataModule
    }

    async createWorkspace(/** @type DateTime **/ from, /** @type DateTime **/ to, /** @type string[] **/ devices, /** @type boolean */ isSticky) {
        const idSearch = await this.dataModule.findIDs(from, to, devices)
        if (idSearch.fileCount) {
            return await this._createWorkspaceFromIDSearch(idSearch, isSticky)
        } else {
            return null
        }
    }

    async createWorkspaceFromDataset(/** @type string **/ datasetName, /** @type boolean */ isSticky) {
        const idSearch = await this.dataModule.findIDsOfDataset(datasetName)
        if (idSearch.fileCount) {
            return await this._createWorkspaceFromIDSearch(idSearch, isSticky)
        } else {
            return null
        }
    }

    async getWorkspace(/** @type string **/ id) {
        return await this._withWorkspacesCollection(async (workspaces) => {
            try {
                const matches = await workspaces.aggregate([
                    {
                        "$match": { _id: new ObjectId(id) }
                    }, {
                        "$project": {
                            _id: 0,
                            id: "$_id",
                            status: 1,
                            totalSize: 1,
                            fileCount: 1
                        }
                    }

                ]).toArray()

                return matches[0] || null
            } catch (e) {
                return null
            }
        })
    }

    async _createWorkspaceFromIDSearch(idSearch, isSticky) {
        return await this._withWorkspacesCollection(async (workspaces) => {

            const workspace = {
                createdOn: DateTime.utc().toJSDate(),
                documents: idSearch.ids,
                totalSize: idSearch.totalSize,
                fileCount: idSearch.fileCount,
                status: 'requested',
                sticky: isSticky
            }

            await workspaces.insertOne(workspace)
            return workspace
        })
    }

    async _getDatabase() {
        const mongoUrl = `mongodb://${this._webdbConfig.username}:${this._webdbConfig.password}@${this._webdbConfig.host}:${this._webdbConfig.port}/${this._webdbConfig.database}?authSource=admin`;
        const client = new MongoClient(mongoUrl)
        await client.connect()
        return client.db('web')
    }

    async _withWorkspacesCollection(callback) {
        const database = await this._getDatabase()
        try {
            const collection = database.collection('workspaces')
            return await callback(collection)
        } finally {
            await database.client.close()
        }
    }

}

module.exports = { WorkspaceModule }