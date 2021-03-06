// NOTE: This controller requires that its nested as the child of libraryController
app.controller('libraryScreenController', function($scope, $location, $rootScope) {
	$scope.ref = null;
	$scope.refNo = null;
	$scope.options = {
		show: {
			title: true,
			abstract: true,
			fulltext: false,
			keywords: true,
		},
	};

	// Keyword highlighting {{{
	$scope.highlightWrapper = '<span class="label label-info">{{item.text}}</span>';
	$scope.highlightTags = ['h1', 'p', 'div'];
	$scope.highlightTerms = null;
	$scope.$watch('library.screening.weightings', function() {
		if (!$scope.library || !$scope.library.screening || !$scope.library.screening.weightings) return;
		$scope.highlightTerms = $scope.library.screening.weightings.map(function(weighting) {
			return weighting.keyword;
		});
	});
	// }}}

	// Text selection {{{
	$scope.selectedText = null;
	$scope.$on('selectedText', function(e, text) {
		$scope.selectedText = text;
	});
	// }}}

	// Modals {{{
	$scope.showConfig = function() {
		angular.element('#modal-screening-options')
			.modal('show')
			.one('hide.bs.modal', function() {
				$scope.$parent.save('screening');
			});
	};

	$scope.newWeighting = {keyword: '', weight: 1};

	$scope.addWeighting = function(obj) {
		$scope.library.screening.weightings.push(_.clone(obj || $scope.newWeighting));
		$scope.newWeighting.keyword = '';
		$scope.$parent.save('screening');
		$('#dropdown-text-select').hide(); // Close the dropdown menu if its open
	};
	// }}}

	// Reference moving {{{
	$scope.moveFirst = function() {
		if ($scope.references.length == 0) $location.path('/libraries/' + $scope.library._id);
		$scope.ref = $scope.references[0];
		$scope.refNo = 1;
	};

	$scope.movePrev = function() {
		var offset = $scope.ref ? _.findKey($scope.references, {_id: $scope.ref._id})-1 : 0;
		if (offset < 0) offset = 0;
		$scope.ref = $scope.references[offset];
		$scope.refNo = offset + 1;
	};

	$scope.moveNext = function() {
		var offset = $scope.ref ? parseInt(_.findKey($scope.references, {_id: $scope.ref._id})) + 1 : 0;
		if (offset > $scope.references.length) $location.path('/libraries/' + $scope.library._id);
		$scope.ref = $scope.references[offset];
		$scope.refNo = offset + 1;
	};
	// }}}

	$scope.$watch('references', function() {
		if ($scope.references && !$scope.ref) $scope.moveFirst();
	});

	$scope.$watch('library', function() {
		$rootScope.$broadcast('setTitle', 'Screening');
		$rootScope.$broadcast('setBreadcrumb', [
			{url: '/libraries', title: 'Libraries'},
			{url: '/libraries/' + $scope.library._id, title: $scope.library.title}
		]);
	});
});
