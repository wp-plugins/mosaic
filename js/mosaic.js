if ( typeof wp === 'undefined' )
	var wp = {};

(function($){
	var media = wp.media = {},
		Attachment, Attachments;

	/**
	 * ========================================================================
	 * UTILITIES
	 * ========================================================================
	 */

	_.extend( media, {
		/**
		 * media.template( id )
		 *
		 * Fetches a template by id.
		 *
		 * @param  {string} id   A string that corresponds to a DOM element with an id prefixed with "tmpl-".
		 *                       For example, "attachment" maps to "tmpl-attachment".
		 * @return {function}    A function that lazily-compiles the template requested.
		 */
		template: _.memoize( function( id ) {
			var compiled;
			return function( data ) {
				compiled = compiled || _.template( $( '#tmpl-' + id ).html() );
				return compiled( data );
			};
		}),

		/**
		 * media.post( [action], [data] )
		 *
		 * Sends a POST request to WordPress.
		 *
		 * @param  {string} action The slug of the action to fire in WordPress.
		 * @param  {object} data   The data to populate $_POST with.
		 * @return {$.promise}     A jQuery promise that represents the request.
		 */
		post: function( action, data ) {
			return media.ajax({
				data: _.isObject( action ) ? action : _.extend( data || {}, { action: action })
			});
		},

		/**
		 * media.ajax( [action], [options] )
		 *
		 * Sends a POST request to WordPress.
		 *
		 * @param  {string} action  The slug of the action to fire in WordPress.
		 * @param  {object} options The options passed to jQuery.ajax.
		 * @return {$.promise}      A jQuery promise that represents the request.
		 */
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
	 * ========================================================================
	 * MODELS
	 * ========================================================================
	 */

	/**
	 * wp.media.Attachment
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
	 * wp.media.Attachments
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


	/**
	 * ========================================================================
	 * VIEWS
	 * ========================================================================
	 */

	/**
	 * wp.media.AttachmentsView
	 */
	media.AttachmentsView = Backbone.View.extend({
		tagName:   'div',
		className: 'attachments',
		template:  media.template('attachments'),

		initialize: function() {
			this.collection.on( 'add', this.addOne, this );
			this.collection.on( 'reset', this.addAll, this );
			this.collection.on( 'all', this.render, this );

			this.$list = $('<ul />');
		},
		render: function() {
			this.$el.html( this.template( this.options ) ).append( this.$list );
			return this;
		},
		addOne: function( attachment ) {
			// console.log('addOne', arguments );
			var view = new media.AttachmentView({
				model: attachment
			}).render();

			this.$list.append( view.$el );
		},
		addAll: function() {
			this.collection.each( this.addOne, this );
		}
	});


	/**
	 * wp.media.AttachmentView
	 */
	media.AttachmentView = Backbone.View.extend({
		tagName:   'li',
		className: 'attachment',
		template:  media.template('attachment'),
		render:    function() {
			this.$el.html( this.template( this.model.toJSON() ) );
			return this;
		}
	});

	$(function() {
		var trigger = $('<span class="button-secondary">Mosaic</span>'),
			modal = $('<div/>'), library, view;

		$('#wp-content-media-buttons').prepend( trigger );

		trigger.on( 'click.mosaic', function() {
			modal.dialog({
				title: 'Insert Media',
				width: 480,
				height: 'auto',
				modal: true,
				dialogClass: 'wp-dialog',
				zIndex: 300000,
				autoOpen: true
			});
		});

		library = new media.Attachments();
		view = new media.AttachmentsView({
			directions: 'Select stuff.',
			collection: library
		});

		view.$el.appendTo( modal );

		library.fetch();
	});
}(jQuery));