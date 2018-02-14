var changeCase = require("change-case");
var utilities = require("extra-utilities");
var envelope = require("node-envelope");

var transit = { };

transit.apiAddress = "http://api.octranspo1.com/v1.2";

transit.errorCodes = {
	1: "Invalid API key",
	2: "Unable to query data source",
	10: "Invalid stop number",
	11: "Invalid route number",
	12: "Stop does not service route"
};

transit.timeRegExpString = "([0-9]{1,2}):?([0-5][0-9])";
transit.timeRegExp = new RegExp("^[ \t]*" + transit.timeRegExpString + "[ \t]*$");
transit.bikeRackRegExp = /b/gi;
transit.lengthRegExpString = "([46])0?";
transit.lengthRegExp = new RegExp(transit.lengthRegExpString);
transit.doubleDeckerRegExp = /d{2}/gi;
transit.dieselElectricHybridRegExp = /deh/gi;
transit.inviroRegExp = /in/gi;
transit.orionRegExp = /on/gi;
transit.lowFloorEasyAccessRegExp = /[^d][ela]{1,3}[^h]/gi;

transit.formatError = function(error) {
	var formattedError = { };

	var errorCode = utilities.parseInteger(error);

	if(!isNaN(errorCode)) {
		formattedError.code = errorCode;
	}

	var message = transit.errorCodes[errorCode];

	if(utilities.isValid(message)) {
		formattedError.message = message;
	}
	else {
		formattedError.message = "Unknown error code: " + errorCode;
	}

	return formattedError;
};

transit.parseTime = function(time) {
	if(utilities.isEmptyString(time)) { return null; }

	var timeData = time.match(transit.timeRegExp);

	if(!timeData || timeData.length !== 3) { return null; }

	var hour = utilities.parseInteger(timeData[1]);

	if(isNaN(hour) || hour < 0) { return null; }

	var fixedHour = hour % 24;

	return utilities.parseTime((fixedHour < 10 ? "0" : "") + fixedHour + ":" + timeData[2]);
};

transit.parseTimeElapsed = function(timeElapsed) {
	var formattedTimeElapsed = utilities.parseFloatingPointNumber(timeElapsed);

	if(isNaN(formattedTimeElapsed)) { return NaN; }

	if(formattedTimeElapsed < 0) { return -1; }

	return Math.floor(formattedTimeElapsed * 60000);
};

