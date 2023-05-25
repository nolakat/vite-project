import * as THREE from 'three';
import { ColoredShadowMaterial } from '../ColoredShadowMaterial.js';



/**
*	Initializes the background, shadow, and depth models for a given Three.js scene
*/
export function initBackgroundModel( scene, originalModel, backgroundModel, shadowModel, depthModel, colors) {

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
					c.material = new THREE.MeshBasicMaterial( { color: colors.LIGHT_MODEL } );
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
	// shadowModel = originalModel.clone();
	// shadowModel.traverse( c => {
	// 		// set the material of each mesh to a colored shadow material with a light color and some shininess
	// 		if ( c.isMesh ) {
	// 				// c.material = new ColoredShadowMaterial( { color: colors.LIGHT_MODEL, shininess: 1.0 } );
	// 				// enable polygon offset to avoid z-fighting with the depth model
	// 				c.material.polygonOffset = true;
	// 				c.material.polygonOffsetFactor = 1;
	// 				c.material.polygonOffsetUnits = 1;
	// 				// set the mesh to receive shadows
	// 				c.receiveShadow = true;
	// 				// set a higher render order to ensure the shadow is rendered after the model
	// 				c.renderOrder = 2;
	// 		}
	// } );
	// add the shadow model to the scene
  //this messed up the model
	// scene.add( shadowModel );

	// create a new depth model
	depthModel = originalModel.clone();
	depthModel.traverse( c => {
			// set the material of each mesh to a basic mesh material with a light color and disable color write
			if ( c.isMesh ) {
					c.material = new THREE.MeshBasicMaterial( { color: colors.LIGHT_MODEL } );
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

  return { backgroundModel, depthModel };

}
