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
				opacity: 0.85,
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

			const models = {};
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

			function mergeObject( object ) {

				object.updateMatrixWorld( true );

				const geometry = [];
				object.traverse( c => {

					if ( c.isMesh ) {

						const g = c.geometry;
						g.applyMatrix4( c.matrixWorld );
						for ( const key in g.attributes ) {

							if ( key !== 'position' && key !== 'normal' ) {

								g.deleteAttribute( key );

							}

						}
						geometry.push( g.toNonIndexed() );

					}

				} );

				const mergedGeometries = BufferGeometryUtils.mergeBufferGeometries( geometry, false );
				const mergedGeometry = BufferGeometryUtils.mergeVertices( mergedGeometries ).center();

				const group = new THREE.Group();
				const mesh = new THREE.Mesh( mergedGeometry );
				group.add( mesh );
				return group;

			}

			function initBackgroundModel() {

				if ( backgroundModel ) {

					backgroundModel.parent.remove( backgroundModel );
					shadowModel.parent.remove( shadowModel );
					depthModel.parent.remove( depthModel );

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

				if ( ! originalModel ) {

					return;

				}

				backgroundModel = originalModel.clone();
				backgroundModel.traverse( c => {

					if ( c.isMesh ) {

						c.material = new THREE.MeshBasicMaterial( { color: LIGHT_MODEL } );
						c.material.polygonOffset = true;
						c.material.polygonOffsetFactor = 1;
						c.material.polygonOffsetUnits = 1;
						c.renderOrder = 2;

					}

				} );
				scene.add( backgroundModel );

				shadowModel = originalModel.clone();
				shadowModel.traverse( c => {

					if ( c.isMesh ) {

						c.material = new ColoredShadowMaterial( { color: LIGHT_MODEL, shininess: 1.0 } );
						c.material.polygonOffset = true;
						c.material.polygonOffsetFactor = 1;
						c.material.polygonOffsetUnits = 1;
						c.receiveShadow = true;
						c.renderOrder = 2;

					}

				} );
				scene.add( shadowModel );

				depthModel = originalModel.clone();
				depthModel.traverse( c => {

					if ( c.isMesh ) {

						c.material = new THREE.MeshBasicMaterial( { color: LIGHT_MODEL } );
						c.material.polygonOffset = true;
						c.material.polygonOffsetFactor = 1;
						c.material.polygonOffsetUnits = 1;
						c.material.colorWrite = false;
						c.renderOrder = 1;

					}

				} );
				scene.add( depthModel );

			}

			function initEdgesModel() {

				// remove any previous model
				if ( edgesModel ) {

					edgesModel.parent.remove( edgesModel );
					edgesModel.traverse( c => {

						if ( c.isMesh ) {

							if ( Array.isArray( c.material ) ) {

								c.material.forEach( m => m.dispose() );

							} else {

								c.material.dispose();

							}

						}

					} );

				}

				// early out if there's no model loaded
				if ( ! originalModel ) {

					return;

				}

				// store the model and add it to the scene to display
				// behind the lines
				edgesModel = originalModel.clone();
				scene.add( edgesModel );

				// early out if we're not displaying any type of edge
				if ( params.display === 'NONE' ) {

					edgesModel.visible = false;
					return;

				}

				const meshes = [];
				edgesModel.traverse( c => {

					if ( c.isMesh ) {

						meshes.push( c );

					}

				} );

				for ( const key in meshes ) {

					const mesh = meshes[ key ];
					const parent = mesh.parent;

					let lineGeom;
					if ( params.display === 'THRESHOLD_EDGES' ) {

						lineGeom = new THREE.EdgesGeometry( mesh.geometry, params.threshold );

					} else {

						const mergeGeom = mesh.geometry.clone();
						mergeGeom.deleteAttribute( 'uv' );
						mergeGeom.deleteAttribute( 'uv2' );
						lineGeom = new OutsideEdgesGeometry( BufferGeometryUtils.mergeVertices( mergeGeom, 1e-3 ) );

					}

					const line = new THREE.LineSegments( lineGeom, new THREE.LineBasicMaterial( { color: LIGHT_LINES } ) );
					line.position.copy( mesh.position );
					line.scale.copy( mesh.scale );
					line.rotation.copy( mesh.rotation );

					const thickLineGeom = new LineSegmentsGeometry().fromEdgesGeometry( lineGeom );
					const thickLines = new LineSegments2( thickLineGeom, new LineMaterial( { color: LIGHT_LINES, linewidth: 3 } ) );
					thickLines.position.copy( mesh.position );
					thickLines.scale.copy( mesh.scale );
					thickLines.rotation.copy( mesh.rotation );

					parent.remove( mesh );
					parent.add( line );
					parent.add( thickLines );

				}

			}

			function initConditionalModel() {

				// remove the original model
				if ( conditionalModel ) {

					conditionalModel.parent.remove( conditionalModel );
					conditionalModel.traverse( c => {

						if ( c.isMesh ) {

							c.material.dispose();

						}

					} );

				}

				// if we have no loaded model then exit
				if ( ! originalModel ) {

					return;

				}

				conditionalModel = originalModel.clone();
				scene.add( conditionalModel );
				conditionalModel.visible = false;

				// get all meshes
				const meshes = [];
				conditionalModel.traverse( c => {

					if ( c.isMesh ) {

						meshes.push( c );

					}

				} );

				for ( const key in meshes ) {

					const mesh = meshes[ key ];
					const parent = mesh.parent;

					// Remove everything but the position attribute
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

					// Create the line segments objects and replace the mesh
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
				camera.position.set( -1, 0.5, 2 ).multiplyScalar( 0.75 );
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
					'models/obj-pot-plant.glb',
					gltf => {

						const model = mergeObject( gltf.scene );
						model.children[ 0 ].geometry.computeBoundingBox();
						model.children[ 0 ].castShadow = true;

						models.TEST = model;
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

				linesFolder.open();

				const renderFolder = gui.addFolder( 'pixelated pass' );
				renderFolder.add( params, 'displayPixelPass');
				gui.add( params, 'pixelSize' ).min( 1 ).max( 16 ).step( 1 )
				.onChange( () => {

					renderPixelatedPass.setPixelSize( params.pixelSize );

				} );
				renderFolder.open();

				gui.open();

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
