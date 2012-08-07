(function($){
	$(function() {
		var trigger = $('<span class="button-secondary">Mosaic</span>');
		$('#wp-content-media-buttons').prepend( trigger );

		trigger.on( 'click.mosaic', function() {
			$('#mosaic').dialog({
				title: 'Insert Media',
				width: 480,
				height: 'auto',
				modal: true,
				dialogClass: 'wp-dialog',
				zIndex: 300000
			});
		});
	});
}(jQuery));