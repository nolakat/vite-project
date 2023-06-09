import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import * as dat from 'dat.gui';

import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

import { OutsideEdgesGeometry } from './OutsideEdgesGeometry.js';
import { ConditionalEdgesGeometry } from './ConditionalEdgesGeometry.js';
import { ConditionalEdgesShader } from './ConditionalEdgesShader.js';
import { ConditionalLineSegmentsGeometry } from './Lines2/ConditionalLineSegmentsGeometry.js';
import { ConditionalLineMaterial } from './Lines2/ConditionalLineMaterial.js';
import { ColoredShadowMaterial } from './ColoredShadowMaterial.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';


			// globals
			var params = {
				colors: 'DARK',
				backgroundColor: '#0d2a28',
				modelColor: '#0d2a28',
				lineColor: '#ffb400',
				shadowColor: '#44491f',

				lit: false,
				opacity: 0.15,
				threshold: 40,
				display: 'THRESHOLD_EDGES',
				displayConditionalEdges: true,
				thickness: 1,
				useThickLines: false,
				displayPixelPass: false,
				pixelSize: 6,
				model: 'TEST',
				randomize: () => randomizeColors(),
			};
			let camera, scene, renderer, composer, renderPixelatedPass, controls, edgesModel, originalModel, backgroundModel, conditionalModel, shadowModel, floor, depthModel, gui;
			const bones = [];
			const models = {};
			let skeleton;
			let skinnedMesh;
			const color = new THREE.Color();
			const color2 = new THREE.Color();

			const LIGHT_BACKGROUND = 0xeeeeee;
			const LIGHT_MODEL = 0xffffff;
			const LIGHT_LINES = 0x455A64;
			const LIGHT_SHADOW = 0xc4c9cb;

			const DARK_BACKGROUND = 0x111111;
			const DARK_MODEL = 0x111111;
			const DARK_LINES = 0xb0bec5;
			const DARK_SHADOW = 0x2c2e2f;

			init();
			animate();

function randomizeColors() {

	const lineH = Math.random();
	const lineS = Math.random() * 0.2 + 0.8;
	const lineL = Math.random() * 0.2 + 0.4;

	const lineColor = '#' + color.setHSL( lineH, lineS, lineL ).getHexString();
	const backgroundColor = '#' + color.setHSL(
		( lineH + 0.35 + 0.3 * Math.random() ) % 1.0,
		lineS * ( 0.25 + Math.random() * 0.75 ),
		1.0 - lineL,
	).getHexString();

	color.set( lineColor );
	color2.set( backgroundColor );
	const shadowColor = '#' + color.lerp( color2, 0.7 ).getHexString();

	params.shadowColor = shadowColor;
	params.lineColor = lineColor;
	params.backgroundColor = backgroundColor;
	params.modelColor = backgroundColor;
	params.colors = 'CUSTOM';

	initGui();

};

function updateModel() {

	originalModel = models[ params.model ];

	initEdgesModel();

	initBackgroundModel();

	initConditionalModel();

}

/**
 * Merges the geometries of all meshes within an object into a single mesh,
 * centering it and returning a group containing the mesh.
 *
 * @param {THREE.Object3D} object - The object whose mesh geometries will be merged.
 * @returns {THREE.Group} A group containing the merged mesh.
 */
function mergeObject(object) {
	// Update the matrix of the object and all of its children
	object.updateMatrixWorld(true);

	// Create an array to hold all the non-indexed geometries of each mesh in the object
	const geometry = [];
	object.traverse(child => {
		// If the child is a mesh, add its geometry to the geometry array
		if (child.isMesh) {
			// Apply the child's matrix to its geometry and remove all attributes except for position and normal
			const g = child.geometry;
			g.applyMatrix4(child.matrixWorld);
			for (const key in g.attributes) {
				if (key !== 'position' && key !== 'normal') {
					g.deleteAttribute(key);
				}
			}
			// Add the modified geometry to the geometry array
			geometry.push(g.toNonIndexed());
		}
	});

	// Merge the geometries in the array into a single geometry
	const mergedGeometries = BufferGeometryUtils.mergeBufferGeometries(geometry, false);
	const mergedGeometry = BufferGeometryUtils.mergeVertices(mergedGeometries).center();

	// Create a group to hold the merged mesh, create a mesh from the merged geometry,
	// add the mesh to the group, and return the group
	const group = new THREE.Group();
	const mesh = new THREE.Mesh(mergedGeometry);
	group.add(mesh);
	return group;
}


