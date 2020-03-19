"use strict";

const changeCase = require("change-case-bundled");
const utilities = require("extra-utilities");
const envelope = require("node-envelope");

const transit = { };

const apiAddress = "http://api.octranspo1.com/v1.2";

let apiKey = null;
let appID = null;

const errorCodes = {
	"1": "Invalid API key",
	"2": "Unable to query data source",
	"10": "Invalid stop number",
	"11": "Invalid route number",
	"12": "Stop does not service route"
};

function formatError(error) {
	const formattedError = { };

	const errorCode = utilities.parseInteger(error);

	if(!isNaN(errorCode)) {
		formattedError.code = errorCode;
	}

	const message = errorCodes[errorCode];

	if(utilities.isValid(message)) {
		formattedError.message = message;
	}
	else {
		formattedError.message = "Unknown error code: " + errorCode;
	}

	return formattedError;
}

function parseTime(value) {
	if(utilities.isEmptyString(value)) { return null; }

	const timeData = value.match(/^[ \t]*([0-9]{1,2}):?([0-5][0-9])[ \t]*$/);

	if(!timeData || timeData.length !== 3) { return null; }

	const hour = utilities.parseInteger(timeData[1]);

	if(isNaN(hour) || hour < 0) { return null; }

	const fixedHour = hour % 24;

	return utilities.parseTime((fixedHour < 10 ? "0" : "") + fixedHour + ":" + timeData[2]);
}

function parseTimeElapsed(timeElapsed) {
	const formattedTimeElapsed = utilities.parseFloatingPointNumber(timeElapsed);

	if(isNaN(formattedTimeElapsed)) { return NaN; }

	if(formattedTimeElapsed < 0) { return -1; }

	return Math.floor(formattedTimeElapsed * 60000);
}

function parseBusType(type, includeRaw) {
	if(utilities.isEmptyString(type)) {
		return null;
	}

	const formattedData = {
		bikeRack: !!type.match(/b/gi),
		lowFloorEasyAccess: !!type.match(/[^d][ela]{1,3}[^h]/gi),
		doubleDecker: !!type.match(/d{2}/gi),
		dieselElectricHybrid: !!type.match(/deh/gi),
		inviro: !!type.match(/in/gi),
		orion: !!type.match(/on/gi)
	};

	const lengthData = type.match(/([46])0?/);

	if(utilities.isNonEmptyArray(lengthData) && lengthData.length >= 2) {
		const value = utilities.parseInteger(lengthData[1]);

		if(value === 4) {
			formattedData.busLength = 40;
		}
		else if(value === 6) {
			formattedData.busLength = 60;
		}
		else {
			console.error("Unexpected bus length value: " + value + " - from type: \""  + type + "\".");
		}
	}

	if(formattedData.doubleDecker) {
		formattedData.type = "Double Decker";
	}
	else if(formattedData.dieselElectricHybrid) {
		formattedData.type = "Diesel Electric Hybrid";
	}
	else if(formattedData.inviro) {
		formattedData.type = "Inviro";
	}
	else if(formattedData.orion) {
		formattedData.type = "Orion";
	}
	else if(formattedData.busLength === 60) {
		formattedData.type = "Stretch";
	}
	else {
		formattedData.type = "Regular";
	}

	if(includeRaw) {
		formattedData.raw = type;
	}

	return formattedData;
}

transit.setup = function(options) {
	const formattedOptions = utilities.formatObject(
		options,
		{
			key: {
				type: "string",
				trim: true,
				nonEmpty: true,
				nullable: false,
				required: true
			},
			appID: {
				type: "string",
				trim: true,
				nonEmpty: true,
				nullable: false,
				required: true
			}
		},
		{
			throwErrors: true,
			removeExtra: true
		}
	);

	apiKey = formattedOptions.key;
	appID = formattedOptions.appID;
};

