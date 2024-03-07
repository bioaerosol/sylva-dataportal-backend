# SYLVA Web Backend
This is a tiny web backend to access meta data and storage data via REST API. The application accesses the SYLVA Meta Data Database to get its information.

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
- count is the numebr of raw data files

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