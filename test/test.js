"use strict";

global.utilities = undefined;

const ocTranspo = require("../src/transit.js");
const utilities = require("extra-utilities");
const chai = require("chai");
const expect = chai.expect;

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
