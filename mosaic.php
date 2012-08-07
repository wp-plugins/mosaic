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
}

new Mosaic;