var _ = require('lodash');
var path = require('path');
var fs = require('fs');

// Determine 'ENV' {{{
var env = 'dev';
if (process.env.VCAP_SERVICES) {
	env = 'appfog';
} else if (process.env.OPENSHIFT_NODEJS_IP) {
	env = 'openshift';
} else if (process.env.MONGOLAB_URI) {
	env = 'heroku';
} else if (process.env.NODE_ENV) { // Inherit from NODE_ENV
	env = process.env.NODE_ENV;
}
// }}}

var defaults = {
	name: 'crebp-sra', // NPM compatible name
	title: 'CREBP-SRA',
	env: env,
	root: path.normalize(__dirname + '/..'),
	host: null, // Listen to all host requests
	port: process.env.PORT || 80,
	url: 'http://localhost',
	secret: "dT2CsWwmEBPnggihyKlY3IXONBIY4Db/yt5y1qcRHXkylDxHfEPGAsPkG1ikpFMgPnE9TrghA4hXSmuf8DvrdwtXZHY4Zmg8VVFs9Ei2NRK3N",
	gulp: {
		debugJS: true,
		minifyJS: false,
		debugCSS: true,
		minifyCSS: false,
	},
	mongo: {
		uri: 'mongodb://localhost/sra',
		options: {
			db: {
				safe: true
			}
		}
	},
	newrelic: {
		enabled: true,
		name: 'CREBP-SRA',
		license: 'c71e85e2d852cb4962d8b47dcad90de117501a07',
	},
	limits: {
		references: 100, // How many references to hold in memory at once during operations such as export, dedupe etc.
		dedupeOuter: 10, // How many comparison threads to allow at once (ref1)
		dedupeInner: 10, // How many comparison threads to allow against dedupeOuter (total is dedupeOuter * dedupeInner)
	},
	library: {
		request: {
			email: {
				to: 'matt@mfdc.biz',
				cc: undefined,
				bcc: 'matt_carter@bond.edu.au',
			},
			timeout: 30 * 1000,
		},
	},
	cron: {
		enabled: true,
		queryLimit: 10, // How many tasks to work on in one cron cycle
		waitTime: 3 * 1000,
	},
	search: {
		pubmed: {
			timeout: 20 * 1000,
			resultsLimit: 50, // How many result ID's to ask for per search query
			idLimit: 10, // How many paper ID's to fetch at once per search query
		},
	},
};

module.exports = _.merge(
	// Adopt defaults...
	defaults,

	// Which are overriden by private.js if its present
	fs.existsSync(__dirname + '/private.js') ? require(__dirname + '/private.js') : {},

	// Whish are overriden by the NODE_ENV.js file if its present
	fs.existsSync(__dirname + '/' + defaults.env + '.js') ? require(__dirname + '/' + defaults.env + '.js') : {}
);
