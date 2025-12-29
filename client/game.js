function createBulletTracer() {
	const start = new THREE.Vector3();
	if (weaponModel) {
		const barrelOffset = new THREE.Vector3(0, 0.05, -0.35);
		weaponModel.localToWorld(barrelOffset);
		start.copy(barrelOffset);
	} else {
		camera.getWorldPosition(start);
	}
	const direction = new THREE.Vector3(0, 0, -1);
	direction.applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
	const end = start.clone().add(direction.multiplyScalar(50));
	const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
	const material = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
	const tracer = new THREE.Line(geometry, material);
	scene.add(tracer);
	bullets.push(tracer);
	setTimeout(() => {
		scene.remove(tracer);
		geometry.dispose();
		material.dispose();
		const index = bullets.indexOf(tracer);
		if (index > -1) bullets.splice(index, 1);
	}, 50);
}