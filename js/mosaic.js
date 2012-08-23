if ( typeof wp === 'undefined' )
	var wp = {};

(function($){
	var media = wp.media = {},
		Attachment, Attachments;

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
		return new Attachment({ id: id });
	});

	Attachment = media.Attachment = Backbone.Model.extend({
		sync: function( method, model, options ) {
			// Overload the read method so Attachment.fetch() functions correctly.
			if ( 'read' === method ) {
				options = options || {};
				options.context = this;
				options.data = _.extend( options.data || {}, {
					action: 'get_attachment',
					id: 8
				});
				return media.ajax( options );

			// Otherwise, fall back to Backbone.sync()
			} else {
				return Backbone.sync.apply( this, arguments );
			}
		}
	});

	/**
	 * ATTACHMENTS
	 */
	media.query = function( query, options ) {
		return new Attachments().query( query, options );
	};

	Attachments = media.Attachments = Backbone.Collection.extend({
		model: Attachment,

		query: function( query, options ) {
			options = options || {};
			options.data = _.extend( options.data || {}, { query: query });
			return this.fetch( options );
		},

		sync: function( method, model, options ) {
			// Overload the read method so Attachment.fetch() functions correctly.
			if ( 'read' === method ) {
				options = options || {};
				options.context = this;
				options.data = _.extend( options.data || {}, {
					action: 'get_attachments'
				});
				options.data.query = _.defaults( options.data.query || {}, Attachments.defaultQueryArgs );
				return media.ajax( options );

			// Otherwise, fall back to Backbone.sync()
			} else {
				return Backbone.sync.apply( this, arguments );
			}
		}
	}, {
		defaultQueryArgs: {
			posts_per_page: 40
		}
	});

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