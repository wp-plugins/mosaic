<script type="text/html" id="tmpl-media-modal">
	<div class="media-modal">
		<div class="media-modal-header">
			<h3><%- title %></h3>
			<a class="media-modal-close" href="" title="<?php esc_attr_e('Close'); ?>"><?php echo 'Close'; ?></a>
		</div>
		<div class="media-modal-content"></div>
	</div>
	<div class="media-modal-backdrop"></div>
</script>

<script type="text/html" id="tmpl-media-workspace">
	<div class="upload-attachments">
		<% if ( selectOne ) { %>
			<?php _e( 'Drop a file here <span>or</span> <a href="#" class="button-secondary">Select a File</a>' ); ?>
		<% } else { %>
			<?php _e( 'Drop files here <span>or</span> <a href="#" class="button-secondary">Select Files</a>' ); ?>
		<% } %>
	</div>
	<div class="existing-attachments">
		<div class="media-workflow-actions"></div>
	</div>
</script>

<script type="text/html" id="tmpl-attachments">
	<div class="attachments-header">
		<h3><%- directions %></h3>
		<input class="search" type="text" placeholder="<?php esc_attr_e('Search'); ?>" />
	</div>
</script>

<script type="text/html" id="tmpl-attachment">
	<div class="attachment-thumbnail <%- sizes.medium.orientation %>">
		<img src="<%- sizes.medium.url %>" />
		<div class="actions"></div>
	</div>
	<div class="describe"></div>
</script>