(async () => {
	const theModel = {
		"name": "Vanguard",
		"path": "model/Vanguard.fbx",
		"type": "fbx",
		"isBuildIn": true,
		"picBg": "model/Vanguard.png"
	};
	var app = new Vue({
		el: "#vue-target",
		data: {
			model: theModel,
			color: '#ff0000',
			bgcolor: '#ffffff',
			textColor: '#0000ff',
			showSetting: false,
			cameraDistance: 3,
			doublePlayer: false,
			bones: [],
			showOpts: false,
			loaded: false,
			failed: false,
			failedText: "Load failed",
		},
	});
	var player1 = {
		id: 1,
		model: null,
		avatarRotY: 0,
		currentActionName: "idle",
		currentAction: null,
		previousAction: null,
		skeletonHelper: null,
		actions: [],
		animationMixer: null,
		score: 0,
		foot: null
	};
	var player2 = {
		id: 2,
		model: null,
		avatarRotY: 0,
		currentActionName: "idle",
		currentAction: null,
		previousAction: null,
		skeletonHelper: null,
		actions: [],
		animationMixer: null,
		score: 0,
		foot: null
	};

	var clock = new THREE.Clock();
	// gltf and vrm
	var loader = null;
	var bulletArr = [];
	var innerWidth = document.querySelector("#model").clientWidth;
	var innerHeight = document.querySelector("#model").clientHeight;
	const scene = new THREE.Scene();
	var starField;

	let composer;
	const textureLoader = new THREE.TextureLoader();
	document.getElementById("btn_set").onclick = () => {
		if (!app.showSetting) {
			gui.show();
		} else {
			gui.hide();
		}
		app.showSetting = !app.showSetting
	}

	var modal = document.getElementById("myModal");
	document.getElementById("btn_start").onclick = () => {
		modal.style.display = "none";
	}
	/*
	span.onclick = function() {
	  modal.style.display = "none";
	}
	*/


	function setBackground() {
		const geometry = new THREE.BufferGeometry(); // 创建几何体
		const vertices = []; // 用于存储星星位置的数组
		for (let i = 0; i < 5000; i++) { // 根据星星数量生成顶点
			const x = THREE.MathUtils.randFloatSpread(50); // 随机生成x坐标
			const y = THREE.MathUtils.randFloatSpread(50); // 随机生成y坐标
			const z = THREE.MathUtils.randFloatSpread(50); // 随机生成z坐标
			vertices.push(x, y, z); // 将生成的顶点添加到数组中
		}
		console.log(vertices); // 包含3000 个 随机顶点值的数组
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); // 将顶点添加到几何体中
		console.log(geometry.getAttribute('position').count);
		const material = new THREE.PointsMaterial({
			color: 0xffffff,
			size: 0.03
		}); // 创建星星材质
		starField = new THREE.Points(geometry, material); // 创建星星物体
		scene.add(starField);
	}

	function setControll() {
		const controls = new THREE.OrbitControls(
			camera,
			renderer.domElement
		);
		controls.screenSpacePanning = true;
		controls.target.set(0.0, 1.0, 0.0);
		controls.update();

	}

	function setLight() {
		const light = new THREE.AmbientLight(
			0xffffff,
			0.6
		);
		light.position.set(10.0, 10.0, 10.0).normalize();
		scene.add(light);
		var light2 = new THREE.DirectionalLight(
			0xffffff,
			1.5
		);
		light2.position.set(0, 3, -3);
		light2.castShadow = true;
		scene.add(light2);

	}

	function createBox() {
		cubeGeometry = new THREE.BoxGeometry(1, 4, 1);
		cubeMaterial = new THREE.MeshLambertMaterial({
			color: 0xff5500
		});

		cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
		cube.position.x = 3;
		cube.position.y = 0.5;
		cube.position.z = 3;
		//cube.layers.set(1);
		//告诉立方体需要投射阴影
		cube.castShadow = true;

		scene.add(cube);
	}



	function createBullet(pos) {
		const geometry = new THREE.SphereGeometry(0.1, 50, 50);
		//const material = new THREE.MeshBasicMaterial({ map: map });
		const material = new THREE.MeshPhongMaterial({
			color: 0xff0000, // 设置材质颜色
			specular: 0xffffff, // 设置高光颜色
			shininess: 100, // 设置高光强度
			combine: THREE.MixOperation, // 设置环境映射的混合模式
			reflectivity: 3 // 设置材质的反射强度
		});
		let sphere = new THREE.Mesh(geometry, material);;
		sphere.position.x = pos.x + 0;
		sphere.position.y = 1.3;
		sphere.position.z = pos.z + 0.8;
		//sphere.layers.set(1);
		scene.add(sphere);
		var bullet = {};
		bullet.obj = sphere;
		bullet.speed = 0.1;
		bullet.angle = 0;
		bullet.distance = 0;
		bulletArr.push(bullet)
	}


	function loadAvatar(player, pos) {
		return new Promise((resolve, reject) => {
			if (theModel.type == "fbx") {
				loader = new THREE.FBXLoader();
			} else {
				loader = new THREE.GLTFLoader();
			}
			loader.crossOrigin = "anonymous";
			loader.load(
				theModel.path,
				(gltf) => {
					var model = null;
					if (theModel.type == "fbx") {
						model = gltf;
						player.model = model;
						player.model.scale.set(0.01, 0.01, 0.01);
					}
					player.model.position.set(pos.x, pos.y, pos.z);
					player.skeletonHelper = new THREE.SkeletonHelper(player.model);
					player.skeletonHelper.visible = true;
					player.skeletonHelper.material.linewidth = 30;

					scene.add(player.skeletonHelper);

					player.model.castShadow = true;
					player.model.children.forEach(child => {
						child.castShadow = true;
					});
					scene.add(player.model);
					player.avatarRotY = player.model.rotation.y;

					const geometry = new THREE.CircleGeometry(0.6, 32, 0, Math.PI * 2);
					var color = player.id == 1 ? 0xff0000 : 0x0000ff;
					const material = new THREE.MeshBasicMaterial({
						color: color,
						side: THREE.DoubleSide,
						transparent: true,
						opacity: 0.4
					});
					const circle = new THREE.Mesh(geometry, material);
					circle.position.y = 0.1;
					circle.position.x = pos.x;
					circle.position.z = pos.z;
					circle.rotation.x = Math.PI / 2;
					player.circle = circle;
					scene.add(circle);


					resolve(1)
				},

				// called while loading is progressing
				(progress) =>
				console.log(
					"Loading model...", 100.0 * (progress.loaded / progress.total), "%"
				),

				// called when loading has errors
				(error) => {
					reject(1);
					app.failed = true;
					console.log(error);
				}
			);
		});

	}

	function setHelper() {
		// helpers
		const gridHelper = new THREE.GridHelper(50, 50);
		gridHelper.receiveShadow = true;
		scene.add(gridHelper);

		const axesHelper = new THREE.AxesHelper(50);
		scene.add(axesHelper);
	}

	function getCenter(obj) {
		const selectedDecorationBbox = new THREE.Box3().setFromObject(obj);
		var center = new THREE.Vector3();
		let midPoint = selectedDecorationBbox.getCenter(center);
	}

	function loadActions() {
		var loader = new THREE.FBXLoader();
		player1.animationMixer = new THREE.AnimationMixer(player1.model);
		player2.animationMixer = new THREE.AnimationMixer(player2.model);
		loader.load('./model/walkforward.fbx', function(gltf) {
			gltf.animations.forEach((clip) => {
				//console.log(clip)
				player1.actions["walk_forward"] = player1.animationMixer.clipAction(clip);
				player2.actions["walk_forward"] = player2.animationMixer.clipAction(clip);
			});

		});
		loader.load('./model/walkbackward.fbx', function(gltf) {
			gltf.animations.forEach((clip) => {
				//console.log(clip)
				player1.actions["walk_backward"] = player1.animationMixer.clipAction(clip);
				player2.actions["walk_backward"] = player2.animationMixer.clipAction(clip);
			});

		});
		loader.load('./model/walkleft.fbx', function(gltf) {
			gltf.animations.forEach((clip) => {
				//console.log(clip)
				//actions["walk_left"] = animationMixer.clipAction(clip);
				player1.actions["walk_left"] = player1.animationMixer.clipAction(clip);
				player2.actions["walk_left"] = player2.animationMixer.clipAction(clip);
			});

		});
		loader.load('./model/walkright.fbx', function(gltf) {
			gltf.animations.forEach((clip) => {
				//console.log(clip)
				//actions["walk_right"] = animationMixer.clipAction(clip);
				player1.actions["walk_right"] = player1.animationMixer.clipAction(clip);
				player2.actions["walk_right"] = player2.animationMixer.clipAction(clip);
			});

		});
		loader.load('./model/idle.fbx', function(gltf) {
			gltf.animations.forEach((clip) => {
				//console.log(clip)
				//actions["idle"] = animationMixer.clipAction(clip);
				player1.actions["idle"] = player1.animationMixer.clipAction(clip);
				player2.actions["idle"] = player2.animationMixer.clipAction(clip);
			});

		});

		loader.load('./model/jumping.fbx', function(gltf) {
			gltf.animations.forEach((clip) => {
				//console.log(clip)
				//actions["jump"] = animationMixer.clipAction(clip);
				player1.actions["jump"] = player1.animationMixer.clipAction(clip);
				player2.actions["jump"] = player2.animationMixer.clipAction(clip);
			});

		});
		loader.load('./model/shooting.fbx', function(gltf) {
			gltf.animations.forEach((clip) => {
				//console.log(clip)
				//actions["shoot"] = animationMixer.clipAction(clip);
				player1.actions["shoot"] = player1.animationMixer.clipAction(clip);
				player2.actions["shoot"] = player2.animationMixer.clipAction(clip);
			});

		});
		loader.load('./model/death.fbx', function(gltf) {
			gltf.animations.forEach((clip) => {
				//console.log(clip)
				//actions["death"] = animationMixer.clipAction(clip);
				player1.actions["death"] = player1.animationMixer.clipAction(clip);
				player2.actions["death"] = player2.animationMixer.clipAction(clip);
			});

		});
		setTimeout(() => {
			app.loaded = true;
			console.log(player1.actions);
			console.log(player2.actions);
			player1.actions["idle"].play();
			player2.actions["idle"].play();
			player1.currentAction = player1.actions["idle"];
			player1.currentActionName = "idle";
			player2.currentAction = player2.actions["idle"];
			player2.currentActionName = "idle";
		}, 3000)

	}

	function switchAction(player, newActionName, fadeDuration = 0.1) {
		console.log("switch to action " + newActionName, player.id)
		const newAction = player.actions[newActionName];
		if (newAction && player.currentAction !== newAction) {
			player.previousAction = player.currentAction; // 保留当前的动作
			// 淡出前一个动作
			if (player.previousAction) {
				player.previousAction.fadeOut(fadeDuration);
			}

			// 如果切换到 jump 动作，设置播放一次并在结束后停止
			if (newActionName === 'jump' || newActionName === 'death' ||
				newActionName === 'walk_forward' || newActionName === 'shoot' ||
				newActionName === 'walk_backward' || newActionName === 'walk_left' ||
				newActionName === 'walk_right') {
				newAction.loop = THREE.LoopOnce;
				newAction.clampWhenFinished = true; // 停止在最后一帧
			}

			player.currentAction = newAction; // 设置新的活动动作

			// 复位并淡入新动作
			player.currentAction.reset();
			player.currentAction.setEffectiveTimeScale(1);
			player.currentAction.setEffectiveWeight(1);
			player.currentAction.fadeIn(fadeDuration).play();
		}
	}

	function setFloor() {
		var planeGeometry = new THREE.PlaneGeometry(100, 100);
		var planeMaterial = new THREE.MeshStandardMaterial({
			color: 0x999999
		});

		var plane = new THREE.Mesh(planeGeometry, planeMaterial);
		plane.rotation.x = -0.5 * Math.PI;
		plane.position.y = -0;

		//设置平面需要接收阴影
		plane.receiveShadow = true;

		scene.add(plane);
	}



	function toggleShow(k, obj) {
		console.log(k);
		if (
			obj
			.querySelector(".mdui-list-item-content")
			.innerText.includes('hide')
		) {
			scene.getObjectByName(k).visible = false;
			obj.querySelector(".mdui-list-item-content").innerText =
				'show' +
				obj
				.querySelector(".mdui-list-item-content")
				.innerText.substr(
					'hide'.length
				);
		} else {
			scene.getObjectByName(k).visible = true;
			obj.querySelector(".mdui-list-item-content").innerText =
				'hide' +
				obj
				.querySelector(".mdui-list-item-content")
				.innerText.substr(
					'show'.length
				);
		}
	}


	const renderer = new THREE.WebGLRenderer({
		alpha: true,
		antialias: true,
	});
	renderer.shadowMapEnabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setSize(
		document.querySelector("#model").clientWidth,
		document.querySelector("#model").clientHeight
	);
	renderer.outputEncoding = THREE.sRGBEncoding; // 输出编码
	//ReinhardToneMapping
	renderer.toneMapping = THREE.ACESFilmicToneMapping; // 色调映射
	//renderer.toneMapping = THREE.ReinhardToneMapping; // 色调映射
	renderer.toneMappingExposure = 0.9; // 色调映射曝光
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setClearColor(0x000000, 1); //设置背景颜色
	document.querySelector("#model").appendChild(renderer.domElement);




	// camera
	const camera = new THREE.PerspectiveCamera(
		50,
		document.querySelector("#model").clientWidth /
		document.querySelector("#model").clientHeight,
		0.1,
		50.0
	);
	camera.position.set(-1, 3, -10);
	camera.lookAt(0, 0, 0);
	const params = {
		exposure: 0,
		bloomStrength: 1.5,
		bloomThreshold: 0,
		bloomRadius: 0,
	};
	const initComposer = () => {
		composer = new THREE.EffectComposer(renderer);

		const renderScene = new THREE.RenderPass(scene, camera);
		// 光晕
		const bloomPass = new THREE.UnrealBloomPass(
			new THREE.Vector2(document.querySelector("#model").clientWidth, document.querySelector(
					"#model")
				.clientHeight),
			1.5,
			0.4,
			0.85
		);
		bloomPass.threshold = params.bloomThreshold;
		bloomPass.strength = params.bloomStrength;
		bloomPass.radius = params.bloomRadius;
		composer.addPass(renderScene);
		composer.addPass(bloomPass);
	};

	window.addEventListener(
		"resize",
		function() {
			camera.aspect =
				document.querySelector("#model").clientWidth /
				document.querySelector("#model").clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(
				document.querySelector("#model").clientWidth,
				document.querySelector("#model").clientHeight
			);
		},
		false
	);


	// scene

	setBackground();
	setFloor();
	let a = await loadAvatar(player1, new THREE.Vector3(-2, 0, 0));
	let b = await loadAvatar(player2, new THREE.Vector3(2, 0, 0));
	loadActions();
	setLight();
	setHelper();
	setControll();
	initComposer();
	createBox();

	function handleActions(player) {
		if (
			(player.currentAction === player.actions['walk_forward'] || player.currentAction === player.actions[
					'jump'] ||
				player.currentAction === player.actions['shoot'] || player.currentAction === player.actions[
					'walk_backward'] ||
				player.currentAction === player.actions['walk_left'] || player.currentAction === player.actions[
					'walk_right']) &&
			player.currentAction.time >= player.currentAction.getClip().duration
		) {
			console.log(player.id);
			if (player.currentAction === player.actions['shoot'])
				createBullet(player.model.position);
			switchAction(player, 'idle', 0.1);
		}
		// 当处于 running 动作时，移动相机
		if (
			player.currentAction === player.actions['walk_forward']
		) {
			var dz = 0.03;
			player.model.position.z += dz;
			player.circle.position.z = player.model.position.z;
		}
		if (
			player.currentAction === player.actions['walk_backward']
		) {
			var dz = -0.03;
			player.model.position.z += dz;
			player.circle.position.z = player.model.position.z;
		}
		if (
			player.currentAction === player.actions['walk_left']
		) {
			var dx = 0.03;
			player.model.position.x += dx;
			player.circle.position.x = player.model.position.x;
		}
		if (
			player.currentAction === player.actions['walk_right']
		) {
			var dx = -0.03;
			player.model.position.x += dx;
			player.circle.position.x = player.model.position.x;
		}
	}

	function animate() {

		let bulletList = [];
		bulletArr.forEach(item => {
			if (item.distance < 30)
				bulletList.push(item);
			else
				scene.remove(item.obj)
		})
		bulletArr = bulletList;
		bulletArr.forEach(item => {
			var dx = item.speed * Math.sin(item.angle);
			var dz = item.speed * Math.cos(item.angle);
			item.obj.position.x += dx;
			item.obj.position.z += dz;
			item.distance += item.speed;
		})
		var delta = clock.getDelta();
		if (player1.animationMixer != null) {
			player1.animationMixer.update(delta);
		}
		if (player2.animationMixer != null) {
			player2.animationMixer.update(delta);
		}
		handleActions(player1);
		handleActions(player2);
		//composer.render();
		if (starField != null) {
			starField.rotation.y += 0.0002
			starField.rotation.x += 0.0002
			starField.rotation.z += 0.0002
		}
		renderer.render(scene, camera);
		requestAnimationFrame(animate);
	}

	animate();

	var GUI = lil.GUI;
	var gui = new GUI();
	gui.hide();
	setupDatGui();
	mdui.mutation();

	function setupDatGui() {
		let folder = gui.addFolder("Settings");
		folder.add(camera.position, "z", -10, 10);
		folder.controllers[0].name("camera distance");

		folder.add(app, "doublePlayer");
		folder.controllers[1].name("double player");
		var guiroot = document.querySelector(".lil-gui.root");
		guiroot.style.left = "calc(calc(100vw - var(--side-bar-width)) + 19.1vw - 122px)";
		guiroot.style.webkitAppRegion = "no-drag";
		guiroot.style.zIndex = "10000";
	}

	// keyborad control camera position
	document.addEventListener("keydown", (event) => {
		console.log(event);
		var step = 0.01;
		//ArrowLeft ArrowRight
		switch (event.key) {
			case "w":
				//camera.position.set(x + step, y, z);
				switchAction(player1, 'walk_forward');
				break;
			case "a":
				switchAction(player1, 'walk_left');
				//avatar.rotation.y = avatarRotY;
				break;
			case "d":
				switchAction(player1, 'walk_right');
				//avatar.rotation.y = avatarRotY;
				break;
			case "s":
				switchAction(player1, 'walk_backward');
				//avatar.rotation.y = avatarRotY;
				break;
			case "j":
				switchAction(player1, 'shoot');
				break;
			case "k":
				switchAction(player1, 'jump');
				break;

			case "ArrowRight":
				switchAction(player2, 'walk_right');
				break;

			case "ArrowLeft":
				switchAction(player2, 'walk_left');
				break;

			case "ArrowUp":
				switchAction(player2, 'walk_forward');
				break;

			case "ArrowDown":
				switchAction(player2, 'walk_backward');
				break;
			case "1":
				switchAction(player2, 'shoot');
				break;
			case "2":
				switchAction(player2, 'jump');
				break;
		}
	});


})();