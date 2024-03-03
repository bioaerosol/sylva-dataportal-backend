const fs = require('fs')
const express = require("express")
const { DataModule, Resolution } = require("./modules/DataModule")

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

app.get("/data/timeline(/)?", async (req, res) => {
    const { from, to, devices, resolution } = req.query

    let fromDate = DateTime.fromISO(from, { zone: "utc", setZone: true });
    let toDate = DateTime.fromISO(to, { zone: "utc", setZone: true });

    const devicesArray = devices ? devices.split(",") : undefined
    const resolutionValue = Resolution.fromString(resolution)

    const result = await new DataModule(config).getTimeline(fromDate, toDate, devicesArray, resolutionValue)
    res.json({ data: result });
})

app.get("/locations(/)?", async (req, res) => {
    const result = await new DataModule(config).getLocations()
    res.json(result);
})

app.listen(PORT, () => {
    console.log("Server Listening on PORT:", PORT);
});