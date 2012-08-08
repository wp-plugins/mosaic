if ( typeof wp === 'undefined' )
	var wp = {};

(function($){
	var media = wp.media = {
		getAttachment: _.memoize( function( id ) {
			var deferred   = $.Deferred(),
				attachment = new wp.media.Attachment( id );

			attachment.fetch().done( function() {
				deferred.resolve( attachment );
			}).fail( deferred.reject );

			return deferred.promise();
		}),

		query: function( options ) {

		}
	};

	media.Attachment = function( id ) {
		this.id = id;
	};

	media.Attachment.prototype.fetch = function() {
		var self = this;
		return $.post( ajaxurl, {
			action:   'get_attachment',
			id:       this.id,
			dataType: 'json'
		}).done( function( data ) {
			self.data = data;
		});
	};

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