/**
*	Initializes the background, shadow, and depth models for a given Three.js scene
*/
function initBackgroundModel() {

	// remove the previous background, shadow, and depth models
	if ( backgroundModel ) {
			backgroundModel.parent.remove( backgroundModel );
			shadowModel.parent.remove( shadowModel );
			depthModel.parent.remove( depthModel );

			// dispose the material of each mesh in the models
			backgroundModel.traverse( c => {
					if ( c.isMesh ) {
							c.material.dispose();
					}
			} );

			shadowModel.traverse( c => {
					if ( c.isMesh ) {
							c.material.dispose();
					}
			} );

			depthModel.traverse( c => {
					if ( c.isMesh ) {
							c.material.dispose();
					}
			} );
	}

	// if we have no loaded model then exit
	if ( ! originalModel ) {
			return;
	}

	// create a new background model
	backgroundModel = originalModel.clone();
	backgroundModel.traverse( c => {
			// set the material of each mesh to a basic mesh material with a light color
			if ( c.isMesh ) {
					c.material = new THREE.MeshBasicMaterial( { color: LIGHT_MODEL } );
					// enable polygon offset to avoid z-fighting with the depth model
					c.material.polygonOffset = true;
					c.material.polygonOffsetFactor = 1;
					c.material.polygonOffsetUnits = 1;
					// set a higher render order to ensure the background is rendered after the model
					c.renderOrder = 2;
			}
	} );
	// add the background model to the scene
	scene.add( backgroundModel );

	// create a new shadow model
	shadowModel = originalModel.clone();
	shadowModel.traverse( c => {
			// set the material of each mesh to a colored shadow material with a light color and some shininess
			if ( c.isMesh ) {
					c.material = new ColoredShadowMaterial( { color: LIGHT_MODEL, shininess: 1.0 } );
					// enable polygon offset to avoid z-fighting with the depth model
					c.material.polygonOffset = true;
					c.material.polygonOffsetFactor = 1;
					c.material.polygonOffsetUnits = 1;
					// set the mesh to receive shadows
					c.receiveShadow = true;
					// set a higher render order to ensure the shadow is rendered after the model
					c.renderOrder = 2;
			}
	} );
	// add the shadow model to the scene
	scene.add( shadowModel );

	// create a new depth model
	depthModel = originalModel.clone();
	depthModel.traverse( c => {
			// set the material of each mesh to a basic mesh material with a light color and disable color write
			if ( c.isMesh ) {
					c.material = new THREE.MeshBasicMaterial( { color: LIGHT_MODEL } );
					// enable polygon offset to avoid z-fighting with the background model
					c.material.polygonOffset = true;
					c.material.polygonOffsetFactor = 1;
					c.material.polygonOffsetUnits = 1;
					// disable color write to prevent the depth model from affecting the color buffer
					c.material.colorWrite = false;
					// set a lower render order to ensure the depth is rendered before the model
					c.renderOrder = 1;
			}
	} );
	// add the depth model to the scene
	scene.add( depthModel );

}


