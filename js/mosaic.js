if ( typeof wp === 'undefined' )
	var wp = {};

(function($){
	var media = wp.media = { view: {}, controller: {} },
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
	Attachments = media.Attachments = Backbone.Collection.extend({
		model: Attachment,

		initialize: function( models, options ) {
			options = options || {};

			this.filters = options.filters || {};

			if ( options.watch )
				this.watch( options.watch );

			if ( options.mirror )
				this.mirror( options.mirror );
		},

		validate: function( attachment ) {
			return _.all( this.filters, function( filter ) {
				return !! filter.call( this, attachment );
			}, this );
		},

		changed: function( attachment, options ) {

			if ( this.validate( attachment ) )
				this.add( attachment );
			else
				this.remove( attachment );
			return this;
		},

		watch: function( attachments ) {
			attachments.on( 'add change', this.changed, this );
		},

		unwatch: function( attachments ) {
			attachments.off( 'add change', this.changed, this );
		},

		mirror: function( attachments ) {
			if ( this.mirroring && this.mirroring === attachments )
				return;

			this.unmirror();
			this.mirroring = attachments;
			this.reset( attachments.models );
			attachments.on( 'add',    this._mirrorAdd,    this );
			attachments.on( 'remove', this._mirrorRemove, this );
			attachments.on( 'reset',  this._mirrorReset,  this );
		},

		unmirror: function() {
			if ( ! this.mirroring )
				return;

			this.mirroring.off( 'add',    this._mirrorAdd,    this );
			this.mirroring.off( 'remove', this._mirrorRemove, this );
			this.mirroring.off( 'reset',  this._mirrorReset,  this );
			delete this.mirroring;
		},

		_mirrorAdd: function( attachment, attachments, options ) {
			this.add( attachment, { at: options.index });
		},

		_mirrorRemove: function( attachment ) {
			this.remove( attachment );
		},

		_mirrorReset: function( attachments ) {
			this.reset( attachments.models );
		},

		more: function( options ) {
			if ( this.mirroring && this.mirroring.more )
				return this.mirroring.more( options );
		},

		parse: function( resp, xhr ) {
			return _.map( resp, function( attrs ) {
				var attachment = Attachment.get( attrs.id );
				return attachment.set( attachment.parse( attrs, xhr ) );
			});
		}
	});

	Attachments.all = new Attachments();

	/**
	 * wp.media.query
	 */
	media.query = (function(){
		var queries = [];

		return function( args, options ) {
			args = _.defaults( args || {}, media.Query.defaultArgs );

			var query = _.find( queries, function( query ) {
				return _.isEqual( query.args, args );
			});

			if ( ! query ) {
				query = new media.Query( [], _.extend( options || {}, { args: args } ) );
				queries.push( query );
			}

			return query;
		};
	}());

	/**
	 * wp.media.Query
	 *
	 * A set of attachments that corresponds to a set of consecutively paged
	 * queries on the server.
	 *
	 * Note: Do NOT change this.args after the query has been initialized.
	 *       Things will break.
	 */
	media.Query = Attachments.extend({
		initialize: function( models, options ) {
			var orderby,
				defaultArgs = media.Query.defaultArgs;

			options = options || {};
			Attachments.prototype.initialize.apply( this, arguments );

			// Generate this.args. Don't mess with them.
			this.args = _.defaults( options.args || {}, defaultArgs );

			// Normalize the order.
			this.args.order = this.args.order.toUpperCase();
			if ( 'DESC' !== this.args.order && 'ASC' !== this.args.order )
				this.args.order = defaultArgs.order.toUpperCase();

			// Set allowed orderby values.
			// These map directly to attachment keys in most scenarios.
			// Exceptions are specified in orderby.keymap.
			orderby = {
				allowed: [ 'name', 'author', 'date', 'title', 'modified', 'parent', 'ID' ],
				keymap:  {
					'ID':     'id',
					'name':   'slug',
					'parent': 'uploadedTo'
				}
			};

			if ( ! _.contains( orderby.allowed, this.args.orderby ) )
				this.args.orderby = defaultArgs.orderby;
			this.orderkey = orderby.keymap[ this.args.orderby ] || this.args.orderby;

			this.hasMore = true;
			this.created = new Date();

			this.filters.order = function( attachment ) {
				// We want any items that can be placed before the last
				// item in the set. If we add any items after the last
				// item, then we can't guarantee the set is complete.
				if ( this.length ) {
					return 1 !== this.comparator( attachment, this.last() );

				// Handle the case where there are no items yet and
				// we're sorting for recent items. In that case, we want
				// changes that occurred after we created the query.
				} else if ( 'DESC' === this.args.order && ( 'date' === this.orderkey || 'modified' === this.orderkey ) ) {
					return attachment.get( this.orderkey ) >= this.created;
				}

				// Otherwise, we don't want any items yet.
				return false;
			};

			if ( this.args.s ) {
				// Note that this client-side searching is *not* equivalent
				// to our server-side searching.
				this.filters.search = function( attachment ) {
					return _.any(['title','filename','description','caption','slug'], function( key ) {
						var value = attachment.get( key );
						return value && -1 !== value.search( this.args.s );
					}, this );
				};
			}

			this.watch( Attachments.all );
		},

		more: function( options ) {
			var query = this;

			if ( ! this.hasMore )
				return;

			options = options || {};
			options.add = true;

			return this.fetch( options ).done( function( resp ) {
				if ( _.isEmpty( resp ) || resp.length < this.args.posts_per_page )
					query.hasMore = false;
			});
		},

		sync: function( method, model, options ) {
			var fallback;

			// Overload the read method so Attachment.fetch() functions correctly.
			if ( 'read' === method ) {
				options = options || {};
				options.context = this;
				options.data = _.extend( options.data || {}, {
					action: 'get_attachments'
				});

				// Clone the args so manipulation is non-destructive.
				args = _.clone( this.args );

				// Determine which page to query.
				args.paged = Math.floor( this.length / args.posts_per_page ) + 1;

				options.data.query = args;
				return media.ajax( options );

			// Otherwise, fall back to Backbone.sync()
			} else {
				fallback = Attachments.prototype.sync ? Attachments.prototype : Backbone;
				return fallback.sync.apply( this, arguments );
			}
		},

		comparator: (function(){
			/**
			 * A basic comparator.
			 *
			 * @param  {mixed}  a  The primary parameter to compare.
			 * @param  {mixed}  b  The primary parameter to compare.
			 * @param  {string} ac The fallback parameter to compare, a's cid.
			 * @param  {string} bc The fallback parameter to compare, b's cid.
			 * @return {number}    -1: a should come before b.
			 *                      0: a and b are of the same rank.
			 *                      1: b should come before a.
			 */
			var compare = function( a, b, ac, bc ) {
				if ( _.isEqual( a, b ) )
					return ac === bc ? 0 : (ac > bc ? -1 : 1);
				else
					return a > b ? -1 : 1;
			};

			return function( a, b ) {
				var key   = this.orderkey,
					order = this.args.order,
					ac    = a.cid,
					bc    = b.cid;

				a = a.get( key );
				b = b.get( key );

				if ( 'date' === key || 'modified' === key ) {
					a = a || new Date();
					b = b || new Date();
				}

				return ( 'DESC' === order ) ? compare( a, b, ac, bc ) : compare( b, a, bc, ac );
			};
		}())
	}, {
		defaultArgs: {
			posts_per_page: 40,
			orderby:       'date',
			order:         'DESC'
		}
	});

	/**
	 * ========================================================================
	 * CONTROLLERS
	 * ========================================================================
	 */

	/**
	 * wp.media.controller.Workflow
	 */
	media.controller.Workflow = Backbone.Model.extend({
		defaults: {
			multiple: true
		},

		initialize: function() {
			this.createSelection();

			// Initialize views.
			this.modal     = new view.Modal({ controller: this });
			this.workspace = new view.Workspace({ controller: this });
		},

		createSelection: function() {
			var controller = this;

			// Initialize workflow-specific models.
			this.selection = new Attachments();

			// Override the selection's add method.
			// If the workflow does not support multiple
			// selected attachments, reset the selection.
			this.selection.add = function( models, options ) {
				if ( controller.get('multiple') ) {
					return Attachments.prototype.add.apply( this, arguments );
				} else {
					models = _.isArray( models ) ? _.first( models ) : models;
					return this.reset.call( this, [models], options );
				}
			};

			// Override the selection's reset method.
			// Always direct items through add and remove,
			// as we need them to fire.
			this.selection.reset = function( models, options ) {
				return this.remove( models, options ).add( models, options );
			};

			// Create selection.has, which determines if a model
			// exists in the collection based on cid and id,
			// instead of direct comparison.
			this.selection.has = function( attachment ) {
				return !! ( this.getByCid( attachment.cid ) || this.get( attachment.id ) );
			};
		},

		render: function() {
			this.workspace.render();
			this.modal.content( this.workspace );
			this.modal.$el.appendTo('body');
			return this;
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

		initialize: function() {
			this.controller = this.options.controller;

			_.defaults( this.options, {
				title: ''
			});
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
			this.controller = this.options.controller;

			_.defaults( this.options, {
				selectOne: false,
				uploader:  {}
			});

			this.attachmentsView = new view.Attachments({
				controller: this.controller,
				directions: 'Select stuff.',
				collection: new Attachments( null, {
					mirror: media.query()
				})
			}).render();

			this.$content = $('<div class="existing-attachments" />');
			this.$content.append( this.attachmentsView.$el );

			// Track uploading attachments.
			this.pending = new Attachments( [], { query: false });
			this.pending.on( 'add remove reset change:percent', function() {
				this.$el.toggleClass( 'uploading', !! this.pending.length );

				if ( ! this.$bar || ! this.pending.length )
					return;

				this.$bar.width( ( this.pending.reduce( function( memo, attachment ) {
					if ( attachment.get('uploading') )
						return memo + ( attachment.get('percent') || 0 );
					else
						return memo + 100;
				}, 0 ) / this.pending.length ) + '%' );
			}, this );
		},

		render: function() {
			this.$el.html( this.template( this.options ) ).append( this.$content );
			this.$bar = this.$('.media-progress-bar div');
			return this;
		},

		maybeInitUploader: function() {
			var workspace = this;

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

					workspace.pending.add( file.attachment );
				},

				progress: function( file ) {
					file.attachment.set( _.pick( file, 'loaded', 'percent' ) );
				},

				success: function( resp, file ) {
					var complete;

					_.each(['file','loaded','size','uploading','percent'], function( key ) {
						file.attachment.unset( key );
					});

					file.attachment.set( 'id', resp.id );
					Attachment.get( resp.id, file.attachment ).fetch();

					complete = workspace.pending.all( function( attachment ) {
						return ! attachment.get('uploading');
					});

					if ( complete )
						workspace.pending.reset();
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
			this.controller = this.options.controller;

			_.defaults( this.options, {
				refreshSensitivity: 200,
				refreshThreshold:   2
			});

			_.each(['add','remove'], function( method ) {
				this.collection.on( method, function( attachment, attachments, options ) {
					this[ method ]( attachment, options.index );
				}, this );
			}, this );

			this.collection.on( 'reset', this.refresh, this );

			this.$list = $('<ul />');
			this.list  = this.$list[0];

			this.scroll = _.chain( this.scroll ).bind( this ).throttle( this.options.refreshSensitivity ).value();
			this.$list.on( 'scroll.attachments', this.scroll );
		},

		render: function() {
			this.$el.html( this.template( this.options ) ).append( this.$list );
			this.refresh();
			return this;
		},

		refresh: function() {
			// If there are no elements, load some.
			if ( ! this.collection.length ) {
				this.collection.more();
				this.$list.empty();
				return this;
			}

			// Otherwise, create all of the Attachment views, and replace
			// the list in a single DOM operation.
			this.$list.html( this.collection.map( function( attachment ) {
				return new media.view.Attachment({
					controller: this.controller,
					model:      attachment
				}).render().$el;
			}) );

			// Then, trigger the scroll event to check if we're within the
			// threshold to query for additional attachments.
			this.scroll();
			return this;
		},

		add: function( attachment, index ) {
			var view, children;

			view = new media.view.Attachment({
				controller: this.controller,
				model:      attachment
			}).render();

			children = this.$list.children();

			if ( children.length > index )
				children.eq( index ).before( view.$el );
			else
				this.$list.append( view.$el );
		},

		remove: function( attachment, index ) {
			var children = this.$list.children();
			if ( children.length )
				children.eq( index ).detach();
		},

		scroll: function( event ) {
			// @todo: is this still necessary?
			if ( ! this.$list.is(':visible') )
				return;

			if ( this.list.scrollHeight < this.list.scrollTop + ( this.list.clientHeight * this.options.refreshThreshold ) ) {
				this.collection.more();
			}
		},

		search: function( event ) {
			var args = _.clone( this.collection.mirroring.args );

			// Bail if we're currently searching for the same string.
			if ( args.s === event.target.value )
				return;

			if ( event.target.value )
				args.s = event.target.value;
			else
				delete args.s;

			this.collection.mirror( media.query( args ) );
		}
	});


	/**
	 * wp.media.view.Attachment
	 */
	view.Attachment = Backbone.View.extend({
		tagName:   'li',
		className: 'attachment',
		template:  media.template('attachment'),

		events: {
			'click': 'toggleSelection'
		},

		initialize: function() {
			this.controller = this.options.controller;

			this.model.on( 'change:sizes change:uploading', this.render, this );
			this.model.on( 'change:percent', this.progress, this );
			this.model.on( 'add', this.select, this );
			this.model.on( 'remove', this.deselect, this );
		},

		render: function() {
			var attachment = this.model.toJSON(),
				options = {
					orientation: attachment.orientation || 'landscape',
					thumbnail:   attachment.url || '',
					uploading:   attachment.uploading
				};

			// Use the medium size if possible. If the medium size
			// doesn't exist, then the attachment is too small.
			// In that case, use the attachment itself.
			if ( attachment.sizes && attachment.sizes.medium ) {
				options.orientation = attachment.sizes.medium.orientation;
				options.thumbnail   = attachment.sizes.medium.url;
			}

			this.$el.html( this.template( options ) );

			if ( attachment.uploading )
				this.$bar = this.$('.media-progress-bar div');
			else
				delete this.$bar;

			return this;
		},

		progress: function() {
			if ( this.$bar && this.$bar.length )
				this.$bar.width( this.model.get('percent') + '%' );
		},

		toggleSelection: function( event ) {
			var selection = this.controller.selection;
			selection[ selection.has( this.model ) ? 'remove' : 'add' ]( this.model );
		},

		select: function( model, collection ) {
			if ( collection === this.controller.selection )
				this.$el.addClass('selected');
		},

		deselect: function( model, collection ) {
			if ( collection === this.controller.selection )
				this.$el.removeClass('selected');
		}
	});

	$(function() {
		var trigger = $('<span class="button-secondary">Mosaic</span>'),
			models = {}, views = {};

		window.models = models;
		window.views = views;

		$('#wp-content-media-buttons').prepend( trigger );

		trigger.on( 'click.mosaic', function() {
			new media.controller.Workflow().render();
		});
	});
}(jQuery));