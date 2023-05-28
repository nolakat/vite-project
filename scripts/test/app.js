
import * as THREE from 'three';
import {params, colors, state } from './params.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { initEdgesModel } from './Edges/initEdgesModel.js';
import { pixelAlignFrustum } from './Edges/pixelAlign.js';
import { mergeObject } from './Edges/mergeObject.js';
import { initBackgroundModel } from './Edges/initBackgroundModel.js';


import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
import { initConditionalModel } from './Edges/initConditionalModel.js';


let gui, scene, camera, renderer, orbit, lights, composer, renderPixelatedPass, mesh, skeleton, floor, bones, skeletonHelper;

let edgesModel, originalModel, backgroundModel, conditionalModel, shadowModel, depthModel;

const models = {};
const color = new THREE.Color();
const color2 = new THREE.Color();

function initScene() {

  gui = new GUI();

	//setup scene
  scene = new THREE.Scene();
	scene.background = new THREE.Color( colors.LIGHT_BACKGROUND );

	//setup camera
  camera = new THREE.PerspectiveCamera( 76, window.innerWidth / window.innerHeight, 0.1, 200 );
  camera.position.set( -1, 0.5, 50 ).multiplyScalar( .45 );
	scene.add( camera );

	//setup renderer
  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	//setup composer
	composer = new EffectComposer( renderer );
	renderPixelatedPass = new RenderPixelatedPass( 10 , scene, camera );
	renderPixelatedPass.setPixelSize( params.pixelSize );
	composer.addPass( renderPixelatedPass );

	//add renderer to dom
  document.body.appendChild( renderer.domElement );

  //setup orbit controls
  orbit = new OrbitControls( camera, renderer.domElement );
  orbit.enableZoom = false;

  //setup lights
  lights = [];
  lights[ 0 ] = new THREE.PointLight( 0xffffff, 1, 0 );
  lights[ 1 ] = new THREE.PointLight( 'red', .3, 0 );
  lights[ 2 ] = new THREE.PointLight( 'lightblue', 1, 0 );

  lights[ 0 ].position.set( 0, 200, 0 );
  lights[ 1 ].position.set( 100, 200, 100 );
  lights[ 2 ].position.set( - 100, - 200, - 100 );

  // scene.add( lights[ 0 ] );
  scene.add( lights[ 1 ] );
  scene.add( lights[ 2 ] );

  //setup floor
	floor = new THREE.Mesh(
		new THREE.PlaneGeometry(),
		new THREE.ShadowMaterial( { color: colors.LIGHT_LINES, opacity: 0.25, transparent: true } )
	);
	floor.rotation.x = - Math.PI / 2;
	floor.scale.setScalar( 20 );
	floor.receiveShadow = true;
	scene.add( floor );

  initModel();


}

function initModel(){
  new GLTFLoader().load(
    'models/bud-test.glb',
    gltf => {
      bones = [];
      gltf.scene.traverse( function ( child ) {
        if(child.isBone){
          bones.push(child)
        }
        if(child.isSkinnedMesh){
          mesh = child;
        }
       })


      if(params.mode == 'TOON'){
        originalModel =  gltf.scene;
      } else {
        //mergeObject is messing with animation data.  Need to figure out how to merge without messing with animation data
        originalModel = mergeObject( gltf.scene );
      }

       setMesh(mesh, bones);
    }
  );
}

function setMesh(mesh, bones){
  // mesh.scale.multiplyScalar( 2 );

if(params.mode == 'TOON'){
  var toonMaterial = new THREE.MeshToonMaterial( {
    color: 'lightblue',
    side: THREE.DoubleSide
  } );

  mesh.material = toonMaterial;
}

  mesh.add( bones[ 0 ] );
  skeletonHelper = new THREE.SkeletonHelper( mesh );
  if(params.displaySkeleton){
    scene.add( skeletonHelper );
  }


  setupDatGui();

  if(params.mode == 'LINES'){
    updateModel();
  } else {
    scene.add(mesh)
  }

}

function updateModel() {

  // console.log('originalModel', originalModel);
  edgesModel = initEdgesModel(params, colors, scene, originalModel, edgesModel);
  const obj = initBackgroundModel ( scene,originalModel, backgroundModel, shadowModel, depthModel, colors);
  backgroundModel = obj.backgroundModel;
  depthModel = obj.depthModel;

  conditionalModel = initConditionalModel( conditionalModel, originalModel, scene, colors)

  console.log('conditionalModel', conditionalModel);
}