/**
* Initializes and adds edges to a 3D model displayed in a Three.js scene.
*
* This function removes any previous edges model, clones the original 3D model,
	and adds it to the scene with edges based on the current display settings specified in
	the `params.display` object. The function supports two types
	of edge displays: `'THRESHOLD_EDGES'` and `'OUTSIDE_EDGES'`.
*
* @function
* @global
* @return {void}
*
* @global {Object} params - An object containing various display settings.
* @global {string} params.display - Specifies the type of edge display to use, which can be `'NONE'`, `'THRESHOLD_EDGES'`, or `'OUTSIDE_EDGES'`.
* @global {THREE.Scene} scene - The Three.js scene to which the edges model will be added.
* @global {THREE.Mesh} originalModel - The original 3D model to which edges will be added.
* @global {THREE.Mesh} edgesModel - The cloned 3D model with edges that will be added to the scene.
*/
function initEdgesModel() {
	// Remove any previous edges model and dispose of its materials
	if (edgesModel) {
		edgesModel.parent.remove(edgesModel);
		edgesModel.traverse((c) => {
			if (c.isMesh) {
				if (Array.isArray(c.material)) {
					c.material.forEach((m) => m.dispose());
				} else {
					c.material.dispose();
				}
			}
		});
	}

	// If there's no original model, exit early
	if (!originalModel) {
		return;
	}

	// Clone the original model and add it to the scene
	edgesModel = originalModel.clone();
	scene.add(edgesModel);

	// If edge display is disabled, hide the edges model and exit early
	if (params.display === "NONE") {
		edgesModel.visible = false;
		return;
	}

	// Traverse the cloned model and find all meshes
	const meshes = [];
	edgesModel.traverse((c) => {
		if (c.isMesh) {
			meshes.push(c);
		}
	});

	// For each mesh, compute the appropriate edge geometry and add it to the scene
	for (const key in meshes) {
		const mesh = meshes[key];
		const parent = mesh.parent;

		let lineGeom;
		if (params.display === "THRESHOLD_EDGES") {
			// Compute threshold edges
			lineGeom = new THREE.EdgesGeometry(mesh.geometry, params.threshold);
		} else {
			// Compute outside edges
			const mergeGeom = mesh.geometry.clone();
			mergeGeom.deleteAttribute("uv");
			mergeGeom.deleteAttribute("uv2");
			lineGeom = new OutsideEdgesGeometry(
				BufferGeometryUtils.mergeVertices(mergeGeom, 1e-3)
			);
		}

		// Add thin and thick line segments to the scene
		const line = new THREE.LineSegments(
			lineGeom,
			new THREE.LineBasicMaterial({ color: LIGHT_LINES })
		);
		line.position.copy(mesh.position);
		line.scale.copy(mesh.scale);
		line.rotation.copy(mesh.rotation);

		const thickLineGeom = new LineSegmentsGeometry().fromEdgesGeometry(
			lineGeom
		);
		const thickLines = new LineSegments2(
			thickLineGeom,
			new LineMaterial({ color: LIGHT_LINES, linewidth: 3 })
		);
		thickLines.position.copy(mesh.position);
		thickLines.scale.copy(mesh.scale);
		thickLines.rotation.copy(mesh.rotation);

		// Replace the original mesh with the thin and thick line segments
		parent.remove(mesh);
		parent.add(line);
		parent.add(thickLines);
	}
}


/**
 * Initializes the conditional model by creating line segment objects for each mesh in the loaded model.
 * If a conditional model already exists, it is removed along with its associated materials.
 * If no original model is loaded, the function exits.
*/
function initConditionalModel() {

	// Remove the original conditional model, if it exists
	if ( conditionalModel ) {

			conditionalModel.parent.remove( conditionalModel );

			// Dispose all materials used by the conditional model
			conditionalModel.traverse( c => {

					if ( c.isMesh ) {

							c.material.dispose();

					}

			} );

	}

	// If no original model is loaded, exit
	if ( ! originalModel ) {

			return;

	}

	// Clone the original model and add it to the scene
	conditionalModel = originalModel.clone();
	scene.add( conditionalModel );
	conditionalModel.visible = false;

	// Get all meshes in the conditional model
	const meshes = [];
	conditionalModel.traverse( c => {

			if ( c.isMesh ) {

					meshes.push( c );

			}

	} );

	// Loop through all meshes and create line segment objects for each
	for ( const key in meshes ) {

			const mesh = meshes[ key ];
			const parent = mesh.parent;

			// Remove everything but the position attribute from the mesh's geometry
			const mergedGeom = mesh.geometry.clone();
			for ( const key in mergedGeom.attributes ) {

					if ( key !== 'position' ) {

							mergedGeom.deleteAttribute( key );

					}

			}

			// Create the conditional edges geometry and associated material
			const lineGeom = new ConditionalEdgesGeometry( BufferGeometryUtils.mergeVertices( mergedGeom ) );
			const material = new THREE.ShaderMaterial( ConditionalEdgesShader );
			material.uniforms.diffuse.value.set( LIGHT_LINES );

			// Create the line segment objects and replace the mesh with them
			const line = new THREE.LineSegments( lineGeom, material );
			line.position.copy( mesh.position );
			line.scale.copy( mesh.scale );
			line.rotation.copy( mesh.rotation );

			const thickLineGeom = new ConditionalLineSegmentsGeometry().fromConditionalEdgesGeometry( lineGeom );
			const thickLines = new LineSegments2( thickLineGeom, new ConditionalLineMaterial( { color: LIGHT_LINES, linewidth: 2 } ) );
			thickLines.position.copy( mesh.position );
			thickLines.scale.copy( mesh.scale );
			thickLines.rotation.copy( mesh.rotation );

			parent.remove( mesh );
			parent.add( line );
			parent.add( thickLines );

	}

}