transit.getRouteDirectionIdentifiers = function(stop, routes, options, callback) {
	if(utilities.isFunction(options)) {
		callback = options;
		options = null;
	}

	if(!utilities.isFunction(callback)) {
		throw new Error("Missing or invalid callback function!");
	}

	if(!utilities.isObject(routes)) {
		return callback(new Error("Invalid routes parameter type - expected object or array."));
	}

	const formattedOptions = utilities.formatObject(
		options,
		{
			insert: {
				type: "boolean",
				default: true
			},
			overwrite: {
				type: "boolean",
				default: true
			}
		},
		true
	);

	return transit.getStopSummary(
		stop,
		function(error, stopSummary) {
			if(error) {
				return callback(error);
			}

			if(utilities.isEmptyArray(stopSummary.routes)) {
				return callback(new Error("Stop number " + stop + " has no routes."));
			}

			let routeList = null;
			let route = null;
			let routeSummary = null;
			let formattedDirectionName = null;
			let hasRoute = null;
			let hasRouteWithDirection = null;
			const results = [];

			if(Array.isArray(routes)) {
				routeList = routes;
			}
			else {
				routeList = [routes];
			}

			for(let i = 0; i < routeList.length; i++) {
				route = routeList[i];

				if(utilities.isEmptyObject(route)) {
					continue;
				}

				hasRoute = false;
				hasRouteWithDirection = false;

				if(!utilities.isObject(route.direction)) {
					return callback(new Error("Route has missing or invalid direction attribute - expected object."));
				}

				if(typeof route.direction.name !== "string") {
					return callback(new Error("Invalid direction name type: " + (typeof directionName) + " - expected string!"));
				}

				formattedDirectionName = route.direction.name.toLowerCase().trim();

				if(utilities.isEmptyString(formattedDirectionName)) {
					return callback(new Error("Direction name cannot be empty!"));
				}

				for(let j = 0; j < stopSummary.routes.length; j++) {
					routeSummary = stopSummary.routes[j];

					if(routeSummary.route === route.route) {
						hasRoute = true;

						if(routeSummary.direction.name.toLowerCase() === formattedDirectionName) {
							hasRouteWithDirection = true;

							if(formattedOptions.insert) {
								if(!utilities.isValid(route.direction.id) || (utilities.isValid(route.direction.id) && formattedOptions.overwrite)) {
									route.direction.id = routeSummary.direction.id;
								}
							}

							results.push(routeSummary.direction.id);

							break;
						}
					}
				}

				if(!hasRouteWithDirection) {
					let message = null;

					if(!hasRoute) {
						message = "Stop number " + stop + " has no route with number " + route + ".";
					}
					else {
						message = "Stop number " + stop + " has route with number " + route + ", but not direction " + route.direction.name + ".";
					}

					return callback(new Error(message));
				}
			}

			if(Array.isArray(routes)) {
				return callback(null, results);
			}

			return callback(null, results[0]);
		}
	);
};

