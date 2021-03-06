var name = 'tasks';
var schema = new mongoose.Schema({
	id: mongoose.Schema.ObjectId,
	created: {type: Date, default: Date.now},
	creator: {type: mongoose.Schema.ObjectId, ref: 'users'},
	touched: {type: Date, default: Date.now},
	worker: {type: String, index: true},
	completed: {type: Date},
	destination: {type: String},
	status: {type: String, enum: ['pending', 'processing', 'error', 'completed'], default: 'pending', index: true},
	progress: {
		current: {type: Number, default: 0},
		max: {type: Number},
	},
	history: [{
		type: {type: String}, // queued, completed, error, status, response
		created: {type: Date, default: Date.now},
		response: {type: String},
	}],
	library: {type: mongoose.Schema.ObjectId, ref: 'libraries'},
	references: [{type: mongoose.Schema.ObjectId, ref: 'references'}],
	settings: {type: mongoose.Schema.Types.Mixed},
	result: {type: mongoose.Schema.Types.Mixed},
}, {
	usePushEach: true,
});

module.exports = mongoose.model(name, schema);
