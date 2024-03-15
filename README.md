# SYLVA Data Portal Backend
This is a tiny web backend to access meta data and storage data via REST API. The application accesses the SYLVA Meta Data Database (ro) and the Web Workspace Database (rw).

## API Documentation
### Data Timeline
**URL:** `/data/timeline`

**Method:** `GET`

**Description:** Provides storage information for requested timeline and devices. 

**Optional Parameters:**

- `from`: Start of requested timeline to get storage information about as ISO8601 (incl., w/o timezone, interpreted as UTC). Defaults to "no restriction".
- `to`: End of requested timeline to get storage information about as ISO8601 (incl., w/o timezone, interpreted as UTC). Defaults to "no restriction".
- `devices`: Comma-separated list of devices to take into account. Defaults to "all"
- `resolution`: Resolution of answer's aggregation. Possible values are "DAY" or "MONTH" or "YEAR". Defaults to "YEAR".

**Response:**

Storage information containing count and size of SYLVA devices' raw data files.

```json
{
  {
    "data": [
        {
            "size": 14252978537,
            "count": 22,
            "devices": [
                {
                    "device": "FIHELS-JUPITER-1",
                    "count": 17,
                    "size": 12527768714
                },
                {
                    "device": "ESCORD-BAA502-1",
                    "count": 5,
                    "size": 1725209823
                }
            ],
            "date": "2024-02"
        }
    ]
  }
}
```
Remarks:
- size is the size of raw data files in bytes
- count is the number of raw data files

### Workspace
The term workspace corresponds to the SYLVA definition of workspace. Workspaces created by SYLVA data Portal are also called "Web Workspace".
#### Workspace Creation
**URL:** `/workspace`

**Method:** `POST`

**Description:** Creates a web workspace in status "requested". 

**Optional Parameters:**

- `from`: Start of requested timeline to get storage information about as ISO8601 (incl., w/o timezone, interpreted as UTC). Defaults to "no restriction".
- `to`: End of requested timeline to get storage information about as ISO8601 (incl., w/o timezone, interpreted as UTC). Defaults to "no restriction".
- `devices`: Comma-separated list of devices to take into account. Defaults to "all"

**Response:**
302 with link to workspace object

#### Workspace
**URL:** `/workspace/:id`

**Method:** `GET`

**Description:** Returns details of web workspace identified with "id". 

**Response:**

Workspace details such as the status (either "requested" or "provided").

```json
{
    "status": "provided"
}
```

## Development
To develop this software clone this repository and switch into target folder.
```bash
npm i
node src/server
```

### Build
```bash
npm pack
```
## Installation
Go to target server and provide built tar file.
```bash
npm i <tar-file>
```

## Configuration
The application listens on port 3000 or any other port defined by environment variable ```SYLVA_BACKEND_PORT```.

It's recommend to run the application as daemon process using PM2. Information can be found at https://pm2.keymetrics.io/docs/usage/quick-start/

If you like to run this behind a webserver, this will do the trick for Apache2:

Enable modules:
```bash
a2enmod proxy proxy_http
```

Configure your site:
```apache
ProxyPass /api http://localhost:3000
ProxyPassReverse /api http://localhost:3000
```

## Web Workspaces
The SYLVA Data Portal Backend supports download of files. Under the hood it creates a web workspace request in the web database and then, leaves it. To actually 
provide files you could use the command ```sylva-restore``` and pass the IDs of the
workspace request to it. Then, the workspace folder can be provided for download. Provisioning of files is not handled by web backend but could be implemented with a script like this:

```python
#!/usr/bin/env python3
from pymongo import MongoClient
from bson import ObjectId
import subprocess

client = MongoClient('mongodb://<user>:<password>@localhost:27017/')
collection = client['web']['workspaces']

docs = list(collection.find({ "status": "requested" }).sort('createdOn', -1).limit(1))

if (len(docs) > 0):
    doc = docs[0]

    valid_ids = list(filter(ObjectId.is_valid, doc.get('documents', [])))
    workspace_id = doc.get('_id')

    array_str = ' '.join(str(item) for item in valid_ids)

    process = subprocess.run('echo {} | sylva-restore --workspaceId {} `xargs`'.format(array_str, workspace_id), shell=True)

    if (process.returncode == 0):
        collection.update_one({'_id': ObjectId(workspace_id)}, {'$set': {'status': 'provided'}})

    quit(process.returncode)
```