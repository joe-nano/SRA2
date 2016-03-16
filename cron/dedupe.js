/**
* Deduplicate worker
* Performs a map-reduce operation on all specified references awarding a similarity score for each
*/
var _ = require('lodash');
var async = require('async-chainable');
var colors = require('colors');
var compareNames = require('compare-names');
var natural = require('natural');
var Libraries = require('../models/libraries');
var References = require('../models/references');

// Utility functions {{{
// Cache various regular expressions so they are faster
var reAlphaNumeric = /[^a-z0-9]+/g;
var reJunkWords = /\b(the|a)\b/g;
var reLooksNumeric = /^[^0-9\.\-]+$/;
var reOnlyNumeric = /[^0-9]+/g;

function compareRef(ref1, ref2) {
	// Stage 1 - Basic sanity checks - do not match if year, page, volume, isbn or number is present BUT mismatch exactly {{{
	// Since these fields are usually numeric its fairly likely that if these dont match its not a duplicate
	if (['year', 'pages', 'volume', 'number', 'isbn'].some(function(f) {
		if (ref1[f] && ref2[f]) { // Both refs possess the comparitor
			if (!reLooksNumeric.test(ref1[f]) || !reLooksNumeric.test(ref2[f])) return false;
			// Strip all non-numerics out {{{
			var cf1 = ref1[f].replace(reOnlyNumeric, '');
			if (!cf1) return; // Skip out if nothing is left anyway
			var cf2 = ref2[f].replace(reOnlyNumeric, '');
			if (!cf2) return;
			// }}}
			return (cf1 != cf2);
		}
	})) return false;
	// }}}

	/*
	if (
		natural.JaroWinklerDistance(ref1.title, ref2.title) >= config.tasks.dedupe.stringDistance.jaroWinklerMin &&
		natural.LevenshteinDistance(ref1.title, ref2.title) <= config.tasks.dedupe.stringDistance.levenshteinMax
	) {
		console.log('---');
		console.log('1', ref1.title);
		console.log('2', ref2.title);
		console.log('JWD', colors.cyan(natural.JaroWinklerDistance(ref1.title, ref2.title)));
		console.log('Lev', colors.cyan(natural.LevenshteinDistance(ref1.title, ref2.title)));
		console.log('---');
	}
	*/

	// Stage 2 - Comparison of title + authors {{{
	return (
		(
			ref1.title == ref2.title ||
			(
				natural.JaroWinklerDistance(ref1.title, ref2.title) >= config.tasks.dedupe.stringDistance.jaroWinklerMin &&
				natural.LevenshteinDistance(ref1.title, ref2.title) <= config.tasks.dedupe.stringDistance.levenshteinMax
			)
		) &&
		compareNames(ref1.authors, ref2.authors)
	);
	// }}}
}
// }}}


module.exports = function(finish, task) {
	var references = [];
	var scanned = 0;
	var comparisons = 0;
	var dupesFound = 0;

	async()
		// Retrieve data {{{
		.parallel({
			library: function(next) {
				Libraries.findOne({_id: task.library}, next);
			},
			references: function(next) {
				References.find({
					_id: {"$in": task.references},
				}, function(err, refs) {
					if (err) return next(err);
					refs.forEach(ref => references.push(ref)); // Push to references so the pointer doesnt break
					next(null, references);
				});
			},
		})
		// }}}

		// Setup {{{
		.parallel([
			function(next) { // Setup task data
				task.progress.current = 0;
				task.progress.max = references.length;
				task.history.push({type: 'status', response: 'Going to examine ' + references.length + ' references'});
				task.save(next);
			},
			function(next) { // Setup library state
				this.library.dedupeStatus = 'processing';
				this.library.save(next);
			},
		])
		// }}}

		// Clear existing duplicate data (if any) {{{
		.limit(1)
		.forEach(references, function(next, ref) {
			if (ref.status == 'dupe') ref.status = 'active';
			if (ref.duplicateData.length) ref.duplicateData = [];
			if (!ref.isModified()) return next(); // Nothing to do
			ref.save(next);
		})
		// }}}

		// Dedupe worker {{{
		.limit(config.tasks.dedupe.limit)
		.forEach(references, function(nextRef, ref1, ref1Offset) { // Compare each reference...
			scanned++;

			references
				.slice(ref1Offset+1)
				.forEach(function(ref2, ref2Offset) {
					// console.log('COMPARE', ref1._id, ref1Offset, 'AGAINST', ref2._id, ref2Offset);
					comparisons++;
					if (!compareRef(ref1, ref2)) return; // Is not a dupe - ignore
					dupesFound++;
					// Merge conflicting keys {{{
					// For each key in either ref1 or ref2...
					var conflicting = {};
					_(_.keys(ref1.toObject()).concat(_.keys(ref2.toObject())))
						.filter(function(key) {
							// Don't try to merge if the key is...
							return ! (
								_.startsWith(key, '_') ||
								key == 'duplicateData' ||
								key == 'created' ||
								key == 'edited' ||
								key == 'library' ||
								key == 'status' ||
								key == 'tags'
							);
						})
						.uniq()
						.forEach(function(key) {
							if (ref1[key] && !ref2[key]) { // Ref1 has the key ref2 does not
								// Pass
							} else if (!ref1[key] && ref2[key]) { // Ref 1 does not have the key ref2 does
								ref1[key] = ref2[key];
							} else if (!_.isEqual(ref1[key], ref2[key])) { // Both have the key and it conflicts
								conflicting[key] = ref2[key];
							}
						});
					ref1.duplicateData.push({reference: ref2._id, conflicting: conflicting});
					ref2.status = 'dupe';
					// }}}
				});

			task.progress.current++;
			task.save(nextRef);
			console.log(colors.blue('DEDUPE'), 'Lib:', colors.cyan(this.library._id), '@', task.progress.current + '/' + references.length + ' = ' + colors.cyan(Math.ceil((task.progress.current / references.length) * 100) + '%'), 'deduped with', colors.cyan(dupesFound), 'dupes found');
		})
		// }}}

		// Save everything {{{
		.limit(1)
		.forEach(references, function(next, ref) {
			if (!ref.isModified() && !ref.duplicateData.length) return next(); // Nothing to do

			if (ref.duplicateData.length) { // This ref is the master for a few dupes
				var originalFields = {};

				ref.duplicateData.forEach(dup => { // Scan each duplicate
					_.keys(dup.conflicting).forEach(k => originalFields[k] = ref[k]); // Copy the original into storage
				});

				// Make sure that it is the first item in the duplicateData list
				ref.duplicateData.unshift({
					reference: ref._id,
					conflicting: originalFields,
				});
			}
			ref.save(next);
		})
		// }}}

		// Finish {{{
		.parallel([
			function(next) { // Finalize task data
				task.destination = config.url + '/#/libraries/' + this.library._id + '/dedupe/review';
				task.completed = new Date();
				task.status = 'completed';
				task.history.push({type: 'completed', response: 'Completed dedupe. Scanned ' + scanned + ' with ' + comparisons + ' comparisons. Which found ' + dupesFound + ' dupes'});
				task.save(next);
			},

			function(next) { // Finalize library state
				this.library.dedupeStatus = 'review';
				this.library.save(next);
			},
		])
		.end(finish);
		// }}}
};
