<script type="text/html" id="tmpl-media-workspace">
	<div class="upload-attachments">
		<% if ( selectOne ) { %>
			<?php _e( 'Drop a file here <span>or</span> <a href="#" class="button-secondary">Select a File</a>' ); ?>
		<% } else { %>
			<?php _e( 'Drop files here <span>or</span> <a href="#" class="button-secondary">Select Files</a>' ); ?>
		<% } %>
	<div>
	<div class="existing-attachments">
		<div class="media-workflow-actions"><div>
	</div>
</script>

<script type="text/html" id="tmpl-attachments">
	<h3><%- directions %></h3>
	<input class="search" type="text" placeholder="<?php esc_attr_e('Search'); ?>" />
</script>

<script type="text/html" id="tmpl-attachment">
	<img src="<%- url %>" />
	<div class="actions"></div>
	<div class="describe"></div>
</script>