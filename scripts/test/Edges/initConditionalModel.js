
import * as THREE from 'three';

import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { ConditionalEdgesGeometry } from '../ConditionalEdgesGeometry.js';
import { ConditionalEdgesShader } from '../ConditionalEdgesShader.js';
import { ConditionalLineSegmentsGeometry } from '../Lines2/ConditionalLineSegmentsGeometry.js';
import { ConditionalLineMaterial } from '../Lines2/ConditionalLineMaterial.js';

import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';

/**
 * Initializes the conditional model by creating line segment objects for each mesh in the loaded model.
 * If a conditional model already exists, it is removed along with its associated materials.
 * If no original model is loaded, the function exits.
*/
export function initConditionalModel(conditionalModel, originalModel, scene, colors) {

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
			material.uniforms.diffuse.value.set( colors.LIGHT_LINES );

			// Create the line segment objects and replace the mesh with them
			const line = new THREE.LineSegments( lineGeom, material );
			line.position.copy( mesh.position );
			line.scale.copy( mesh.scale );
			line.rotation.copy( mesh.rotation );

			const thickLineGeom = new ConditionalLineSegmentsGeometry().fromConditionalEdgesGeometry( lineGeom );
			const thickLines = new LineSegments2( thickLineGeom, new ConditionalLineMaterial( { color: colors.LIGHT_LINES, linewidth: 2 } ) );
			thickLines.position.copy( mesh.position );
			thickLines.scale.copy( mesh.scale );
			thickLines.rotation.copy( mesh.rotation );

			parent.remove( mesh );
			parent.add( line );
			parent.add( thickLines );
	}

  console.log('conditional mode', conditionalModel )

  return conditionalModel;


}