transit.getStopSummary = function(stop, options, callback) {
	if(utilities.isFunction(options)) {
		callback = options;
		options = null;
	}

	if(!utilities.isFunction(callback)) {
		throw new Error("Missing or invalid callback function.");
	}

	if(utilities.isEmptyString(apiKey)) {
		return callback(new Error("Missing OC Transpo API key."));
	}

	if(utilities.isEmptyString(appID)) {
		return callback(new Error("Missing OC Transpo application identifier."));
	}

	if(!Number.isInteger(stop)) {
		return callback(new Error("Missing or invalid stop number: " + stop + " - expected integer."));
	}

	const formattedOptions = utilities.formatObject(
		options,
		{
			includeRaw: {
				type: "boolean",
				default: false
			}
		},
		true
	);

	return envelope.get(
		"GetRouteSummaryForStop",
		{
			apiKey: apiKey,
			appID: appID,
			format: "json",
			stopNo: stop
		},
		{
			baseUrl: apiAddress
		},
		function(error, result) {
			if(error) {
				return callback(error);
			}

			if(!utilities.isObject(result)) {
				return callback(new Error("Invalid server response for GetRouteSummaryForStop."));
			}

			const data = result.GetRouteSummaryForStopResult;

			if(utilities.isNonEmptyString(data.Error)) {
				const formattedError = formatError(data.Error);
				const error = new Error(formattedError.message);
				if(utilities.isValid(formattedError.code)) { error.code = formattedError.code; }
				return callback(error);
			}

			const formattedData = {
				stop: utilities.parseInteger(data.StopNo),
				description: changeCase.title(data.StopDescription)
			};

			let routes = null;
			let route = null;
			let formattedRoute = null;

			if(utilities.isValid(data.Routes)) {
				formattedData.routes = [];

				if(utilities.isValid(data.Routes.Route)) {
					if(utilities.isNonEmptyArray(data.Routes.Route)) {
						routes = data.Routes.Route;
					}
					else {
						routes = [data.Routes.Route];
					}
				}
				else if(utilities.isValid(data.Routes)) {
					if(utilities.isNonEmptyArray(data.Routes)) {
						routes = data.Routes;
					}
					else {
						routes = [data.Routes];
					}
				}

				for(let i = 0; i < routes.length; i++) {
					route = routes[i];

					if(utilities.isEmptyObject(route)) {
						continue;
					}

					formattedRoute = {
						route: utilities.parseInteger(route.RouteNo),
						direction: {
							id: utilities.parseInteger(route.DirectionID),
							name: route.Direction
						},
						heading: route.RouteHeading
					};

					formattedData.routes.push(formattedRoute);
				}
			}

			if(formattedOptions.includeRaw) {
				formattedData.raw = result;
			}

			return callback(null, formattedData);
		}
	);
};

