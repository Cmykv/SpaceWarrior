(async () => {
	const theModel = {
		"name": "Vanguard",
		"path": "model/Vanguard.fbx",
		"type": "fbx",
		"isBuildIn": true,
		"picBg": "model/Vanguard.png"
	};
	let app = new Vue({
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
			player1Score: 0,
			player1Life: 100
		},
	});
	let player1 = {
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
		life: 100,
		foot: null
	};
	let player2 = {
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
		life: 100,
		foot: null
	};
	const uniforms = {
		iTime: {
			value: 0
		},
		iResolution: {
			value: new THREE.Vector2(window.innerWidth, window.innerHeight)
		}
	};


	let clock = new THREE.Clock();
	// gltf and vrm
	let loader = null;
	let bulletArr = [];
	let monsterArr = [];
	let wallArr = [];
	let monsterDuration = 1000;
	let monsterRadius = 0.06;
	let innerWidth = document.querySelector("#model").clientWidth;
	let innerHeight = document.querySelector("#model").clientHeight;
	const scene = new THREE.Scene();


	let composer;
	const textureLoader = new THREE.TextureLoader();
	let rockMap = textureLoader.load("./lib/rock.png");
	rockMap.wrapS = THREE.RepeatWrapping;
	rockMap.wrapT = THREE.RepeatWrapping;
	document.getElementById("btn_set").onclick = () => {
		if (!app.showSetting) {
			gui.show();
		} else {
			gui.hide();
		}
		app.showSetting = !app.showSetting
	}

	let modal = document.getElementById("myModal");
	document.getElementById("btn_start").onclick = () => {
		modal.style.display = "none";
	}
	/*
	span.onclick = function() {
	  modal.style.display = "none";
	}
	*/

	const vertexShader = `
   void main() {
       gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
   }
   `;

	const fragmentShader = `
   uniform float iTime;
   uniform vec2 iResolution;
   int iterations=17;
   float formuparam=0.53;
   
   int volsteps= 20;
   float stepsize= 0.1;
   
   float zoom=   0.800;
   float tile=   0.850;
   float speed=  0.0010 ;
   
   float brightness= 0.0015;
   float darkmatter= 0.300;
   float distfading= 0.730;
   float saturation= 0.850;
   
   void main() {
   		vec2 uv=gl_FragCoord.xy/iResolution.xy-.5;
   		uv.y*=iResolution.y/iResolution.x;
   		vec3 dir=vec3(uv*zoom,1.);
   		float time=iTime*speed+.25;
   	
   
   		float a1=.5+100.0/iResolution.x*2.;
   		float a2=.8+100.0/iResolution.y*2.;
   		mat2 rot1=mat2(cos(a1),sin(a1),-sin(a1),cos(a1));
   		mat2 rot2=mat2(cos(a2),sin(a2),-sin(a2),cos(a2));
   		dir.xz*=rot1;
   		dir.xy*=rot2;
   		vec3 from=vec3(1.,.5,0.5);
   		from+=vec3(time*2.,time,-2.);
   		from.xz*=rot1;
   		from.xy*=rot2;
   		
   		//volumetric rendering
   		float s=0.1,fade=1.;
   		vec3 v=vec3(0.);
   		for (int r=0; r<volsteps; r++) {
   			vec3 p=from+s*dir*.5;
   			p = abs(vec3(tile)-mod(p,vec3(tile*2.)));
   			float pa,a=pa=0.;
   			for (int i=0; i<iterations; i++) { 
   				p=abs(p)/dot(p,p)-formuparam; 
   				a+=abs(length(p)-pa); 
   				pa=length(p);
   			}
   			float dm=max(0.,darkmatter-a*a*.001);
   			a*=a*a; 
   			if (r>6) fade*=1.-dm;
   			v+=fade;
   			v+=vec3(s,s*s,s*s*s*s)*a*brightness*fade; 
   			fade*=distfading;
   			s+=stepsize;
   		}
   		v=mix(vec3(length(v)),v,saturation);
   		gl_FragColor = vec4(v*.01,1.);
   }
   `;


	function setBackground() {


		const shaderMaterial = new THREE.ShaderMaterial({
			uniforms: uniforms,
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
		});

		const geometry = new THREE.PlaneBufferGeometry(100, 100);
		const mesh = new THREE.Mesh(geometry, shaderMaterial);
		mesh.position.set(0, 0, 20);
		mesh.rotation.y = -Math.PI;
		scene.add(mesh);
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
		let light2 = new THREE.DirectionalLight(
			0xffffff,
			1.5
		);
		light2.position.set(0, 3, -3);
		light2.castShadow = true;
		scene.add(light2);

	}

	function createWall() {
		for (let i = 0; i < 3; i++) {
			cubeGeometry = new THREE.BoxGeometry(1, 4, 1);
			cubeMaterial = new THREE.MeshLambertMaterial({
				color: 0x2a0000
			});

			cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
			cube.position.x = THREE.MathUtils.randFloatSpread(30);
			cube.position.y = 0.5;
			cube.position.z = THREE.MathUtils.randFloatSpread(30);
			//cube.layers.set(1);
			//告诉立方体需要投射阴影
			cube.castShadow = true;

			scene.add(cube);
			wallArr.push(cube);
		}
	}



	function createBullet(pos) {
		const geometry = new THREE.SphereGeometry(0.1, 50, 50);
		//const material = new THREE.MeshBasicMaterial({ map: map });
		const material = new THREE.MeshPhongMaterial({
			color: 0x0000ff, // 设置材质颜色
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
		let bullet = {};
		bullet.obj = sphere;
		bullet.speed = 0.5;
		bullet.angle = 0;
		bullet.distance = 0;
		bullet.alive = true;
		bulletArr.push(bullet)
	}

	function createMonster2() {
		let r = monsterRadius;
		let x = THREE.MathUtils.randFloatSpread(10) - 5;
		let y = 1;
		let z = THREE.MathUtils.randFloatSpread(100) + 20;
		const geometry = new THREE.SphereGeometry(r, 10, 10);
		// 创建材质
		const material = new THREE.MeshPhongMaterial({
			map: rockMap
		});
		const group = new THREE.Group();
		for (let i = -3; i <= 3; i++)
			for (let j = -3; j <= 3; j++)
				for (let m = -3; m <= 3; m++) {
					if (Math.sqrt(i * i + j * j + m * m) > 3)
						continue;

					let ball = new THREE.Mesh(geometry, material)
					ball.position.set(i * 2 * r, j * 2 * r, m * 2 * r);
					group.add(ball);
				}
		group.bom = false;
		group.bomTimer = 0;
		group.bomSpeed = 0.1;
		group.alive = true;
		group.speed = 0.1;
		group.angle = 0;
		group.distance = 0;
		group.position.set(x, y, z);
		scene.add(group);
		monsterArr.push(group);
		setTimeout(createMonster2, monsterDuration);
	}

	function bomMonster(monster) {
		monster.traverse(function(obj) {
			// 判断子对象是否是物体，如果是，更改其颜色
			if (obj.isMesh) {
				obj.material.color.set(0xff0000);
			}
		})
		console.log(monster.position);
		monster.bom = true;
		monster.alive = false;
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
					let model = null;
					if (theModel.type == "fbx") {
						model = gltf;
						player.model = model;
						player.model.scale.set(0.01, 0.01, 0.01);
					}
					player.model.position.set(pos.x, pos.y, pos.z);
					player.skeletonHelper = new THREE.SkeletonHelper(player.model);
					player.skeletonHelper.visible = false;
					player.skeletonHelper.material.linewidth = 30;

					scene.add(player.skeletonHelper);

					player.model.castShadow = true;
					player.model.children.forEach(child => {
						child.castShadow = true;
					});
					scene.add(player.model);
					player.avatarRotY = player.model.rotation.y;

					const geometry = new THREE.CircleGeometry(0.6, 32, 0, Math.PI * 2);
					let color = player.id == 1 ? 0xff0000 : 0x0000ff;
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
		let center = new THREE.Vector3();
		let midPoint = selectedDecorationBbox.getCenter(center);
	}

	function loadActions() {
		let loader = new THREE.FBXLoader();
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
			console.log(player1.actions["shoot"]);
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
			player.previousAction = player.currentAction;
			if (player.previousAction) {
				player.previousAction.fadeOut(fadeDuration);
			}

			if (newActionName === 'jump' || newActionName === 'death' ||
				newActionName === 'walk_forward' || newActionName === 'shoot' ||
				newActionName === 'walk_backward' || newActionName === 'walk_left' ||
				newActionName === 'walk_right') {
				newAction.loop = THREE.LoopOnce;
				newAction.clampWhenFinished = true;
			}

			player.currentAction = newAction;

			player.currentAction.reset();
			if (newActionName === 'shoot')
				player.currentAction.setEffectiveTimeScale(4);
			else
				player.currentAction.setEffectiveTimeScale(2);
			player.currentAction.setEffectiveWeight(1);
			player.currentAction.fadeIn(fadeDuration).play();
		} else if (newAction && player.currentAction === newAction && newActionName === 'shoot') {
			//console.log("need to fire");
		}
	}

	function setFloor() {
		let planeGeometry = new THREE.PlaneGeometry(100, 100);
		let planeMaterial = new THREE.MeshStandardMaterial({
			color: 0x999999
		});

		let plane = new THREE.Mesh(planeGeometry, planeMaterial);
		plane.rotation.x = -0.5 * Math.PI;
		plane.position.y = -0;

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
	createMonster2();
	setLight();
	setHelper();
	setControll();
	initComposer();
	createWall();

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
			//console.log(player.id);
			if (player.currentAction === player.actions['shoot'])
				createBullet(player.model.position);
			switchAction(player, 'idle', 0.1);
		}
		// 当处于 running 动作时，移动相机
		let playerBox = new THREE.Box3().setFromObject(player.model);
		let canMove = true;
		if (
			player.currentAction === player.actions['walk_forward']
		) {
			wallArr.forEach(wall => {
				if (wall.position.z > player.model.position.z) {
					let wallMeshBox = new THREE.Box3().setFromObject(wall);
					if (wallMeshBox.intersectsBox(playerBox)) {
						canMove = false;
					}
				}
			})
			if (canMove) {
				let dz = 0.03;
				player.model.position.z += dz;
				player.circle.position.z = player.model.position.z;
			}
		}
		if (
			player.currentAction === player.actions['walk_backward']
		) {
			wallArr.forEach(wall => {
				if (wall.position.z < player.model.position.z) {
					let wallMeshBox = new THREE.Box3().setFromObject(wall);
					if (wallMeshBox.intersectsBox(playerBox)) {
						canMove = false;
					}
				}
			})
			if (canMove) {
				let dz = -0.03;
				player.model.position.z += dz;
				player.circle.position.z = player.model.position.z;
			}
		}
		if (
			player.currentAction === player.actions['walk_left']
		) {
			wallArr.forEach(wall => {
				if (wall.position.x > player.model.position.x) {
					let wallMeshBox = new THREE.Box3().setFromObject(wall);
					if (wallMeshBox.intersectsBox(playerBox)) {
						canMove = false;
					}
				}
			})
			if (canMove) {
				let dx = 0.03;
				player.model.position.x += dx;
				player.circle.position.x = player.model.position.x;
			}
		}
		if (
			player.currentAction === player.actions['walk_right']
		) {
			wallArr.forEach(wall => {
				if (wall.position.x < player.model.position.x) {
					let wallMeshBox = new THREE.Box3().setFromObject(wall);
					if (wallMeshBox.intersectsBox(playerBox)) {
						canMove = false;
					}
				}
			})
			if (canMove) {
				let dx = -0.03;
				player.model.position.x += dx;
				player.circle.position.x = player.model.position.x;
			}
		}
	}

	function animate() {

		let bulletList = [];
		bulletArr.forEach(item => {
			if (item.alive && item.distance < 30)
				bulletList.push(item);
			else
				scene.remove(item.obj)
		});
		bulletArr = bulletList;
		bulletArr.forEach(item => {
			if (item.alive) {
				let dx = item.speed * Math.sin(item.angle);
				let dz = item.speed * Math.cos(item.angle);
				item.obj.position.x += dx;
				item.obj.position.z += dz;
				item.distance += item.speed;
			}
		});

		let monsterList = [];
		monsterArr.forEach(item => {
			if (item.alive) {
				if (item.distance < 200) {
					monsterList.push(item);
				} else {
					scene.remove(item);
				}
			}
			if (item.bom) {
				if (item.bomTimer < 30) {
					monsterList.push(item);
				} else {
					scene.remove(item);
				}
			}
		});
		monsterArr = monsterList;

		monsterArr.forEach(item => {
			if (item.alive) {
				let dx = item.speed * Math.sin(item.angle);
				let dz = item.speed * Math.cos(item.angle);
				item.translateZ(-dz);
				item.translateX(dx);
				//item.rotation.x += 0.01;
				//item.rotation.z += 0.01;
				item.distance += item.speed;
			}
			if (item.bom) {
				item.traverse(function(child) {
					// 判断子对象是否是物体，如果是，更改其颜色
					if (child.isMesh) {
						let dir = new THREE.Vector3().copy(child.position.clone().normalize())
						//console.log(dir);
						let dx = dir.x * item.bomSpeed;
						let dy = dir.y * item.bomSpeed;
						let dz = dir.z * item.bomSpeed;
						child.position.x += dx;
						child.position.y += dy;
						child.position.z += dz;
					}
				})
				item.bomTimer += 1;
			}
		});

		let delta = clock.getDelta();
		if (player1.animationMixer != null) {
			player1.animationMixer.update(delta);
		}
		if (player2.animationMixer != null) {
			player2.animationMixer.update(delta);
		}
		handleActions(player1);
		if (app.doublePlayer)
			handleActions(player2);

		// check collide
		let playerBox = new THREE.Box3().setFromObject(player1.model);
		monsterArr.forEach(item => {
			if (item.alive) {
				let boxMeshBox = new THREE.Box3().setFromObject(item);
				if (playerBox.intersectsBox(boxMeshBox)) {
					player1.life -= 2;
					bomMonster(item);
				}
				wallArr.forEach(wall => {
					let wallMeshBox = new THREE.Box3().setFromObject(wall);
					if (wallMeshBox.intersectsBox(boxMeshBox)) {
						bomMonster(item);
					}
				})
				bulletArr.forEach(bullet => {
					let bulletMeshBox = new THREE.Box3().setFromObject(bullet.obj);
					if (bulletMeshBox.intersectsBox(boxMeshBox)) {
						bullet.alive =false;
						bomMonster(item);
					}
				})
			}

		});
		bulletArr.forEach(bullet => {
			let bulletMeshBox = new THREE.Box3().setFromObject(bullet.obj);
			wallArr.forEach(wall => {
				let wallMeshBox = new THREE.Box3().setFromObject(wall);
				if (wallMeshBox.intersectsBox(bulletMeshBox)) {
					bullet.alive = false;
				}
			})
		})
		
		app.player1Life = player1.life;
		uniforms.iTime.value += 0.05;
		renderer.render(scene,
			camera);
		requestAnimationFrame(animate);
	}

	animate();

	let GUI = lil.GUI;
	let gui = new GUI();
	gui.hide();
	setupDatGui();
	mdui.mutation();

	function setupDatGui() {
		let folder = gui.addFolder("Settings");
		folder.add(camera.position, "z", -10, 10);
		folder.controllers[0].name("camera distance");

		folder.add(app, "doublePlayer");
		folder.controllers[1].name("double player");
		let guiroot = document.querySelector(".lil-gui.root");
		guiroot.style.left = "calc(calc(100vw - let(--side-bar-width)) + 19.1vw - 122px)";
		guiroot.style.webkitAppRegion = "no-drag";
		guiroot.style.zIndex = "10000";
	}

	// keyborad control camera position
	document.addEventListener("keydown", (event) => {
		//console.log(event);
		let step = 0.01;
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