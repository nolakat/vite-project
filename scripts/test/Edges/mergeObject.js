import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merges the geometries of all meshes within an object into a single mesh,
 * centering it and returning a group containing the mesh.
 *
 * @param {THREE.Object3D} object - The object whose mesh geometries will be merged.
 * @returns {THREE.Group} A group containing the merged mesh.
 */
export function mergeObject(object) {

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
