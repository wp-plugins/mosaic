<?php
/*
 Plugin Name: Mosaic
 Plugin URI: http://wordpress.org/extend/plugins/mosaic/
 Description: Media for 3.5.
 Author: wordpressdotorg
 Version: 0.1
 Author URI: http://wordpress.org/
 */

class Mosaic {
	function __construct() {
		add_action( 'load-post.php', array( $this, 'init' ) );
		add_action( 'admin_init', array( $this, 'register_scripts' ) );

		add_action( 'wp_ajax_get_attachment', array( $this, 'ajax_get_attachment' ) );
	}

	function register_scripts() {
		wp_register_script( 'mosaic-underscore', plugins_url( 'js/underscore.js', __FILE__ ), array(), '1.3.3' );
		wp_register_script( 'mosaic', plugins_url( 'js/mosaic.js', __FILE__ ), array('jquery','mosaic-underscore', 'jquery-ui-dialog') );

		wp_register_style( 'mosaic', plugins_url( 'css/mosaic.css', __FILE__ ), array('wp-admin','wp-jquery-ui-dialog') );
	}

	function init() {
		wp_enqueue_script( 'mosaic' );
		wp_enqueue_style( 'mosaic' );
		add_action( 'admin_footer', array( $this, 'admin_footer' ) );
	}

	function admin_footer() {
		include('template.php');
	}

	/**
	 * Used to send JSON ajax responses.
	 *
	 * Sets a JSON content-type header, encodes and prints a json object, then dies.
	 *
	 * @param  mixed $json The object to be encoded and printed.
	 */
	function json_die( $json ) {
		@header( 'Content-Type: application/json; charset=' . get_option( 'blog_charset' ) );
		echo json_encode( $json );
		wp_die();
	}

	function ajax_get_attachment() {
		if ( ! isset( $_REQUEST['id'] ) || ! current_user_can( 'read_post', $_REQUEST['id'] ) )
			wp_die( -1 );

		$this->json_die( $this->get_attachment_json( $_REQUEST['id'] ) );
	}

	function get_attachment_json( $attachment ) {
		$attachment = get_post( $attachment );

		return array(
			'id'       => $attachment->ID,
			'title'    => esc_attr( $attachment->post_title ),
			'filename' => esc_html( basename( $attachment->guid ) ),
			'url'      => wp_get_attachment_url( $attachment->ID ),
			'meta'     => wp_get_attachment_metadata( $attachment->ID ),
		);
	}

	function get_attachments_json( $query_args = array() ) {
		$query_args['post_type']   = 'attachment';
		$query_args['post_status'] = 'any';
		return array_map( array( $this, 'get_attachment_json' ), get_posts( $query_args ) );
	}
}

new Mosaic;