function init() {

	// initialize renderer, scene, camera
	scene = new THREE.Scene();
	scene.background = new THREE.Color( LIGHT_BACKGROUND );

	camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 0.1, 2000 );
	camera.position.set( -1, 0.5, 50 ).multiplyScalar( 0.75 );
	scene.add( camera );

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	composer = new EffectComposer( renderer );
	renderPixelatedPass = new RenderPixelatedPass( 10 , scene, camera );
	renderPixelatedPass.setPixelSize( params.pixelSize );
	composer.addPass( renderPixelatedPass );

	document.body.appendChild( renderer.domElement );

	// Floor
	floor = new THREE.Mesh(
		new THREE.PlaneGeometry(),
		new THREE.ShadowMaterial( { color: LIGHT_LINES, opacity: 0.25, transparent: true } )
	);
	floor.rotation.x = - Math.PI / 2;
	floor.scale.setScalar( 20 );
	floor.receiveShadow = true;
	scene.add( floor );

	// Lights
	const dirLight = new THREE.DirectionalLight( 0xffffff, 1.0 );
	dirLight.position.set( 5, 10, 5 );
	dirLight.castShadow = true;
	dirLight.shadow.bias = -1e-10;
	dirLight.shadow.mapSize.width = 2048;
	dirLight.shadow.mapSize.height = 2048;

	window.dirLight = dirLight;

	const shadowCam = dirLight.shadow.camera;
	shadowCam.left = shadowCam.bottom = -1;
	shadowCam.right = shadowCam.top = 1;

	scene.add( dirLight );

	const cylinder = new THREE.Group();
	cylinder.add( new THREE.Mesh( new THREE.CylinderGeometry( 0.25, 0.25, 0.5, 100 ) ) );
	cylinder.children[ 0 ].geometry.computeBoundingBox();


	cylinder.children[ 0 ].castShadow = true;
	models.CYLINDER = cylinder;


	models.TEST = null;
	new GLTFLoader().load(
		'models/basic-test.glb',
		gltf => {

			gltf.scene.traverse( function ( child ) {
				// console.log('child', child)
				if(child.isBone){
					bones.push(child)
				}
				if(child.isSkinnedMesh){
					skinnedMesh = child;
				}
				})

				console.log('bones', bones);

				skeleton = new THREE.Skeleton( bones );
				console.log('skeleton', skeleton);
				if(skinnedMesh){
				skinnedMesh.add(bones[0])
				skinnedMesh.bind(skeleton);


				console.log('SkinnedMesh', skinnedMesh);

				}

			if(skinnedMesh){
			const skeletonHelper = new THREE.SkeletonHelper( skinnedMesh );
			skeletonHelper.material.linewidth = 2;

			scene.add(skeletonHelper)
			}

			const model = mergeObject( gltf.scene );

			model.children[ 0 ].geometry.computeBoundingBox();
			model.children[ 0 ].castShadow = true;

			models.TEST = model;

			initGui();
			updateModel();

		}
	);



	// camera controls
	controls = new OrbitControls( camera, renderer.domElement );
	controls.maxDistance = 200;

	window.addEventListener( 'resize', onWindowResize, false );

	initGui();

}