function setupDatGui() {


	// if ( gui ) {
	// 	gui.destroy();
	// }

  gui.add( params, 'colors', [ 'LIGHT', 'DARK', 'CUSTOM' ] );
  gui.addColor( params, 'backgroundColor' );
	gui.addColor( params, 'modelColor' );
	gui.addColor( params, 'lineColor' );
	gui.addColor( params, 'shadowColor' );
  gui.add(params, 'mode', [ 'TOON', 'LINES']).onChange( ()=> {
    scene.remove(mesh);
    scene.remove( skeletonHelper );

    initModel();
  });
  gui.add(params, 'displaySkeleton').onChange( ()=> {
    if(params.displaySkeleton){
      scene.add( skeletonHelper );
    } else {
      scene.remove( skeletonHelper );
    }
  })

  let modelFolder = gui.addFolder('Model')

  modelFolder.add( params, 'opacity' ).min( 0 ).max( 1.0 ).step( 0.01 );


  const linesFolder = gui.addFolder( 'conditional lines' );
	linesFolder.add( params, 'threshold' )
		.min( 0 )
		.max( 120 )
		.onChange( ()=>{
     edgesModel = initEdgesModel(params, colors, scene, originalModel, edgesModel);
    } );

  	linesFolder.add( params, 'display', [
      'THRESHOLD_EDGES',
      'NORMAL_EDGES',
      'NONE',
    ] ).onChange( ()=>{
      edgesModel = initEdgesModel(params, colors, scene, originalModel, edgesModel);
    } );

    linesFolder.add( params, 'displayConditionalEdges' );

    linesFolder.add( params, 'useThickLines' );

    linesFolder.add( params, 'thickness', 0, 5 );

    const renderFolder = gui.addFolder( 'pixelated pass' );
    renderFolder.add( params, 'displayPixelPass');
    gui.add( params, 'pixelSize' ).min( 1 ).max( 16 ).step( 1 )
    .onChange( () => {
      renderPixelatedPass.setPixelSize( params.pixelSize );
    } );



  let folder = gui.addFolder( 'General Options' );

  folder.add( state, 'animateBones' );
  folder.controllers[ 0 ].name( 'Animate Bones' );

  folder.add( mesh, 'pose' );
  folder.controllers[ 1 ].name( '.pose()' );

  const bones = mesh.skeleton.bones;

}

function setColors() {
	let linesColor = colors.LIGHT_LINES;
	let modelColor = colors.LIGHT_MODEL;
	let backgroundColor = colors.LIGHT_BACKGROUND;
	let shadowColor = colors.LIGHT_SHADOW;

	if ( params.colors === 'DARK' ) {
		linesColor = colors.DARK_LINES;
		modelColor = colors.DARK_MODEL;
		backgroundColor = colors.DARK_BACKGROUND;
		shadowColor = colors.DARK_SHADOW;

	} else if ( params.colors === 'CUSTOM' ) {
		linesColor = params.lineColor;
		modelColor = params.modelColor;
		backgroundColor = params.backgroundColor;
		shadowColor = params.shadowColor;
	}

  scene.background.set( backgroundColor );
	floor.material.color.set( shadowColor );
}

function animate(){
  requestAnimationFrame( animate );
  let linesColor = colors.LIGHT_LINES;
	let modelColor = colors.LIGHT_MODEL;
	let backgroundColor = colors.LIGHT_BACKGROUND;
	let shadowColor = colors.LIGHT_SHADOW;

  if(params.displayPixelPass){
    const rendererSize = renderer.getSize( new THREE.Vector2() );
    const aspectRatio = rendererSize.x / rendererSize.y;

    pixelAlignFrustum( camera, aspectRatio, Math.floor( rendererSize.x /6 ),
    Math.floor( rendererSize.y / 6 ) );
  }

  if ( conditionalModel ) {
    console.log('a')

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


  setColors();
	floor.material.opacity = params.opacity;
	floor.visible = params.lit;

  render();
}

function render() {

  requestAnimationFrame( render );

  const time = Date.now() * 0.001;

  //Wiggle the bones
  if ( state.animateBones ) {

    for ( let i = 0; i < mesh.skeleton.bones.length; i ++ ) {

        // Get the current bone in the loop
        const bone = mesh.skeleton.bones[i];

        // Calculate the rotation angle based on the current time and the number of bones in the skeleton
        const angle = Math.sin(time) * .75 / mesh.skeleton.bones.length;



        // Set the bone's rotation around the z-axis to the calculated angle
        bone.rotation.z = angle;
        if(params.mode === 'LINES'){
          edgesModel.rotation.z = angle;
          backgroundModel.rotation.z = angle;
          depthModel.rotation.z = angle;
        }



    }
  }

  if(params.displayPixelPass){
		composer.render();
		return
	}

  renderer.render( scene, camera );

}

document.addEventListener('mousemove', function(e) {
  const x = e.clientX;
  // append x position to DOM
  document.getElementById('cursor-helper').innerHTML = `X: ${x}`;
});

window.addEventListener( 'resize', function () {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}, false );



initScene();
animate();
// render();
