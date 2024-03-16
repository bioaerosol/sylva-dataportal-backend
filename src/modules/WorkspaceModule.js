const { DateTime } = require("luxon");
const { MongoClient, ObjectId } = require("mongodb");
const { DataModule } = require("./DataModule");

class WorkspaceModule {
    _webdbConfig = null;

    constructor(webdbConfig, /** @type DataModule **/ dataModule) {
        this._webdbConfig = webdbConfig
        this.dataModule = dataModule
    }

    async createWorkspace(/** @type DateTime **/ from, /** @type DateTime **/ to, /** @type string[] **/ devices) {
        const idSearch = await this.dataModule.findIDs(from, to, devices)

        const workspaces = await this._getWorkspacesCollection()

        const workspace = {
            createdOn: DateTime.utc().toJSDate(),
            documents: idSearch.ids,
            totalSize: idSearch.totalSize,
            fileCount: idSearch.fileCount,
            status: 'requested'
        }

        await workspaces.insertOne(workspace)
        return workspace
    }

    async getWorkspace(/** @type string **/ id) {
        const workspaces = await this._getWorkspacesCollection()
        try {
            const matches = await workspaces.aggregate([
                {
                    "$match": { _id: new ObjectId(id) }
                }, {
                    "$project": {
                        _id: 0,
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
    }

    async _getDatabase() {
        const mongoUrl = `mongodb://${this._webdbConfig.username}:${this._webdbConfig.password}@${this._webdbConfig.host}:${this._webdbConfig.port}/${this._webdbConfig.database}?authSource=admin`;
        const client = new MongoClient(mongoUrl)
        await client.connect()
        return client.db('web')
    }

    async _getWorkspacesCollection() {
        const database = await this._getDatabase()
        return database.collection('workspaces')
    }

}

module.exports = { WorkspaceModule }