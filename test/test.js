"use strict";

global.utilities = undefined;

var ocTranspo = require("../dist/oc-transpo.js");
var utilities = require("extra-utilities");
var chai = require("chai");
var expect = chai.expect;

describe("OC Transpo", function() {
	describe("setup", function() {
		it("should be a function", function() {
			expect(ocTranspo.setup instanceof Function).to.equal(true);
		});
	});

	describe("getRouteDirectionIdentifiers", function() {
		it("should be a function", function() {
			expect(ocTranspo.getRouteDirectionIdentifiers instanceof Function).to.equal(true);
		});
	});

	describe("getStopSummary", function() {
		it("should be a function", function() {
			expect(ocTranspo.getStopSummary instanceof Function).to.equal(true);
		});
	});

	describe("getRouteInformation", function() {
		it("should be a function", function() {
			expect(ocTranspo.getRouteInformation instanceof Function).to.equal(true);
		});
	});

	describe("getStopInformation", function() {
		it("should be a function", function() {
			expect(ocTranspo.getStopInformation instanceof Function).to.equal(true);
		});
	});
});
