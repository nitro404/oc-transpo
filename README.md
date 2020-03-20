# OC Transpo

[![NPM version][npm-version-image]][npm-url]
[![Build Status][build-status-image]][build-status-url]
[![Coverage Status][coverage-image]][coverage-url]
[![Known Vulnerabilities][vulnerabilities-image]][vulnerabilities-url]
[![Dependencies][dependencies-image]][dependencies-url]
[![Downloads][npm-downloads-image]][npm-url]
[![Install Size][install-size-image]][install-size-url]
[![Contributors][contributors-image]][contributors-url]
[![Pull Requests Welcome][pull-requests-image]][pull-requests-url]

**This module is currently incompatible with the latest version of OC Transpo's RESTful API.**

A wrapper for the OC Transpo API.

This module is unofficial and is in no way affiliated with OC Transpo.

## Server-Side Usage

```javascript
const transit = require("oc-transpo");

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

## Building

To build the distribution files for this module:
```bash
npm run build
```
or
```bash
gulp build
```

[npm-url]: https://www.npmjs.com/package/oc-transpo
[npm-version-image]: https://img.shields.io/npm/v/oc-transpo.svg
[npm-downloads-image]: http://img.shields.io/npm/dm/oc-transpo.svg

[build-status-url]: https://travis-ci.org/nitro404/oc-transpo
[build-status-image]: https://travis-ci.org/nitro404/oc-transpo.svg?branch=master

[coverage-url]: https://coveralls.io/github/nitro404/oc-transpo?branch=master
[coverage-image]: https://coveralls.io/repos/github/nitro404/oc-transpo/badge.svg?branch=master

[vulnerabilities-url]: https://snyk.io/test/github/nitro404/oc-transpo?targetFile=package.json
[vulnerabilities-image]: https://snyk.io/test/github/nitro404/oc-transpo/badge.svg?targetFile=package.json

[dependencies-url]: https://david-dm.org/nitro404/oc-transpo
[dependencies-image]: https://img.shields.io/david/nitro404/oc-transpo.svg

[install-size-url]: https://packagephobia.now.sh/result?p=oc-transpo
[install-size-image]: https://badgen.net/packagephobia/install/oc-transpo

[contributors-url]: https://github.com/nitro404/oc-transpo/graphs/contributors
[contributors-image]: https://img.shields.io/github/contributors/nitro404/oc-transpo.svg

[pull-requests-url]: https://github.com/nitro404/oc-transpo/pulls
[pull-requests-image]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg
