var monoxide = require('monoxide');

module.exports = monoxide.schema('references', {
	library: {type: 'pointer', ref: 'libraries', indexed: true},
	created: {type: Date, default: Date.now},
	edited: {type: Date, default: Date.now},
	tags: [{type: 'pointer', ref: 'referenceTags', indexed: true}],
	type: {type: String, default: 'report'},
	title: {type: String},
	journal: {type: String},
	authors: [{type: String}],
	date: {type: String},
	pages: {type: String},
	volume: {type: String},
	number: {type: String},
	isbn: {type: String},
	label: {type: String},
	caption: {type: String},
	address: {type: String},
	urls: [{type: String}],
	abstract: {type: String},
	notes: {type: String},
	researchNotes: {type: String},
	status: {type: String, enum: ['active', 'deleted', 'dupe'], default: 'active', indexed: true},
	fullTextURL: {type: String},
	screening: {
		hash: {type: String},
		weight: {type: Number},
	},
	parentage: { // see libraries model for a description of this structure
		parent: {type: 'pointer', ref: 'references', index: true},
		fingerPrint: {type: String},
	},
	duplicateData: [{
		reference: {type: 'pointer', ref: 'references'},
		conflicting: {type: 'object', default: {}},
	}],
});
