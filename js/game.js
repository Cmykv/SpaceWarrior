import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import {
	OrbitControls
} from 'three/addons/controls/OrbitControls.js';
import {
	FBXLoader
} from 'three/addons/loaders/FBXLoader.js';
import {
	GUI
} from 'three/addons/libs/lil-gui.module.min.js';

import {
	EffectComposer
} from 'three/addons/postprocessing/EffectComposer.js';
import {
	RenderPass
} from 'three/addons/postprocessing/RenderPass.js';
import {
	ShaderPass
} from 'three/addons/postprocessing/ShaderPass.js';
import {
	OutlinePass
} from 'three/addons/postprocessing/OutlinePass.js';
import {
	OutputPass
} from 'three/addons/postprocessing/OutputPass.js';
import {
	FXAAShader
} from 'three/addons/shaders/FXAAShader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
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
		player1Life: 100,
		player2Score: 0,
		player2Life: 100,
	},
});


let modal = document.getElementById("myModal");
document.getElementById("btn_start_1").onclick = () => {
	modal.style.display = "none";
	init();
}

document.getElementById("btn_start_2").onclick = () => {
	app.doublePlayer = true;
	modal.style.display = "none";
	init();
}

function init() {

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
	let loader = new FBXLoader();;
	let bulletArr = [];
	let monsterArr = [];
	let wallArr = [];
	let monsterDuration = 1000;
	let monsterRadius = 6;
	let innerWidth = document.querySelector("#model").clientWidth;
	let innerHeight = document.querySelector("#model").clientHeight;
	const scene = new THREE.Scene();
	//scene.background = new THREE.Color(0xa0a0a0);
	//scene.fog = new THREE.Fog(0xa0a0a0, 500, 1000);


	let composer, effectFXAA, outlinePass;
	let selectedObjects = [];




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

		const geometry = new THREE.PlaneGeometry(5000, 5000);
		const mesh = new THREE.Mesh(geometry, shaderMaterial);
		mesh.position.set(0, 0, 2000);
		mesh.rotation.y = -Math.PI;
		scene.add(mesh);
	}

	function setControll() {
		const controls = new OrbitControls(
			camera,
			renderer.domElement
		);
		controls.screenSpacePanning = true;
		controls.target.set(0.0, 1.0, 0.0);
		controls.update();

	}

	function setLight() {

		const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 5);
		hemiLight.position.set(0, 500, 0);
		scene.add(hemiLight);
		//const hemiLightHelper = new THREE.HemisphereLightHelper(hemiLight, 10);
		//scene.add(hemiLightHelper);

		const dirLight = new THREE.DirectionalLight(0xffffff, 5);
		dirLight.color.setHSL(0.1, 1, 0.95);
		dirLight.position.set(0, 500, 300);
		dirLight.castShadow = true;
		dirLight.shadow.mapSize.width = 500;
		dirLight.shadow.mapSize.height = 500;
		let d = 800;
		dirLight.shadow.camera.left = -d;
		dirLight.shadow.camera.right = d;
		dirLight.shadow.camera.top = d;
		dirLight.shadow.camera.bottom = -d;

		dirLight.shadow.camera.far = 3500;
		dirLight.shadow.bias = -0.0001;

		//const dirLightHelper = new THREE.DirectionalLightHelper(dirLight, 10);
		//scene.add(dirLightHelper);
		scene.add(dirLight);

		const ambient = new THREE.AmbientLight(0x4466ff, 1);
		scene.add(ambient);

	}

	function createWall() {
		for (let i = 0; i < 2; i++) {
			let cubeGeometry = new THREE.BoxGeometry(100, 200, 100);
			let cubeMaterial = new THREE.MeshLambertMaterial({
				color: 0x0000ff
			});

			let cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
			//THREE.MathUtils.randFloatSpread(1000)
			cube.position.x = 500 * (i > 0 ? 1 : -1);
			cube.position.y = 100;
			cube.position.z = 300;
			//cube.layers.set(1);
			//告诉立方体需要投射阴影
			cube.castShadow = true;
			scene.add(cube);
			wallArr.push(cube);
		}
	}



	function createBullet(id, pos) {
		const geometry = new THREE.SphereGeometry(9, 50, 50);
		//const material = new THREE.MeshBasicMaterial({ map: map });
		const material = new THREE.MeshPhongMaterial({
			color: 0xffffff, // 设置材质颜色
			specular: 0x111111,
			shininess: 99
		});
		let sphere = new THREE.Mesh(geometry, material);;
		sphere.position.x = pos.x + 0;
		sphere.position.y = 120;
		sphere.position.z = pos.z + 50;
		scene.add(sphere);
		let bullet = {};
		bullet.obj = sphere;
		bullet.speed = 35;
		bullet.angle = 0;
		bullet.distance = 0;
		bullet.alive = true;
		bullet.id = id;
		bulletArr.push(bullet)
		if (outlinePass) {
			selectedObjects = [];
			selectedObjects.push(bullet.obj);
			outlinePass.selectedObjects = selectedObjects;
		}

	}

	function createMonster2() {
		let r = monsterRadius;
		let x = THREE.MathUtils.randFloatSpread(1000) - 500;
		let y = 120;
		let z = 1088;
		const geometry = new THREE.SphereGeometry(r, 10, 10);
		const material = new THREE.MeshPhongMaterial({
			color: "#aa0000"
		});
		const group = new THREE.Group();
		for (let i = -3; i <= 3; i++)
			for (let j = -3; j <= 3; j++)
				for (let m = -3; m <= 3; m++) {
					if (Math.sqrt(i * i + j * j + m * m) > 3.5)
						continue;

					let ball = new THREE.Mesh(geometry, material)
					ball.position.set(i * 2 * r, j * 2 * r, m * 2 * r);
					group.add(ball);
				}
		group.bom = false;
		group.bomTimer = 0;
		group.bomSpeed = 5;
		group.alive = true;
		group.speed = 5;
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
		monster.bom = true;
		monster.alive = false;
	}



	const actionUrls = ["./model/walkforward.fbx",
		"./model/walkbackward.fbx",
		"./model/walkleft.fbx",
		"./model/walkright.fbx",
		"./model/idle.fbx",
		"./model/jumping.fbx",
		"./model/shooting.fbx",
		"./model/death.fbx"
	];

	let clipActions = [];

	function loadAvatar(player, pos) {


		loader.crossOrigin = "anonymous";
		loader.load(
			theModel.path,
			(gltf) => {
				let model = null;
				if (theModel.type == "fbx") {
					model = gltf;
					player.model = model;
				}
				initPlayer(player, pos);

				let resIndex = 0;

				function loadRes() {

					const resFile = actionUrls[resIndex];

					loader.load(resFile, function(obj) {

						clipActions.push(obj.animations[0]);

						resIndex++;

						if (resIndex < actionUrls.length) {

							loadRes();

						} else {

							beginGame();

						}

					}, onProgress, null);

				}

				loadRes();


			},

			onProgress,

			// called when loading has errors
			(error) => {

				app.failed = true;
				console.log(error);
			}
		);
	}

	function beginGame() {
		player2.model = SkeletonUtils.clone(player1.model);
		initPlayer(player2, new THREE.Vector3(100, 0, 0))
		if (!app.doublePlayer) {
			player2.model.visible = false;
			player2.foot.visible = false;
		}


		player1.animationMixer = new THREE.AnimationMixer(player1.model);
		player2.animationMixer = new THREE.AnimationMixer(player2.model);
		player1.actions["walk_forward"] = player1.animationMixer.clipAction(clipActions[0]);
		player2.actions["walk_forward"] = player2.animationMixer.clipAction(clipActions[0]);
		player1.actions["walk_backward"] = player1.animationMixer.clipAction(clipActions[1]);
		player2.actions["walk_backward"] = player2.animationMixer.clipAction(clipActions[1]);
		player1.actions["walk_left"] = player1.animationMixer.clipAction(clipActions[2]);
		player2.actions["walk_left"] = player2.animationMixer.clipAction(clipActions[2]);
		player1.actions["walk_right"] = player1.animationMixer.clipAction(clipActions[3]);
		player2.actions["walk_right"] = player2.animationMixer.clipAction(clipActions[3]);
		player1.actions["idle"] = player1.animationMixer.clipAction(clipActions[4]);
		player2.actions["idle"] = player2.animationMixer.clipAction(clipActions[4]);
		player1.actions["jump"] = player1.animationMixer.clipAction(clipActions[5]);
		player2.actions["jump"] = player2.animationMixer.clipAction(clipActions[5]);
		player1.actions["shoot"] = player1.animationMixer.clipAction(clipActions[6]);
		player2.actions["shoot"] = player2.animationMixer.clipAction(clipActions[6]);
		player1.actions["death"] = player1.animationMixer.clipAction(clipActions[7]);
		player2.actions["death"] = player2.animationMixer.clipAction(clipActions[7]);

		app.loaded = true;
		player1.actions["idle"].play();
		player2.actions["idle"].play();
		player1.currentAction = player1.actions["idle"];
		player1.currentActionName = "idle";
		player2.currentAction = player2.actions["idle"];
		player2.currentActionName = "idle";
		createMonster2();
		animate();

	}

	function initPlayer(player, pos) {
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

		const geometry = new THREE.CircleGeometry(40, 32, 0, Math.PI * 2);
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
		player.foot = circle;
		scene.add(circle);
	}

	function setHelper() {
		//const axesHelper = new THREE.AxesHelper(500);
		//scene.add(axesHelper);
	}

	function getCenter(obj) {
		const selectedDecorationBbox = new THREE.Box3().setFromObject(obj);
		let center = new THREE.Vector3();
		let midPoint = selectedDecorationBbox.getCenter(center);
	}


	function onProgress(xhr) {

		if (xhr.lengthComputable) {

			const percentComplete = xhr.loaded / xhr.total * 100;
			console.log(Math.round(percentComplete, 2) + '% downloaded');

		}

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
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshPhongMaterial({
			color: 0x999999,
			depthWrite: false
		}));
		mesh.rotation.x = -Math.PI / 2;
		mesh.receiveShadow = true;
		scene.add(mesh);
		const grid = new THREE.GridHelper(4000, 20, 0x000000, 0x000000);
		grid.material.opacity = 0.2;
		grid.material.transparent = true;
		scene.add(grid);
	}




	const renderer = new THREE.WebGLRenderer({
		antialias: true
	});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(
		document.querySelector("#model").clientWidth,
		document.querySelector("#model").clientHeight
	);
	renderer.shadowMap.enabled = true;

	renderer.shadowMap.type = THREE.PCFSoftShadowMap;

	//renderer.autoClear = false;
	renderer.outputEncoding = THREE.sRGBEncoding; // 输出编码
	//ReinhardToneMapping
	renderer.toneMapping = THREE.ACESFilmicToneMapping; // 色调映射
	renderer.toneMappingExposure = 0.9; // 色调映射曝光
	renderer.setPixelRatio(window.devicePixelRatio);
	//renderer.setClearColor(0x000000, 1); //设置背景颜色
	document.querySelector("#model").appendChild(renderer.domElement);
	const stats = new Stats();
	stats.showPanel(0);
	document.querySelector('#model').appendChild(stats.domElement);




	// camera
	const camera = new THREE.PerspectiveCamera(
		50,
		document.querySelector("#model").clientWidth /
		document.querySelector("#model").clientHeight,
		1,
		5000.0
	);
	camera.position.set(0, 200, -1000);
	camera.lookAt(0, 0, 0);

	composer = new EffectComposer(renderer);

	const renderPass = new RenderPass(scene, camera);
	composer.addPass(renderPass);

	outlinePass = new OutlinePass(new THREE.Vector2(document.querySelector("#model").clientWidth, document
		.querySelector("#model").clientHeight), scene, camera);
	outlinePass.edgeStrength = 8;
	outlinePass.edgeGlow = 1;
	outlinePass.visibleEdgeColor.set("#ff0000");
	outlinePass.edgeThickness = 4;
	outlinePass.pulsePeriod = 2;
	composer.addPass(outlinePass);

	const outputPass = new OutputPass();
	composer.addPass(outputPass);

	effectFXAA = new ShaderPass(FXAAShader);
	effectFXAA.uniforms['resolution'].value.set(1 / document.querySelector("#model").clientWidth, 1 / document
		.querySelector("#model").clientHeight);
	composer.addPass(effectFXAA);
	outlinePass.selectedObjects = [];


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
	setLight();
	setHelper();
	setControll();
	createWall();
	loadAvatar(player1, new THREE.Vector3(-100, 0, 0));

	let colors = ["red", "blue", "green"];
	const params = {
		showPlayer1Skeleton: false,
		showPlayer2Skeleton: false,
		player1Color: "none",
		player2Color: "none",
		player1Halo: true,
		player2Halo: true,
	};
	const gui = new GUI({
		width: 280
	});
	gui.domElement.id = 'gui';
	gui.domElement.style.marginTop = '450px';

	gui.add(params, 'showPlayer1Skeleton').onChange(function(value) {

		player1.skeletonHelper.visible = value;

	});
	gui.add(params, 'player1Halo').onChange(function(value) {

		player1.foot.visible = value;

	});
	gui.add(params, 'player1Color', colors).onChange(function(value) {

		//player1.skeletonHelper.visible = value;
		player1.model.traverse(function(obj) {
			// 判断子对象是否是物体，如果是，更改其颜色
			if (obj.isMesh) {
				obj.material = new THREE.MeshPhongMaterial({
					color: value, // 设置材质颜色
					specular: 0xffffff, // 设置高光颜色
					shininess: 100, // 设置高光强度
					combine: THREE.MixOperation, // 设置环境映射的混合模式
					reflectivity: 1 // 设置材质的反射强度
				});
			}
		});

	});

	if (app.doublePlayer) {
		gui.add(params, 'showPlayer2Skeleton').onChange(function(value) {

			player2.skeletonHelper.visible = value;

		});
		gui.add(params, 'player2Halo').onChange(function(value) {

			player2.foot.visible = value;

		});
		gui.add(params, 'player2Color', colors).onChange(function(value) {

			//player1.skeletonHelper.visible = value;
			player2.model.traverse(function(obj) {
				// 判断子对象是否是物体，如果是，更改其颜色
				if (obj.isMesh) {
					obj.material = new THREE.MeshPhongMaterial({
						color: value, // 设置材质颜色
						specular: 0xffffff, // 设置高光颜色
						shininess: 100, // 设置高光强度
						combine: THREE.MixOperation, // 设置环境映射的混合模式
						reflectivity: 1 // 设置材质的反射强度
					});
				}
			});

		});
	}




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
				createBullet(player.id, player.model.position);
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
				let dz = 2;
				player.model.position.z += dz;
				player.foot.position.z = player.model.position.z;
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
				let dz = -2;
				player.model.position.z += dz;
				player.foot.position.z = player.model.position.z;
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
				let dx = 2;
				player.model.position.x += dx;
				player.foot.position.x = player.model.position.x;
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
				let dx = -2;
				player.model.position.x += dx;
				player.foot.position.x = player.model.position.x;
			}
		}
	}

	function animate() {

		let bulletList = [];
		bulletArr.forEach(item => {
			if (item.alive && item.distance < 2000)
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
				if (item.distance < 1500) {
					monsterList.push(item);
				} else {
					scene.remove(item);
					item = null;
				}
			}
			if (item && item.bom) {
				if (item.bomTimer < 30) {
					monsterList.push(item);
				} else {
					scene.remove(item);
					item = null;
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
		if (app.doublePlayer && player2.animationMixer != null) {
			player2.animationMixer.update(delta);
		}
		handleActions(player1);
		if (app.doublePlayer)
			handleActions(player2);

		// check collide
		let playerBox = new THREE.Box3().setFromObject(player1.model);
		let playerBox2 = null;
		if (app.doublePlayer)
			playerBox2 = new THREE.Box3().setFromObject(player2.model);
		monsterArr.forEach(item => {
			if (item.alive) {
				let boxMeshBox = new THREE.Box3().setFromObject(item);
				if (playerBox.intersectsBox(boxMeshBox)) {
					player1.life -= 2;
					bomMonster(item);
				}
				if (playerBox2 && playerBox2.intersectsBox(boxMeshBox)) {
					player2.life -= 2;
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
						bullet.alive = false;
						console.log("player ", bullet.id, " score");
						if (bullet.id == 1) {
							player1.score += 1;
						} else {
							player2.score += 1;
						}
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
		app.player1Score = player1.score;
		app.player2Life = player2.life;
		app.player2Score = player2.score;
		uniforms.iTime.value += 0.05;
		stats.update();

		let needCompose = false;
		if (bulletArr.length > 0)
			needCompose = true;
		if (false)
			composer.render();
		else
			renderer.render(scene, camera);
		requestAnimationFrame(animate);
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
}