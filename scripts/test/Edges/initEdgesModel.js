import * as THREE from 'three';

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
export function initEdgesModel(params, scene, originalModel, edgesModel) {

  console.log('initEdgesModel');
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
