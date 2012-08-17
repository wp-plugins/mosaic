if ( typeof wp === 'undefined' )
	var wp = {};

(function($){
	var media = wp.media = {

		// ajax( [action], [query] );
		ajax: function( action, query ) {
			if ( _.isObject( action ) ) {
				query  = action;
				action = null;
			}

			query = _.defaults( query || {}, { action: action });

			return $.Deferred( function( deferred ) {
				// Use with PHP's wp_die_success() and wp_die_error()
				$.post( ajaxurl, query ).done( function( response ) {
					if ( _.isObject( response ) && ! _.isUndefined( response.success ) )
						deferred[ response.success ? 'resolveWith' : 'rejectWith' ]( this, [response.data] );
					else
						deferred.rejectWith( this, [response] );
				}).fail( function() {
					deferred.rejectWith( this, arguments );
				});
			}).promise();
		},

		attachment: _.memoize( function( id ) {
			return new wp.media.Attachment( id );
		}),

		query: function( options ) {
			return new media.Query( options );
		}
	};

	/**
	 * ATTACHMENT
	 */
	media.Attachment = function( id ) {
		this.id = id;
	};

	_.extend( media.Attachment.prototype, {
		parse: function( data ) {
			this.data = data;
			return this;
		},
		fetch: function() {
			var attachment = this;

			return media.ajax( 'get_attachment', {
				id: this.id
			}).done( function( data ) {
				attachment.parse( data );
			});
		}
	});

	/**
	 * ATTACHMENTS
	 */
	media.Attachments = function() {
	};

	_.extend( media.Attachments.prototype, {
		add: function() {
		}
	});

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


	media.view.Attachment = function( model ) {
		this.model = model;
		this.element = $('<div class="attachment" />');
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