transit.getRouteInformation = function(stop, route, options, callback) {
	if(utilities.isFunction(options)) {
		callback = options;
		options = null;
	}

	if(!utilities.isFunction(callback)) {
		throw new Error("Missing or invalid callback function.");
	}

	if(utilities.isEmptyString(apiKey)) {
		return callback(new Error("Missing OC Transpo API key."));
	}

	if(utilities.isEmptyString(appID)) {
		return callback(new Error("Missing OC Transpo application identifier."));
	}

	if(!Number.isInteger(stop)) {
		return callback(new Error("Missing or invalid stop number: " + stop + " - expected integer."));
	}

	if(!Number.isInteger(route)) {
		return callback(new Error("Missing or invalid route number: " + route + " - expected integer."));
	}

	const formattedOptions = utilities.formatObject(
		options,
		{
			includeRaw: {
				type: "boolean",
				default: false
			}
		},
		true
	);

	return envelope.get(
		"GetNextTripsForStop",
		{
			apiKey: apiKey,
			appID: appID,
			format: "json",
			stopNo: stop,
			routeNo: route
		},
		{
			baseUrl: apiAddress
		},
		function(error, result) {
			if(error) {
				return callback(error);
			}

			if(!utilities.isObject(result)) {
				return callback(new Error("Invalid server response for GetNextTripsForStop."));
			}

			const data = result.GetNextTripsForStopResult;

			if(utilities.isNonEmptyString(data.Error)) {
				const formattedError = formatError(data.Error);
				const error = new Error(formattedError.message);
				if(utilities.isValid(formattedError.code)) { error.code = formattedError.code; }
				return callback(error);
			}

			const formattedData = {
				stop: utilities.parseInteger(data.StopNo)
			};

			if(utilities.isValid(data.StopDescription)) {
				formattedData.description = changeCase.title(data.StopDescription);
			}

			if(utilities.isValid(data.StopLabel)) {
				formattedData.description = changeCase.title(data.StopLabel);
			}

			let routes = null;
			let route = null;
			let trips = null;
			let trip = null;
			let bus = null;
			let formattedRoute = null;
			let formattedTrip = null;

			if(utilities.isValid(data.Route)) {
				formattedData.routes = [];

				if(utilities.isValid(data.Route.RouteDirection)) {
					if(utilities.isNonEmptyArray(data.Route.RouteDirection)) {
						routes = data.Route.RouteDirection;
					}
					else {
						routes = [data.Route.RouteDirection];
					}
				}
				else {
					if(utilities.isNonEmptyArray(data.Route)) {
						routes = data.Route;
					}
					else {
						routes = [data.Route];
					}
				}
			}

			for(let i = 0; i < routes.length; i++) {
				route = routes[i];

				if(utilities.isEmptyObject(route)) {
					continue;
				}

				formattedRoute = {
					route: utilities.parseInteger(route.RouteNo),
					direction: {
						name: route.Direction
					}
				};

				if(utilities.isValid(route.RouteHeading)) {
					formattedRoute.heading = route.RouteHeading;
				}

				if(utilities.isValid(route.RouteLabel)) {
					formattedRoute.heading = route.RouteLabel;
				}

				if(utilities.isValid(route.DirectionID)) {
					formattedRoute.direction.id = utilities.parseInteger(route.DirectionID);
				}

				if(utilities.isValid(route.Trips)) {
					formattedRoute.trips = [];

					if(utilities.isValid(route.Trips.Trip)) {
						if(utilities.isNonEmptyArray(route.Trips.Trip)) {
							trips = route.Trips.Trip;
						}
						else {
							trips = [route.Trips.Trip];
						}
					}
					else if(utilities.isValid(route.Trips)) {
						if(utilities.isNonEmptyArray(route.Trips)) {
							trips = route.Trips;
						}
						else {
							trips = [route.Trips];
						}
					}

					for(let j = 0; j < trips.length; j++) {
						trip = trips[j];

						if(utilities.isEmptyObject(trip)) {
							continue;
						}

						formattedTrip = {
							destination: trip.TripDestination,
							arrivalTime: utilities.parseInteger(trip.AdjustedScheduleTime),
							lastUpdated: parseTimeElapsed(trip.AdjustmentAge),
							lastTrip: utilities.parseBoolean(trip.LastTripOfSchedule)
						};

						try {
							formattedTrip.startTime = parseTime(trip.TripStartTime);
						}
						catch(error) {
							console.error(error);
						}

						bus = parseBusType(trip.BusType, formattedOptions.includeRaw);

						if(utilities.isValid(bus)) {
							formattedTrip.bus = bus;
						}

						if(formattedTrip.lastUpdated >= 0) {
							formattedTrip.gps = {
								latitude: utilities.parseFloatingPointNumber(trip.Latitude),
								longitude: utilities.parseFloatingPointNumber(trip.Longitude),
								speed: utilities.parseFloatingPointNumber(trip.GPSSpeed)
							};
						}

						formattedRoute.trips.push(formattedTrip);
					}
				}

				formattedData.routes.push(formattedRoute);
			}

			if(formattedOptions.includeRaw) {
				formattedData.raw = result;
			}

			return transit.getRouteDirectionIdentifiers(
				formattedData.stop,
				formattedData.routes,
				function(error, directionIdentifiers) {
					if(error) {
						return callback(error);
					}

					return callback(null, formattedData);
				}
			);
		}
	);
};

