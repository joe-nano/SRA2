global.config = require('../config');
var _ = require('lodash').mixin(require('lodash-keyarrange'));
var async = require('async-chainable');
var expect = require('chai').expect;
var fs = require('fs');
var mlog = require('mocha-logger');
var moment = require('moment');
var reflib = require('reflib');
var request = require('superagent');

describe('Task: screener-reweight', function(){
	// Library specific info
	var libraryFile = __dirname + '/data/endnote-2.xml';
	var libraryCount = 5;

	var refs = [];
	var agent = request.agent();

	// Upload library {{{
	it('should read the EndNote file', function(finish) {
		this.timeout(30 * 1000);
		reflib.parseFile(libraryFile)
			.on('error', finish)
			.on('ref', function(ref) {
				refs.push(ref);
			})
			.on('end', function(count) {
				expect(count).to.equal(libraryCount);
				finish();
			});
	});

	it('should login', function(finish) {
		agent.post(config.url + '/api/users/login')
			.send({username: 'mc', password: 'qwaszx'})
			.end(function(err, res) {
				if (err) return finish(err);
				expect(err).to.be.not.ok;
				expect(res.body).to.have.property('_id');
				expect(res.body).to.have.property('username');
				finish();
			});
	});

	var library;
	it('should upload a test library', function(finish) {
		this.timeout(60 * 1000);
		agent.post(config.url + '/api/libraries/import')
			.field('libraryTitle', 'TEST: screener-reweight')
			.field('libraryExpires', '3 hours')
			.field('json', 'true')
			.attach('file', libraryFile)
			.end(function(err, res) {
				if (err) return finish(err);
				library = res.body;
				expect(err).to.be.not.ok;
				expect(library).to.have.property('_id');
				expect(library).to.have.property('title');
				expect(library).to.have.property('url');
				mlog.log('Library URL:', library.url);
				finish();
			});
	});
	// }}}

	// Add weightings {{{
	it('should add some keywords to the library', function(finish) {
		this.timeout(10 * 1000);
		agent.post(config.url + '/api/libraries/' + library._id)
			.send({
				screening: {
					weightings: [
						{keyword: 'autopsy', weight: 1},
						{keyword: 'lesions', weight: 2},
						{keyword: 'breast', weight: 1},
						{keyword: 'examination', weight: 1},
						{keyword: 'copenhagen', weight: -2},
					],
				},
			})
			.end(function(err, res) {
				if (err) return finish(err);
				expect(err).to.be.not.ok;
				expect(res.body).to.have.property('_id');
				expect(res.body).to.have.property('screening');
				expect(res.body.screening).to.have.property('weightings');
				expect(res.body.screening.weightings).to.have.length(5);
				finish();
			});
	});
	// }}}

	// Queue up task {{{
	var task;
	it('should queue up the reweighting task', function(finish) {
		this.timeout(60 * 1000);
		agent.post(config.url + '/api/tasks/library/' + library._id + '/screener-reweight')
			.send({settings: {debug: true}})
			.end(function(err, res) {
				if (err) return finish(err);
				task = res.body;
				expect(err).to.be.not.ok;
				expect(task).to.have.property('_id');
				finish();
			});
	});

	it('should keep checking until the reweighting task is complete', function(finish) {
		var pollInterval = 3 * 1000;
		this.timeout(5 * 60 * 1000);
		var checkTask = function() {
			agent.get(config.url + '/api/tasks/' + task._id)
				.end(function(err, res) {
					if (err) {
						checkTaskComplete(err, res);
					} else {
						var progress = res.body.progress;
						mlog.log('[' + moment().format('HH:mm:ss') + '] Task still pending' + (progress.current ? (' ' + progress.current + ' / ' + progress.max + ' ~ ' + Math.ceil(progress.current / progress.max * 100).toString() + '%') : ''));
						if (res.body.status == 'completed') {
							checkTaskComplete(err, res);
						} else {
							setTimeout(checkTask, pollInterval);
						}
					}
				});
		};
		setTimeout(checkTask, pollInterval);

		var checkTaskComplete = function(err, res) {
			expect(err).to.be.not.ok;
			expect(res.body).to.have.property('_id');
			expect(res.body).to.have.property('status', 'completed');
			task = res.body;
			finish();
		};
	});
	// }}}

	// Retrieve + check references {{{
	var refs;
	it('should provide the weighted reference library', function(finish) {
		this.timeout(60 * 1000);
		agent.get(config.url + '/api/references')
			.query({
				library: library._id,
				select: '-created,-edited,-library,-status,-tags,-duplicateData',
			})
			.end(function(err, res) {
				if (err) return finish(err);
				expect(err).to.be.not.ok;
				refs = res.body;
				expect(refs).to.be.an('array');
				expect(refs).to.have.length(libraryCount);
				finish();
			});
	});

	it('should have weighted the references', function(finish) {
		refs.forEach(function(ref) {
			expect(ref).to.have.property('screening');
			expect(ref.screening).to.have.property('hash');
			expect(ref.screening).to.have.property('weight');
			expect(ref.screening.weight).to.have.a('number');
		});
		finish();
	});
	// }}}
});
