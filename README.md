# OC Transpo

[![NPM version][npm-version-image]][npm-url]
[![Build Status][build-status-image]][build-status-url]
[![Coverage Status][coverage-image]][coverage-url]
[![Known Vulnerabilities][snyk-image]][snyk-url]
[![Downloads][npm-downloads-image]][npm-url]

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

[npm-url]: https://www.npmjs.com/package/oc-transpo
[npm-version-image]: https://img.shields.io/npm/v/oc-transpo.svg
[npm-downloads-image]: http://img.shields.io/npm/dm/oc-transpo.svg

[build-status-url]: https://travis-ci.org/nitro404/oc-transpo
[build-status-image]: https://travis-ci.org/nitro404/oc-transpo.svg?branch=master

[coverage-url]: https://coveralls.io/github/nitro404/oc-transpo?branch=master
[coverage-image]: https://coveralls.io/repos/github/nitro404/oc-transpo/badge.svg?branch=master

[snyk-url]: https://snyk.io/test/github/nitro404/oc-transpo?targetFile=package.json
[snyk-image]: https://snyk.io/test/github/nitro404/oc-transpo/badge.svg?targetFile=package.json
