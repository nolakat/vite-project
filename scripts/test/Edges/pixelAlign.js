import * as THREE from 'three';

export function pixelAlignFrustum( camera, aspectRatio, pixelsPerScreenWidth, pixelsPerScreenHeight ) {


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
