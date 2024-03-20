const fs = require('fs')
const express = require("express")
const { DataModule, Resolution } = require("./modules/DataModule")
const {WorkspaceModule} = require("./modules/WorkspaceModule")

const { DateTime } = require("luxon")

const args = require('minimist')(process.argv.slice(2), {
    default: {
        configFile: "config.json"
    }
});

const configFile = fs.readFileSync(args.configFile, 'utf8')
const config = JSON.parse(configFile)

const app = express()
app.use(express.json())

const PORT = process.env.SYLVA_BACKEND_PORT || 3000

const dataModule = new DataModule(config.sylvadb)
const workspaceModule = new WorkspaceModule(config.webdb, dataModule)


app.get("/data/timeline(/)?", async (req, res) => {
    const { from, to, devices, resolution } = req.query

    let fromDate = DateTime.fromISO(from, { zone: "utc", setZone: true });
    let toDate = DateTime.fromISO(to, { zone: "utc", setZone: true });

    const devicesArray = devices ? devices.split(",") : undefined
    const resolutionValue = Resolution.fromString(resolution)

    const result = await dataModule.getTimeline(fromDate, toDate, devicesArray, resolutionValue)
    res.json(result);
})

app.get("/location(/)?", async (req, res) => {
    const result = await dataModule.getLocations()
    res.json(result);
})

app.post("/workspace(/)?", async (req, res) => {
    const { from, to, devices, token } = req.body

    if (token !== config.token.download) {
        res.sendStatus(401)
        return
    }
    
    const fromDate = DateTime.fromISO(from, { zone: "utc", setZone: true });
    const toDate = DateTime.fromISO(to, { zone: "utc", setZone: true });

    const devicesArray = devices ? devices.split(",") : undefined
    const result = await workspaceModule.createWorkspace(fromDate, toDate, devicesArray)
    
    res.status(201).json(await workspaceModule.getWorkspace(result._id))
})

app.get("/workspace/:id", async (req, res) => {
    const id = req.params.id
    
    const result = await workspaceModule.getWorkspace(id)

    if (result) {
        res.json(result)
    } else {
        res.sendStatus(404)
    }
})

app.listen(PORT, () => {
    console.log("Server Listening on PORT:", PORT);
})