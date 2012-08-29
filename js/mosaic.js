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
					id: this.id
				});
				return media.ajax( options );

			// Otherwise, fall back to Backbone.sync()
			} else {
				return Backbone.sync.apply( this, arguments );
			}
		},

		parse: function( resp, xhr ) {
			// Convert date strings into Date objects.
			resp.date = new Date( resp.date );
			resp.modified = new Date( resp.modified );
			return resp;
		}
	}, {
		create: function( attrs ) {
			return Attachments.all.push( attrs );
		},

		get: _.memoize( function( id, attachment ) {
			return Attachments.all.push( attachment || { id: id } );
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

			this.filters = options.filters || {};

			if ( options.query || _.isUndefined( options.query ) ) {
				this.query = new Backbone.Model( _.defaults( options.query || {}, Attachments.defaultQueryArgs ) );

				this.query.on( 'change', function() {
					this.hasMore = true;
				}, this );
				this.hasMore = true;
			}

			if ( options.watch )
				this.watch();
		},

		more: function( options ) {
			var collection = this;

			if ( ! this.hasMore || ! this.query )
				return;

			options = options || {};
			options.add = true;

			return this.fetch( options ).done( function( resp ) {
				if ( _.isEmpty( resp ) || resp.length < this.query.get( 'posts_per_page' ) )
					collection.hasMore = false;
			});
		},

		validate: function( attachment ) {
			return _.all( this.filters, function( filter ) {
				return !! filter.call( this, attachment );
			}, this );
		},

		validatedAdd: function( attachment ) {
			if ( this.validate( attachment ) )
				this.add( attachment );
			return this;
		},

		watch: function() {
			if ( this.watching )
				return;

			this.watching = true;
			Attachments.all.on( 'add', this.validatedAdd, this );
		},

		unwatch: function() {
			this.watching = false;
			Attachments.all.off( 'add', this.validatedAdd, this );
		},

		clone: function() {
			var clone = new this.constructor( this.models, {
				comparator: this.comparator,
				query:      this.query.toJSON(),
				filters:    this.filters,
				watch:      this.watching
			});
			clone.hasMore = this.hasMore;
			return clone;
		},

		parse: function( resp, xhr ) {
			return _.map( resp, function( attrs ) {
				var attachment = Attachment.get( attrs.id );
				return attachment.set( attachment.parse( attrs, xhr ) );
			});
		},

		sync: function( method, model, options ) {
			var query;

			// Overload the read method so Attachment.fetch() functions correctly.
			if ( 'read' === method ) {
				options = options || {};
				options.context = this;
				options.data = _.extend( options.data || {}, {
					action: 'get_attachments'
				});

				if ( this.query ) {
					query = this.query.toJSON();

					// Determine which page to query.
					if ( _.isUndefined( query.paged ) )
						query.paged = Math.floor( this.length / query.posts_per_page ) + 1;

					options.data.query = query;
				}

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

	Attachments.all = new Attachments();

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
			this.options.$content = ( $content instanceof Backbone.View ) ? $content.$el : $content;
			return this.render();
		},

		title: function( title ) {
			this.options.title = title;
			return this.render();
		}
	});

	/**
	 * wp.media.view.Workspace
	 */
	view.Workspace = Backbone.View.extend({
		tagName:   'div',
		className: 'media-workspace',
		template:  media.template('media-workspace'),

		events: {
			'dragenter':  'maybeInitUploader',
			'mouseenter': 'maybeInitUploader'
		},

		initialize: function() {
			_.defaults( this.options, {
				selectOne: false,
				uploader:  {}
			});

			this.$content = $('<div class="existing-attachments" />');
		},

		render: function() {
			var selection = this.collection;

			this.$el.html( this.template( this.options ) ).append( this.$content );
			return this;
		},

		maybeInitUploader: function() {
			// If the uploader already exists or the body isn't in the DOM, bail.
			if ( this.uploader || ! this.$el.closest('body').length )
				return;

			this.uploader = new wp.Uploader( _.extend({
				container: this.$el,
				dropzone:  this.$el,
				browser:   this.$('.upload-attachments a'),
				added: function( file ) {
					file.attachment = Attachment.create( _.extend({
						file: file,
						uploading: true,
						date: new Date()
					}, _.pick( file, 'loaded', 'size', 'percent' ) ) );

					// console.log('added', arguments, file.attachment.toJSON() );
				},
				progress: function( file ) {
					file.attachment.set( _.pick( file, 'loaded', 'percent' ) );
					// console.log('progress', arguments, file.attachment.toJSON() );
				},
				success: function( resp, file ) {
					// console.log('success', arguments, file.attachment.toJSON() );
					_.each(['file','loaded','size','percent','uploading'], function( key ) {
						file.attachment.unset( key );
					});

					file.attachment.set( 'id', resp.id );
					Attachment.get( resp.id, file.attachment ).fetch();
				},
				error: function( message, error, file ) {
					file.attachment.destroy();
				}
			}, this.options.uploader ) );
		}
	});


	/**
	 * wp.media.view.Attachments
	 */
	view.Attachments = Backbone.View.extend({
		tagName:   'div',
		className: 'attachments',
		template:  media.template('attachments'),

		events: {
			'keyup input': 'search'
		},

		initialize: function() {
			_.defaults( this.options, {
				refreshSensitivity: 200,
				refreshThreshold:   2
			});

			this.collection.on( 'add', function( attachment, attachments, options ) {
				this.add( attachment, options.index );
			}, this );
			this.collection.on( 'reset', this.refresh, this );

			this.$list = $('<ul />');
			this.list  = this.$list[0];

			this.scroll = _.chain( this.scroll ).bind( this ).throttle( this.options.refreshSensitivity ).value();
			this.$list.on( 'scroll.attachments', this.scroll );
		},

		render: function() {
			this.$el.html( this.template( this.options ) );
			this.refresh();
			return this;
		},

		refresh: function() {
			this.$list.detach().empty();
			this.collection.each( this.add, this );
			this.$el.append( this.$list );
			this.scroll();
			return this;
		},

		add: function( attachment, index ) {
			var view, children;

			view = new media.view.Attachment({
				model: attachment
			}).render();

			children = this.$list.children();

			if ( children.length > index )
				children.eq( index ).before( view.$el );
			else
				this.$list.append( view.$el );
		},

		scroll: function( event ) {
			// @todo: is this still necessary?
			if ( ! this.$list.is(':visible') )
				return;

			if ( this.list.scrollHeight < this.list.scrollTop + ( this.list.clientHeight * this.options.refreshThreshold ) )
				this.collection.more();
		},

		search: function( event ) {
			var collection = this.collection;

			if ( collection.searching === event.target.value )
				return;

			collection.searching = event.target.value;

			if ( collection.searching ) {
				if ( ! collection.library )
					collection.library = collection.toArray();

				collection.query.set( 's', collection.searching );
				collection.reset( _.filter( collection.library, collection.validate, collection ) );

			} else {
				collection.query.unset('s');
				collection.reset( collection.library );
				delete collection.library;
			}
		}
	});


	/**
	 * wp.media.view.Attachment
	 */
	view.Attachment = Backbone.View.extend({
		tagName:   'li',
		className: 'attachment',
		template:  media.template('attachment'),

		initialize: function() {
			this.model.on( 'change:sizes', this.render, this );
		},

		render: function() {
			var sizes = this.model.get('sizes'),
				options = {
					orientation: 'landscape',
					thumbnail:   ''
				};

			if ( sizes ) {
				options.orientation = sizes.medium.orientation;
				options.thumbnail = sizes.medium.url;
			}

			this.$el.html( this.template( options ) );
			return this;
		}
	});

	$(function() {
		var trigger = $('<span class="button-secondary">Mosaic</span>'),
			models = {}, views = {};

		window.models = models;
		window.views = views;

		$('#wp-content-media-buttons').prepend( trigger );

		trigger.on( 'click.mosaic', function() {
			var library = models.library = new Attachments( [], {
				comparator: function( a, b ) {
					a = a.get('date') || new Date();
					b = b.get('date') || new Date();
					return a == b ? 0 : (a > b ? -1 : 1);
				},

				filters: {
					date: (function( created ) {
						return function( attachment ) {
							var date;

							if ( this.library && this.library.length )
								date = _.last( this.library ).get('date');
							else if ( this.length )
								date = this.last().get('date');

							date = date || created;
							return attachment.get('date') >= date;
						};
					}( new Date() )),

					search: function( attachment ) {
						if ( ! this.searching )
							return true;

						return _.any(['title','filename','description','caption','slug'], function( key ) {
							var value = attachment.get( key );
							return value && -1 !== value.search( this.searching );
						}, this );
					}
				},

				watch: true
			});

			models.selected = new Attachments();

			views.modal = new view.Modal({
				title: 'Testing'
			});

			views.workspace = new view.Workspace({
				collection: models.selected
			});

			views.attachments = new view.Attachments({
				directions: 'Select stuff.',
				collection: models.library
			});

			views.workspace.$content.append( views.attachments.$el );
			views.workspace.render();
			views.attachments.render();
			views.modal.content( views.workspace );
			views.modal.$el.appendTo('body');

			models.library.fetch();
		});
	});
}(jQuery));