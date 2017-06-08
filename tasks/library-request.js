var _ = require('lodash');
var async = require('async-chainable');
var email = require('../lib/email');
var Libraries = require('../models/libraries');
var moment = require('moment');
var References = require('../models/references');
var sraExlibrisRequest = require('/home/mc/Papers/Projects/Node/sra-exlibris-request/index.js'); // FIXME: Wrong FS path

module.exports = function(finish, task) {
	async()
		// Sanity checks {{{
		.then(function(next) {
			if (!task.settings) return next('.settings object must be present for request');
			if (!task.settings.user) return next('.settings.user object must be present for request');
			if (!task.settings.user.email) return next('.settings.user object must be have an email');
			if (!task.settings.user.email.endsWith('bond.edu.au')) return next('Email address must end with "bond.edu.au"');
			next();
		})
		// }}}

		// Retrieve data {{{
		.parallel({
			library: function(next) {
				Libraries.find({_id: task.library}, next);
			},
			references: function(next) {
				References.find({
					_id: {"$in": task.references},
				}, next);
			},
			historyTask: function(next) {
				task.progress.current = 0;
				task.progress.max = task.references.length;
				task.history.push({type: 'status', response: 'Going to request ' + task.references.length + ' references'});
				next();
			},
			requester: function(next) {
				next(null, new sraExlibrisRequest()
					.set(config.request.exlibrisSettings)
					.set('user.email', task.settings.user.email)
				);
			},
		})
		// }}}

		// Final sanity checks {{{
		.then(function(next) {
			if (!config.library.request.maxReferences) return next();
			if (this.references.length > config.library.request.maxReferences) return next('Refusing to submit ' + this.references.length + ' journal requests. ' + config.library.request.maxReferences + ' is the maximum allowed.');
			next();
		})
		// }}}

		// Send requests {{{
		.forEach('references', function(nextRef, ref) {
			this.requester.request(ref, function(err, res) {
				if (err) {
					task.history.push({type: 'error', response: err.toString()});
				} else {
					task.history.push({type: 'response', response: this.response});
				}
				task.progress.current++;
				task.save(nextRef); // Ignore individual errors
			});
		})
		// }}}

		// Finish {{{
		.then(function(next) { // Finalize task data
			task.history.push({type: 'completed', response: 'Completed request operation'});
			task.completed = new Date();
			task.status = 'completed';
			task.save(next);
		})
		.end(finish);
		// }}}
};
