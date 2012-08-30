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

		add_action( 'wp_ajax_get_attachment',  array( $this, 'ajax_get_attachment' ) );
		add_action( 'wp_ajax_get_attachments', array( $this, 'ajax_get_attachments' ) );
	}

	function register_scripts() {
		wp_register_script( 'mosaic', plugins_url( 'js/mosaic.js', __FILE__ ), array('backbone','jquery','wp-plupload') );
		wp_register_style( 'mosaic', plugins_url( 'css/mosaic.css', __FILE__ ), array('wp-admin') );
	}

	function init() {
		wp_enqueue_script( 'mosaic' );
		wp_enqueue_style( 'mosaic' );
		wp_plupload_default_settings();

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
	function wp_json_die( $json ) {
		@header( 'Content-Type: application/json; charset=' . get_option( 'blog_charset' ) );
		echo json_encode( $json );
		wp_die();
	}

	function wp_die_success( $data = null ) {
		$json = array( 'success' => true );

		if ( isset( $data ) )
			$json['data'] = $data;

		$this->wp_json_die( $json );
	}

	function wp_die_error( $data = null ) {
		$json =  array( 'success' => false );

		if ( isset( $data ) )
			$json['data'] = $data;

		$this->wp_json_die( $json );
	}

	function ajax_get_attachment() {
		if ( ! isset( $_REQUEST['id'] ) )
			$this->wp_die_error();

		$json = $this->get_attachment_json( absint( $_REQUEST['id'] ) );

		if ( empty( $json ) )
			$this->wp_die_error();

		$this->wp_die_success( $json );
	}

	function ajax_get_attachments() {
		$query = isset( $_REQUEST['query'] ) ? $_REQUEST['query'] : array();
		$json  = $this->get_attachments_json( $query );

		$this->wp_die_success( $json );
	}

	function get_attachment_json( $attachment ) {
		if ( ! $attachment = get_post( $attachment ) )
		   return;

		if ( 'attachment' != $attachment->post_type )
		   return;

		if ( ! current_user_can( 'read_post', $attachment->ID ) )
		   return;

		$meta = wp_get_attachment_metadata( $attachment->ID );
		list( $type, $subtype ) = explode( '/', $attachment->post_mime_type );

		$attachment_url = wp_get_attachment_url( $attachment->ID );

		$json = array(
			'id'          => $attachment->ID,
			'title'       => esc_attr( $attachment->post_title ),
			'filename'    => esc_html( basename( $attachment->guid ) ),
			'url'         => $attachment_url,
			'alt'         => get_post_meta( $attachment->ID, '_wp_attachment_image_alt', true ),
			'author'      => $attachment->post_author,
			'description' => $attachment->post_content,
			'caption'     => $attachment->post_excerpt,
			'name'        => $attachment->post_name,
			'status'      => $attachment->post_status,
			'uploadedTo'  => $attachment->post_parent,
			'date'        => $attachment->post_date_gmt . ' UTC',
			'modified'    => $attachment->post_modified_gmt . ' UTC',
			'mime'        => $attachment->post_mime_type,
			'type'        => $type,
			'subtype'     => $subtype,
		);

		if ( 'image' === $type ) {
			$sizes = array();
			$base_url = str_replace( wp_basename( $attachment_url ), '', $attachment_url );

			foreach ( $meta['sizes'] as $slug => $size ) {
				$sizes[ $slug ] = array(
					'height'      => $size['height'],
					'width'       => $size['width'],
					'url'         => $base_url . $size['file'],
					'orientation' => $size['height'] > $size['width'] ? 'portrait' : 'landscape',
				);
			}

			$json = array_merge( $json, array(
				'height'      => $meta['height'],
				'width'       => $meta['width'],
				'sizes'       => $sizes,
				'orientation' => $meta['height'] > $meta['width'] ? 'portrait' : 'landscape',
			) );
		}

		return apply_filters( 'get_attachment_json', $json, $attachment, $meta );
	}

	function get_attachments_json( $query_args = array() ) {
		$query_args['post_type']   = 'attachment';
		$query_args['post_status'] = 'any';
		return array_map( array( $this, 'get_attachment_json' ), get_posts( $query_args ) );
	}
}

new Mosaic;