app.factory('Settings', function($resource) {
	return {
		debounce: { // Only save entity details after this delay
			tags: 2 * 1000,
			user: 2 * 1000
		}
	};
});