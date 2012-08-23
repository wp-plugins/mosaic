if ( typeof wp === 'undefined' )
	var wp = {};

(function($){
	var media = wp.media = {};

	/**
	 * AJAX
	 */
	_.extend( media, {
		// post( [action], [data] );
		post: function( action, data ) {
			return media.ajax({
				data: _.isObject( action ) ? action : _.extend( data || {}, { action: action })
			});
		},

		// ajax( [action], [options] );
		ajax: function( action, options ) {
			if ( _.isObject( action ) ) {
				options = action;
			} else {
				options = options || {};
				options.data = _.extend( options.data || {}, { action: action });
			}

			options = _.defaults( options || {}, {
				type:    'POST',
				url:     ajaxurl,
				context: this
			});

			return $.Deferred( function( deferred ) {
				// Transfer success/error callbacks.
				if ( options.success )
					deferred.done( options.success );
				if ( options.error )
					deferred.fail( options.error );

				delete options.success;
				delete options.error;

				// Use with PHP's wp_die_success() and wp_die_error()
				$.ajax( options ).done( function( response ) {
					if ( _.isObject( response ) && ! _.isUndefined( response.success ) )
						deferred[ response.success ? 'resolveWith' : 'rejectWith' ]( this, [response.data] );
					else
						deferred.rejectWith( this, [response] );
				}).fail( function() {
					deferred.rejectWith( this, arguments );
				});
			}).promise();
		}
	});

	/**
	 * ATTACHMENT
	 */
	media.attachment = _.memoize( function( id ) {
		return new wp.media.Attachment({ id: id });
	});

	media.Attachment = Backbone.Model.extend({
		sync: function( method, model, options ) {
			// Overload the read method so Attachment.fetch() functions correctly.
			if ( 'read' === method ) {
				return media.ajax( _.extend( options || {}, {
					context: this,
					data: {
						action: 'get_attachment',
						id: 8
					}
				} ) );

			// Otherwise, fall back to Backbone.sync()
			} else {
				return Backbone.sync.apply( this, arguments );
			}
		}
	});

	/**
	 * QUERY
	 */
	media.query = function( options ) {
		return new media.Query( options );
	};

	media.Query = function( options ) {
		var query = this,
			promise;

		promise = media.ajax( 'get_attachments', {
			query: options
		}).done( function( data ) {
			query.attachments = _.map( data, function( datum ) {
				return media.attachment( datum.id ).parse( datum );
			});
		});

		_.extend( this, promise );

		this.options = options;
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