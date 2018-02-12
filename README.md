# OC Transpo

A wrapper for the OC Transpo API.

This module is unofficial and is in no way affiliated with OC Transpo.

## Server-Side Usage

```javascript
var transit = require("oc-transpo");

transit.setup({
	key: "42361af08a221433b423a1e662175fa4",
	appID: "ddc42a1b"
});

transit.getStopInformation(3000, function(error, data) {
	if(error) {
		return console.error(error);
	}

	return console.log(data);
});
```

## Installation

To install this module:
```bash
npm install oc-transpo
```