function initGui() {

	if ( gui ) {

		gui.destroy();

	}

	// dat gui
	gui = new dat.GUI();
	gui.width = 300;
	gui.add( params, 'colors', [ 'LIGHT', 'DARK', 'CUSTOM' ] );
	gui.addColor( params, 'backgroundColor' );
	gui.addColor( params, 'modelColor' );
	gui.addColor( params, 'lineColor' );
	gui.addColor( params, 'shadowColor' );
	gui.add( params, 'randomize' );

	const modelFolder = gui.addFolder( 'model' );

	modelFolder.add( params, 'model', Object.keys( models ) ).onChange( updateModel );

	modelFolder.add( params, 'opacity' ).min( 0 ).max( 1.0 ).step( 0.01 );

	modelFolder.add( params, 'lit' );

	modelFolder.open();

	const linesFolder = gui.addFolder( 'conditional lines' );

	linesFolder.add( params, 'threshold' )
		.min( 0 )
		.max( 120 )
		.onChange( initEdgesModel );

	linesFolder.add( params, 'display', [
		'THRESHOLD_EDGES',
		'NORMAL_EDGES',
		'NONE',
	] ).onChange( initEdgesModel );

	linesFolder.add( params, 'displayConditionalEdges' );

	linesFolder.add( params, 'useThickLines' );

	linesFolder.add( params, 'thickness', 0, 5 );


	const renderFolder = gui.addFolder( 'pixelated pass' );
	renderFolder.add( params, 'displayPixelPass');
	gui.add( params, 'pixelSize' ).min( 1 ).max( 16 ).step( 1 )
	.onChange( () => {

		renderPixelatedPass.setPixelSize( params.pixelSize );

	} );

	// for ( let i = 0; i < bones.length; i ++ ) {

	// 	const bone = bones[ i ];
	// 	let folder = gui.addFolder(  bone.name );

	// 	folder.add( bone.position, 'x', - 10 + bone.position.x, 10 + bone.position.x ).name( 'position.x' ).onChange( () => {	console.log('pos', bone.position.x) })	;
	// 	folder.add( bone.position, 'y', - 10 + bone.position.y, 10 + bone.position.y ).name( 'position.y');
	// 	folder.add( bone.position, 'z', - 10 + bone.position.z, 10 + bone.position.z ).name( 'position.z');

	// 	folder.add( bone.rotation, 'x', - Math.PI * 0.5, Math.PI * 0.5 ).name('rotation.x').onChange( () => {
	// 		// skeleton.update();
	// 		// console.log('rot', bone.rotation.x)
	// 	});
	// 	folder.add( bone.rotation, 'y', - Math.PI * 0.5, Math.PI * 0.5 ).name('rotation.y');
	// 	folder.add( bone.rotation, 'z', - Math.PI * 0.5, Math.PI * 0.5 ).name('rotation.z');

	// 	folder.add( bone.scale, 'x', 0, 2 ).name('scale.x');
	// 	folder.add( bone.scale, 'y', 0, 2 ).name('scale.y');
	// 	folder.add( bone.scale, 'z', 0, 2 ).name('scale.z');

	// }

}

function onWindowResize() {

	var width = window.innerWidth;
	var height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize( width, height );
	renderer.setPixelRatio( window.devicePixelRatio );

}