transit.getStopInformation = function(stop, options, callback) {
	if(utilities.isFunction(options)) {
		callback = options;
		options = null;
	}

	if(!utilities.isFunction(callback)) {
		throw new Error("Missing or invalid callback function!");
	}

	if(utilities.isEmptyString(apiKey)) {
		return callback(new Error("Missing OC Transpo API key."));
	}

	if(utilities.isEmptyString(appID)) {
		return callback(new Error("Missing OC Transpo application identifier."));
	}

	if(!Number.isInteger(stop)) {
		return callback(new Error("Missing or invalid stop number: " + stop + " - expected integer."));
	}

	const formattedOptions = utilities.formatObject(
		options,
		{
			includeRaw: {
				type: "boolean",
				default: false
			}
		},
		true
	);

	return envelope.get(
		"GetNextTripsForStopAllRoutes",
		{
			apiKey: apiKey,
			appID: appID,
			format: "json",
			stopNo: stop
		},
		{
			baseUrl: apiAddress
		},
		function(error, result) {
			if(error) {
				return callback(error);
			}

			if(!utilities.isObject(result)) {
				return callback(new Error("Invalid server response for GetNextTripsForStopAllRoutes."));
			}

			const data = result.GetRouteSummaryForStopResult;

			if(utilities.isNonEmptyString(data.Error)) {
				const formattedError = formatError(data.Error);
				const error = new Error(formattedError.message);
				if(utilities.isValid(formattedError.code)) { error.code = formattedError.code; }
				return callback(error);
			}

			const formattedData = {
				stop: utilities.parseInteger(data.StopNo)
			};

			if(utilities.isValid(data.StopDescription)) {
				formattedData.description = changeCase.title(data.StopDescription);
			}

			if(utilities.isValid(data.StopLabel)) {
				formattedData.description = changeCase.title(data.StopLabel);
			}

			let routes = null;
			let route = null;
			let trips = null;
			let trip = null;
			let bus = null;
			let formattedRoute = null;
			let formattedTrip = null;

			if(utilities.isValid(data.Routes)) {
				formattedData.routes = [];

				if(utilities.isValid(data.Routes.Route)) {
					if(utilities.isNonEmptyArray(data.Routes.Route)) {
						routes = data.Routes.Route;
					}
					else {
						routes = [data.Routes.Route];
					}
				}
				else if(utilities.isValid(data.Routes)) {
					if(utilities.isNonEmptyArray(data.Routes)) {
						routes = data.Routes;
					}
					else {
						routes = [data.Routes];
					}
				}

				for(let i = 0; i < routes.length; i++) {
					route = routes[i];

					if(utilities.isEmptyObject(route)) {
						continue;
					}

					formattedRoute = {
						route: utilities.parseInteger(route.RouteNo),
						direction: {
							name: route.Direction
						}
					};

					if(utilities.isValid(route.RouteHeading)) {
						formattedRoute.heading = route.RouteHeading;
					}

					if(utilities.isValid(route.RouteLabel)) {
						formattedRoute.heading = route.RouteLabel;
					}

					if(utilities.isValid(route.DirectionID)) {
						formattedRoute.direction.id = utilities.parseInteger(route.DirectionID);
					}

					if(utilities.isValid(route.Trips)) {
						formattedRoute.trips = [];

						if(utilities.isValid(route.Trips.Trip)) {
							if(utilities.isNonEmptyArray(route.Trips.Trip)) {
								trips = route.Trips.Trip;
							}
							else {
								trips = [route.Trips.Trip];
							}
						}
						else if(utilities.isValid(route.Trips)) {
							if(utilities.isNonEmptyArray(route.Trips)) {
								trips = route.Trips;
							}
							else {
								trips = [route.Trips];
							}
						}

						for(let j = 0; j < trips.length; j++) {
							trip = trips[j];

							if(utilities.isEmptyObject(trip)) {
								continue;
							}

							formattedTrip = {
								destination: trip.TripDestination,
								arrivalTime: utilities.parseInteger(trip.AdjustedScheduleTime),
								lastUpdated: parseTimeElapsed(trip.AdjustmentAge),
								lastTrip: utilities.parseBoolean(trip.LastTripOfSchedule)
							};

							try {
								formattedTrip.startTime = parseTime(trip.TripStartTime);
							}
							catch(error) {
								console.error(error);
							}

							bus = parseBusType(trip.BusType, formattedOptions.includeRaw);

							if(utilities.isValid(bus)) {
								formattedTrip.bus = bus;
							}

							if(formattedTrip.lastUpdated >= 0) {
								formattedTrip.gps = {
									latitude: utilities.parseFloatingPointNumber(trip.Latitude),
									longitude: utilities.parseFloatingPointNumber(trip.Longitude),
									speed: utilities.parseFloatingPointNumber(trip.GPSSpeed)
								};
							}

							formattedRoute.trips.push(formattedTrip);
						}
					}

					formattedData.routes.push(formattedRoute);
				}
			}

			if(formattedOptions.includeRaw) {
				formattedData.raw = result;
			}

			return callback(null, formattedData);
		}
	);
};

module.exports = transit;
