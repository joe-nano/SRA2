app.controller('libraryOperation', function($scope, $rootScope, $filter, $location, $stateParams, $timeout, Libraries, Loader, References) {
	// Operations {{{
	// NOTE: Dont forget to also update app/routes if any of these change
	$scope.operations = [
		{
			id: 'view',
			title: 'View library',
			allowExisting: true,
			allowNew: false,
			allowNonOwner: true,
			urlExisting: '/libraries/:id',
			isTool: false,
		},
		{
			id: 'copy',
			title: 'Copy library',
			allowExisting: true,
			allowNew: false,
			allowNonOwner: true,
			urlExisting: '/libraries/:id/copy',
			isTool: false,
		},
		{
			id: 'import',
			title: 'Import references',
			allowExisting: true,
			allowNew: true,
			allowNonOwner: false,
			urlExisting: '/libraries/:id/import',
			isTool: true,
		},
		{
			id: 'export',
			title: 'Export references',
			allowExisting: true,
			allowNew: false,
			allowNonOwner: true,
			urlExisting: '/libraries/:id/export',
			isTool: false,
		},
		{
			id: 'dedupe',
			title: 'Deduplicate',
			allowExisting: true,
			allowNew: false,
			allowNonOwner: false,
			urlExisting: '/libraries/:id/dedupe',
			isTool: true,
		},
		{
			id: 'compare',
			title: 'Compare',
			allowExisting: true,
			allowNew: true,
			allowNonOwner: false,
			urlExisting: '/libraries/:id/compare',
			isTool: true,
		},
		{
			id: 'tags',
			title: 'Edit library tags',
			allowExisting: true,
			allowNew: false,
			allowNonOwner: false,
			urlExisting: '/libraries/:id/tags',
			isTool: true,
		},
		{
			id: 'share',
			title: 'Share library',
			allowExisting: true,
			allowNew: false,
			allowNonOwner: false,
			urlExisting: '/libraries/:id/share',
			isTool: true,
		},
		{
			id: 'request',
			title: 'Journal Request',
			allowExisting: true,
			allowNew: false,
			allowNonOwner: true,
			urlExisting: '/libraries/:id/request',
			isTool: true,
		},
		{
			id: 'fulltext',
			title: 'Find full texts',
			allowExisting: true,
			allowNew: false,
			allowNonOwner: false,
			urlExisting: '/libraries/:id/fulltext',
			isTool: false,
		},
		{
			id: 'collabmatrix',
			title: 'Generate a collaboration matrix',
			allowExisting: true,
			allowNew: false,
			allowNonOwner: true,
			urlExisting: '/libraries/:id/collabmatrix',
			isTool: false,
		},
		{
			id: 'word-freq',
			title: 'Collect word-frequency data',
			allowExisting: true,
			allowNew: true,
			allowNonOwner: true,
			urlExisting: '/libraries/:id/word-freq',
			isTool: true,
		},
		{
			id: 'clear',
			title: 'Clear the library',
			allowExisting: true,
			allowNew: false,
			allowNonOwner: false,
			urlExisting: '/libraries/:id/clear',
			isTool: false,
		},
		{
			id: 'delete',
			title: 'Delete the library',
			allowExisting: true,
			allowNew: false,
			allowNonOwner: false,
			urlExisting: '/libraries/:id/delete',
			isTool: false,
		}
	];
	$scope.operation = _.find($scope.operations, {id: 'view'});

	$scope.setOperation = function(value) {
		$scope.operation = value;
	};
	// }}}

	// Libraries {{{
	$scope.library = null;
	$scope.newLibrary = {name: moment().format("MMM Do YYYY, h:mma")};
	$scope.setLibrary = function(value) {
		$scope.library = value;
	};
	// }}}

	// .libraryAllowBlank {{{
	/**
	* Allow the libraryController to select a new library
	*/
	$scope.libraryAllowNew = false;
	$scope.$watch('operation', function() {
		$scope.libraryAllowNew = $scope.operation.allowNew;
	});
	// }}}

	// Filtering {{{
	$scope.filters = [
		{id: 'all', title: 'All references in library'}
	];
	$scope.filter = _.find($scope.filters, {id: 'all'});

	// Deal with reference bucket {{{
	var bucket = $scope.getReferenceBucket();
	if (bucket && bucket.length) {
		$scope.filters.push({
			id: 'selected',
			title: bucket.length + ' selected references',
			references: bucket
		});
		$rootScope.$broadcast('referenceBucket', null); // Clear bucket
		$scope.filter = _.find($scope.filters, {id: 'selected'});
	}
	// }}}

	$scope.setFilter = function(what) {
		$scope.filter = what;
	};
	// }}}

	// Formats {{{
	$scope.formats = null;
	$scope.format = null;
	Libraries.formats().$promise.then(function(data) {
		$scope.formats = data;
		var defaultLib = _.find($scope.formats, {id: 'endnotexml'});
		if (defaultLib) $scope.format = defaultLib;
	});

	$scope.setFormat = function(format) {
		$scope.format = format;
	};
	// }}}

	// Submission {{{
	$scope.error = null;
	$scope.submit = function() {
		$scope.error = null;
		if (!$scope.library) {
			$scope.error = 'You must select an existing library';
		} else if (!$scope.operation) {
			$scope.error = 'You must select an operation to perform';
		} else { // All is well
			$location.path($scope.operation.urlExisting.replace(':id', $scope.library._id));
		}
	};
	// }}}

	// Load state {{{
	if ($stateParams.id) Libraries.get({id: $stateParams.id}).$promise.then(function(data) {
		$scope.library = data;
		// Decorators {{{
		// .referenceCount {{{
		$scope.library.referenceCount = null;
		References.count({library: $scope.library._id}).$promise.then(function(countData) {
			$scope.library.referenceCount = countData.count;
		});
		// }}}
		// }}}

		// Update breadcrumbs
		$rootScope.$broadcast('setBreadcrumb', [
			{url: '/libraries', title: 'Libraries'},
			{url: '/libraries/' + $scope.library._id, title: $scope.library.title}
		]);
	});

	if ($stateParams.operation == 'import') {
		$scope.operation = _.find($scope.operations, {id: 'import'});
	} else if ($stateParams.operation == 'export') {
		$scope.operation = _.find($scope.operations, {id: 'export'});
		$scope.$watch('library', function() {
			if (!$scope.library || !$scope.library._id) return;
			$rootScope.$broadcast('setBreadcrumb', [
				{url: '/libraries', title: 'Libraries'},
				{url: '/libraries/' + $scope.library._id, title: $scope.library.title}
			]);
		}, true);
	} else if ($stateParams.operation) {
		$scope.operation = _.find($scope.operations, {id: $stateParams.operation});
	}
	// }}}

	// Importer {{{
	// Change imported library name to match selected file name
	$scope.$on('fileUploadChange', function(e, name) {
		$scope.newLibrary.name = name.replace(/\.(csv|txt|xml)$/, '');
	});

	$scope.error;
	$scope.checkFile = name => {
		if (!$scope.formats.some(f => name.toLowerCase().endsWith(f.ext))) {
			$scope.error = 'The file you have provided does not look like a supported library.';
		}
	};

	$scope.import = function() {
		$timeout(function() {
			$('form')
				.ajaxSubmit({
					url: '/api/libraries/import',
					type: 'POST',
					data: {
						library: $scope.library ? $scope.library._id : null,
					},
					dataType: 'json',
					forceSync: true,
					beforeSubmit: function() {
						$scope.$apply(function() {
							Loader
								.start()
								.title('Uploading library...')
								.text('Prepairing to upload file...');
						});
					},
					uploadProgress: function(event, position, total, percentComplete) {
						$scope.$apply(function() {
							if (percentComplete >= 100 || position >= total) {
								Loader
									.text('Processing library file...')
									.progress(100);
							} else {
								Loader
									.text($filter('filesize')(position) + ' / ' + $filter('filesize')(total) + ' uploaded')
									.progress(percentComplete);
							}
						});
					},
					complete: function(res) {
						Loader.finish();
						if (res.responseJSON && res.responseJSON.url) {
							window.location = res.responseJSON.url;
						} else {
							window.location = '/#/libraries';
						}
					},
				});
		});

		return false;
	};
	// }}}
});
