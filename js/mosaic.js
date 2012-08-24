if ( typeof wp === 'undefined' )
	var wp = {};

(function($){
	var media = wp.media = { view: {} },
		view  = media.view,
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
	}, {
		get: _.memoize( function( id ) {
			return new Attachment({ id: id });
		})
	});

	/**
	 * wp.media.Attachments
	 */
	media.query = function( query, options ) {
		return new Attachments( null, { query: query }).fetch();
	};

	Attachments = media.Attachments = Backbone.Collection.extend({
		model: Attachment,

		initialize: function( models, options ) {
			options = options || {};

			if ( options.query || _.isUndefined( options.query ) )
				this.query = new Backbone.Model( _.defaults( options.query || {}, Attachments.defaultQueryArgs ) );
		},

		more: function( options ) {
			options = options || {};
			options.add = true;

			this.query.set( 'paged', this.query.get('paged') + 1 );

			return this.fetch( options );
		},

		parse: function( resp, xhr ) {
			return _.map( resp, function( attrs ) {
				return Attachment.get( attrs.id ).set( attrs );
			});
		},

		sync: function( method, model, options ) {
			// Overload the read method so Attachment.fetch() functions correctly.
			if ( 'read' === method ) {
				options = options || {};
				options.context = this;
				options.data = _.extend( options.data || {}, {
					action: 'get_attachments'
				});

				if ( this.query )
					options.data.query = this.query.toJSON();

				return media.ajax( options );

			// Otherwise, fall back to Backbone.sync()
			} else {
				return Backbone.sync.apply( this, arguments );
			}
		}
	}, {
		defaultQueryArgs: {
			posts_per_page: 40,
			paged: 0
		}
	});


	/**
	 * ========================================================================
	 * VIEWS
	 * ========================================================================
	 */

	/**
	 * wp.media.view.Modal
	 */
	view.Modal = Backbone.View.extend({
		tagName:  'div',
		template: media.template('media-modal'),

		events: {
			'click .media-modal-backdrop, .media-modal-close' : 'close'
		},

		render: function() {
			this.$el.html( this.template( this.options ) );
			this.$('.media-modal-content').append( this.options.$content );
			return this;
		},

		open: function( event ) {
			this.$el.show();
			event.preventDefault();
		},

		close: function( event ) {
			this.$el.hide();
			event.preventDefault();
		},

		content: function( $content ) {
			this.options.$content = $content;
			return this.render();
		},

		title: function( title ) {
			this.options.title = title;
			return this.render();
		}
	});


	/**
	 * wp.media.view.Attachments
	 */
	view.Attachments = Backbone.View.extend({
		tagName:   'div',
		className: 'attachments',
		template:  media.template('attachments'),

		initialize: function() {
			_.defaults( this.options, {
				refreshSensitivity: 200,
				refreshThreshold:   2
			});

			this.collection.on( 'add', this.addOne, this );
			this.collection.on( 'reset', this.render, this );

			this.$list = $('<ul />');
			this.list  = this.$list[0];

			this.scroll = _.chain( this.scroll ).bind( this ).throttle( this.options.refreshSensitivity ).value();
			this.$list.on( 'scroll.attachments', this.scroll );
		},

		render: function() {
			this.collection.each( this.addOne, this );
			this.$el.html( this.template( this.options ) ).append( this.$list );
			return this;
		},

		addOne: function( attachment ) {
			var view = new media.view.Attachment({
				model: attachment
			}).render();

			this.$list.append( view.$el );
		},

		scroll: function( event ) {
			if ( ! this.$list.is(':visible') )
				return;

			if ( this.list.scrollHeight < this.list.scrollTop + ( this.list.clientHeight * this.options.refreshThreshold ) )
				this.collection.more();
		}
	});


	/**
	 * wp.media.view.Attachment
	 */
	view.Attachment = Backbone.View.extend({
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
			modal, library;

		$('#wp-content-media-buttons').prepend( trigger );

		trigger.on( 'click.mosaic', function() {
			library = new Attachments();
			modal = new view.Modal({
				title: 'Testing'
			});

			modal.$el.appendTo('body');

			modal.content( new view.Attachments({
				directions: 'Select stuff.',
				collection: library
			}).$el );

			library.fetch();
		});
	});
}(jQuery));