transit.parseBusType = function(type, includeRaw) {
	if(utilities.isEmptyString(type)) {
		return null;
	}

	var formattedData = {
		bikeRack: !!type.match(transit.bikeRackRegExp),
		lowFloorEasyAccess: !!type.match(transit.lowFloorEasyAccessRegExp),
		doubleDecker: !!type.match(transit.doubleDeckerRegExp),
		dieselElectricHybrid: !!type.match(transit.dieselElectricHybridRegExp),
		inviro: !!type.match(transit.inviroRegExp),
		orion: !!type.match(transit.orionRegExp)
	};

	var lengthData = type.match(transit.lengthRegExp);

	if(utilities.isNonEmptyArray(lengthData) && lengthData.length >= 2) {
		var value = utilities.parseInteger(lengthData[1]);

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
};

transit.setup = function(options) {
	var formattedOptions = utilities.formatObject(
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

	transit.key = formattedOptions.key;
	transit.appID = formattedOptions.appID;
};

transit.getRouteDirectionIdentifiers = function(stop, routes, options, callback) {
	if(utilities.isFunction(options)) {
		callback = options;
		options = null;
	}

	if(!utilities.isFunction(callback)) {
		throw new Error("Missing or invalid callback function!");
	}

	if(routes === null || typeof routes !== "object") {
		var error = new Error("Invalid routes parameter type - expected object or array.");
		error.status = 400;
		return callback(error);
	}

	var formattedOptions = utilities.formatObject(
		options,
		{
			insert: {
				type: "boolean",
				default: true
			},
			overwrite: {
				type: "boolean",
				default: true
			},
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
				var error = new Error("Stop number " + stop + " has no routes.");
				error.status = 400;
				return callback(error);
			}

			var routeList = null;
			var route = null;
			var routeSummary = null;
			var formattedDirectionName = null;
			var hasRoute = null;
			var hasRouteWithDirection = null;
			var results = [];

			if(Array.isArray(routes)) {
				routeList = routes;
			}
			else {
				routeList = [routes];
			}

			for(var i=0;i<routeList.length;i++) {
				route = routeList[i];

				if(utilities.isEmptyObject(route)) {
					continue;
				}

				hasRoute = false;
				hasRouteWithDirection = false;

				if(route.direction === null || typeof route.direction !== "object") {
					var error = new Error("Route has missing or invalid direction attribute - expected object.");
					error.status = 400;
					return callback(null, error);
				}

				if(typeof route.direction.name !== "string") {
					var error = new Error("Invalid direction name type: " + (typeof directionName) + " - expected string!");
					error.status = 400;
					return callback(null, error);
				}

				formattedDirectionName = route.direction.name.toLowerCase().trim();

				if(utilities.isEmptyString(formattedDirectionName)) {
					var error = new Error("Direction name cannot be empty!");
					error.status = 400;
					return callback(null, error);
				}

				for(var j=0;j<stopSummary.routes.length;j++) {
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
					var message = null;

					if(!hasRoute) {
						message = "Stop number " + stop + " has no route with number " + route + ".";
					}
					else {
						message = "Stop number " + stop + " has route with number " + route + ", but not direction " + route.direction.name + ".";
					}

					var error = new Error(message);
					error.status = 400;
					return callback(error);
				}
			}

			if(Array.isArray(routes)) {
				return callback(null, results);
			}
			else {
				return callback(null, results[0]);
			}
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

	if(utilities.isEmptyString(transit.key)) {
		return callback(new Error("Missing OC Transpo API key."));
	}

	if(utilities.isEmptyString(transit.appID)) {
		return callback(new Error("Missing OC Transpo application identifier."));
	}

	if(!Number.isInteger(stop)) {
		var error = new Error("Missing or invalid stop number: " + stop + " - expected integer.");
		error.status = 400;
		return callback(error);
	}

	var formattedOptions = utilities.formatObject(
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
			apiKey: transit.key,
			appID: transit.appID,
			format: "json",
			stopNo: stop
		},
		{
			baseUrl: transit.apiAddress
		},
		function(error, result) {
			if(error) {
				return callback(error);
			}

			if(!utilities.isObject(result)) {
				return callback(new Error("Invalid server response for GetRouteSummaryForStop."));
			}

			var data = result.GetRouteSummaryForStopResult;

			if(utilities.isNonEmptyString(data.Error)) {
				var formattedError = transit.formatError(data.Error);
				var error = new Error(formattedError.message);
				if(utilities.isValid(formattedError.code)) { error.code = formattedError.code; }
				error.status = 400;
				return callback(error);
			}

			var formattedData = {
				stop: utilities.parseInteger(data.StopNo),
				description: changeCase.title(data.StopDescription)
			};

			var value = null;
			var routes = null;
			var route = null;
			var trips = null;
			var trip = null;
			var bus = null;
			var formattedRoute = null;
			var formattedTrip = null;

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

				for(var i=0;i<routes.length;i++) {
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

	if(utilities.isEmptyString(transit.key)) {
		return callback(new Error("Missing OC Transpo API key."));
	}

	if(utilities.isEmptyString(transit.appID)) {
		return callback(new Error("Missing OC Transpo application identifier."));
	}

	if(!Number.isInteger(stop)) {
		var error = new Error("Missing or invalid stop number: " + stop + " - expected integer.");
		error.status = 400;
		return callback(error);
	}

	if(!Number.isInteger(route)) {
		var error = new Error("Missing or invalid route number: " + route + " - expected integer.");
		error.status = 400;
		return callback(error);
	}

	var formattedOptions = utilities.formatObject(
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
			apiKey: transit.key,
			appID: transit.appID,
			format: "json",
			stopNo: stop,
			routeNo: route
		},
		{
			baseUrl: transit.apiAddress
		},
		function(error, result) {
			if(error) {
				return callback(error);
			}

			if(!utilities.isObject(result)) {
				return callback(new Error("Invalid server response for GetNextTripsForStop."));
			}

			var data = result.GetNextTripsForStopResult;

			if(utilities.isNonEmptyString(data.Error)) {
				var formattedError = transit.formatError(data.Error);
				var error = new Error(formattedError.message);
				if(utilities.isValid(formattedError.code)) { error.code = formattedError.code; }
				error.status = 400;
				return callback(error);
			}

			var formattedData = {
				stop: utilities.parseInteger(data.StopNo)
			};

			if(utilities.isValid(data.StopDescription)) {
				formattedData.description = changeCase.title(data.StopDescription);
			}

			if(utilities.isValid(data.StopLabel)) {
				formattedData.description = changeCase.title(data.StopLabel);
			}

			var routes = null;
			var route = null;
			var trips = null;
			var trip = null;
			var bus = null;
			var formattedRoute = null;
			var formattedTrip = null;

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

			for(var i=0;i<routes.length;i++) {
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

					for(var j=0;j<trips.length;j++) {
						trip = trips[j];

						if(utilities.isEmptyObject(trip)) {
							continue;
						}

						formattedTrip = {
							destination: trip.TripDestination,
							arrivalTime: utilities.parseInteger(trip.AdjustedScheduleTime),
							lastUpdated: transit.parseTimeElapsed(trip.AdjustmentAge),
							lastTrip: utilities.parseBoolean(trip.LastTripOfSchedule)
						};

						try {
							formattedTrip.startTime = transit.parseTime(trip.TripStartTime);
						}
						catch(error) {
							console.error(error);
						}

						bus = transit.parseBusType(trip.BusType, formattedOptions.includeRaw);

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

			transit.getRouteDirectionIdentifiers(
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

	if(utilities.isEmptyString(transit.key)) {
		return callback(new Error("Missing OC Transpo API key."));
	}

	if(utilities.isEmptyString(transit.appID)) {
		return callback(new Error("Missing OC Transpo application identifier."));
	}

	if(!Number.isInteger(stop)) {
		var error = new Error("Missing or invalid stop number: " + stop + " - expected integer.");
		error.status = 400;
		return callback(error);
	}

	var formattedOptions = utilities.formatObject(
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
			apiKey: transit.key,
			appID: transit.appID,
			format: "json",
			stopNo: stop
		},
		{
			baseUrl: transit.apiAddress
		},
		function(error, result) {
			if(error) {
				return callback(error);
			}

			if(!utilities.isObject(result)) {
				return callback(new Error("Invalid server response for GetNextTripsForStopAllRoutes."));
			}

			var data = result.GetRouteSummaryForStopResult;

			if(utilities.isNonEmptyString(data.Error)) {
				var formattedError = transit.formatError(data.Error);
				var error = new Error(formattedError.message);
				if(utilities.isValid(formattedError.code)) { error.code = formattedError.code; }
				error.status = 400;
				return callback(error);
			}

			var formattedData = {
				stop: utilities.parseInteger(data.StopNo)
			};

			if(utilities.isValid(data.StopDescription)) {
				formattedData.description = changeCase.title(data.StopDescription);
			}

			if(utilities.isValid(data.StopLabel)) {
				formattedData.description = changeCase.title(data.StopLabel);
			}

			var value = null;
			var routes = null;
			var route = null;
			var trips = null;
			var trip = null;
			var bus = null;
			var formattedRoute = null;
			var formattedTrip = null;

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

				for(var i=0;i<routes.length;i++) {
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

						for(var j=0;j<trips.length;j++) {
							trip = trips[j];

							if(utilities.isEmptyObject(trip)) {
								continue;
							}

							formattedTrip = {
								destination: trip.TripDestination,
								arrivalTime: utilities.parseInteger(trip.AdjustedScheduleTime),
								lastUpdated: transit.parseTimeElapsed(trip.AdjustmentAge),
								lastTrip: utilities.parseBoolean(trip.LastTripOfSchedule)
							};

							try {
								formattedTrip.startTime = transit.parseTime(trip.TripStartTime);
							}
							catch(error) {
								console.error(error);
							}

							bus = transit.parseBusType(trip.BusType, formattedOptions.includeRaw);

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