function animate() {

	requestAnimationFrame( animate );

	const time = Date.now() * 0.001;

	if(skinnedMesh) {
		for ( let i = 0; i < skinnedMesh.skeleton.bones.length; i ++ ) {

			skinnedMesh.skeleton.bones[ i ].rotation.z = Math.sin( time ) * 2 / skinnedMesh.skeleton.bones.length;
			// console.log('rot', skinnedMesh.skeleton.bones[ i ].rotation.z)
		}
	}


	let linesColor = LIGHT_LINES;
	let modelColor = LIGHT_MODEL;
	let backgroundColor = LIGHT_BACKGROUND;
	let shadowColor = LIGHT_SHADOW;

	if ( params.colors === 'DARK' ) {

		linesColor = DARK_LINES;
		modelColor = DARK_MODEL;
		backgroundColor = DARK_BACKGROUND;
		shadowColor = DARK_SHADOW;

	} else if ( params.colors === 'CUSTOM' ) {

		linesColor = params.lineColor;
		modelColor = params.modelColor;
		backgroundColor = params.backgroundColor;
		shadowColor = params.shadowColor;

	}

	if ( conditionalModel ) {

		conditionalModel.visible = params.displayConditionalEdges;
		conditionalModel.traverse( c => {

			if ( c.material && c.material.resolution ) {

				renderer.getSize( c.material.resolution );
				c.material.resolution.multiplyScalar( window.devicePixelRatio );
				c.material.linewidth = params.thickness;

			}

			if ( c.material ) {

				c.visible = c instanceof LineSegments2 ? params.useThickLines : ! params.useThickLines;
				c.material.uniforms.diffuse.value.set( linesColor );

			}

		} );

	}


	if ( edgesModel ) {

		edgesModel.traverse( c => {

			if ( c.material && c.material.resolution ) {

				renderer.getSize( c.material.resolution );
				c.material.resolution.multiplyScalar( window.devicePixelRatio );
				c.material.linewidth = params.thickness;

			}

			if ( c.material ) {

				c.visible = c instanceof LineSegments2 ? params.useThickLines : ! params.useThickLines;
				c.material.color.set( linesColor );

			}

		} );

	}

	if ( backgroundModel ) {

		backgroundModel.visible = ! params.lit;
		backgroundModel.traverse( c => {

			if ( c.isMesh ) {

				c.material.transparent = params.opacity !== 1.0;
				c.material.opacity = params.opacity;
				c.material.color.set( modelColor );

			}

		} );

	}

	if ( shadowModel ) {

		shadowModel.visible = params.lit;
		shadowModel.traverse( c => {

			if ( c.isMesh ) {

				c.material.transparent = params.opacity !== 1.0;
				c.material.opacity = params.opacity;
				c.material.color.set( modelColor );
				c.material.shadowColor.set( shadowColor );

			}

		} );

	}

	if ( originalModel ) {

		floor.position.y = originalModel.children[ 0 ].geometry.boundingBox.min.y;

	}

	if(params.displayPixelPass){
	const rendererSize = renderer.getSize( new THREE.Vector2() );
	const aspectRatio = rendererSize.x / rendererSize.y;

	pixelAlignFrustum( camera, aspectRatio, Math.floor( rendererSize.x /6 ),
		Math.floor( rendererSize.y / 6 ) );
	}

	scene.background.set( backgroundColor );
	floor.material.color.set( shadowColor );
	floor.material.opacity = params.opacity;
	floor.visible = params.lit;

	render();

}

function pixelAlignFrustum( camera, aspectRatio, pixelsPerScreenWidth, pixelsPerScreenHeight ) {

	// 0. Get Pixel Grid Units
	const worldScreenWidth = ( ( camera.right - camera.left ) / camera.zoom );
	const worldScreenHeight = ( ( camera.top - camera.bottom ) / camera.zoom );
	const pixelWidth = worldScreenWidth / pixelsPerScreenWidth;
	const pixelHeight = worldScreenHeight / pixelsPerScreenHeight;

	// 1. Project the current camera position along its local rotation bases
	const camPos = new THREE.Vector3(); camera.getWorldPosition( camPos );
	const camRot = new THREE.Quaternion(); camera.getWorldQuaternion( camRot );
	const camRight = new THREE.Vector3( 1.0, 0.0, 0.0 ).applyQuaternion( camRot );
	const camUp = new THREE.Vector3( 0.0, 1.0, 0.0 ).applyQuaternion( camRot );
	const camPosRight = camPos.dot( camRight );
	const camPosUp = camPos.dot( camUp );

	// 2. Find how far along its position is along these bases in pixel units
	const camPosRightPx = camPosRight / pixelWidth;
	const camPosUpPx = camPosUp / pixelHeight;

	// 3. Find the fractional pixel units and convert to world units
	const fractX = camPosRightPx - Math.round( camPosRightPx );
	const fractY = camPosUpPx - Math.round( camPosUpPx );

	// 4. Add fractional world units to the left/right top/bottom to align with the pixel grid
	camera.left = - aspectRatio - ( fractX * pixelWidth );
	camera.right = aspectRatio - ( fractX * pixelWidth );
	camera.top = 1.0 - ( fractY * pixelHeight );
	camera.bottom = - 1.0 - ( fractY * pixelHeight );
	camera.updateProjectionMatrix();

}

function render() {

	if(params.displayPixelPass){
		composer.render();
		return
	}

	renderer.render( scene, camera );

}


// document.addEventListener('mousemove', function(e) {
// 	console.log('move')
// 	bones[1].position.set(0,0, e.clientX / 100);
// 	bones[1].rotation.x = e.clientX / 100;
// });
