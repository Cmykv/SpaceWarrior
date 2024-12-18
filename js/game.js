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
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

import {
	GLTFLoader
} from 'three/addons/loaders/GLTFLoader.js';

import {
	DRACOLoader
} from 'three/addons/loaders/DRACOLoader.js';

import {
	Water
} from 'three/addons/objects/Water2.js';

import {
	GestureRecognizer,
	FilesetResolver,
	DrawingUtils
} from "taskVision";



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
		player1Life: 0,
		player2Score: 0,
		player2Life: 0,
		level: 1
	},
});


let modal = document.getElementById("myModal");
document.getElementById("btn_start_1").onclick = () => {
	modal.style.display = "none";
	init(1);
}

document.getElementById("btn_start_2").onclick = () => {
	modal.style.display = "none";
	app.doublePlayer = true;
	init(1);
}

document.getElementById("btn_load").onclick = () => {
	modal.style.display = "none";
	let xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {

		if (this.readyState == 4 && this.status == 200) {
			let jsonData = JSON.parse(this.responseText);
			console.log(jsonData);
			app.doublePlayer = jsonData.doublePlayer;
			init(jsonData.gameLevel);
		}


	};
	xhttp.open("GET", "data.json", true);
	xhttp.send();
}


document.getElementById("btn_set").onclick = () => {
	useHandpose();
}


function simulateKeyDown(keyCode) {
	var event = new KeyboardEvent('keydown', {
		bubbles: true,
		cancelable: true,
		keyCode: keyCode,
		key: keyCode
	});
	document.dispatchEvent(event);
}

function useHandpose() {
	const canvasElement = document.getElementById("output_canvas");
	const canvasCtx = canvasElement.getContext("2d");
	let gestureRecognizer;
	let runningMode = "VIDEO";

	const createGestureRecognizer = async () => {
		const vision = await FilesetResolver.forVisionTasks(
			"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
		);
		gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: "./app/shared/models/gesture_recognizer.task",
				delegate: "GPU"
			},
			runningMode: runningMode
		});

	};
	createGestureRecognizer();

	let lastVideoTime = -1;
	async function predictWebcam() {
		let results = undefined;
		let nowInMs = Date.now();
		//console.log(videoElement.currentTime-lastVideoTime,nowInMs);
		if (videoElement.currentTime !== lastVideoTime && (videoElement.currentTime - lastVideoTime) > 0.08) {
			lastVideoTime = videoElement.currentTime;
			if (gestureRecognizer) {
				results = gestureRecognizer.recognizeForVideo(videoElement, nowInMs);
				//console.log(results);
				canvasCtx.save();
				canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
				const drawingUtils = new DrawingUtils(canvasCtx);
				if (results.landmarks) {
					for (const landmarks of results.landmarks) {
						drawingUtils.drawConnectors(
							landmarks,
							GestureRecognizer.HAND_CONNECTIONS, {
								color: "#00FF00",
								lineWidth: 1
							}
						);
						drawingUtils.drawLandmarks(landmarks, {
							color: "#FF0000",
							lineWidth: 1
						});
					}
				}
				canvasCtx.restore();
				if (results.gestures.length > 0) {
					const categoryName = results.gestures[0][0].categoryName;
					const categoryScore = parseFloat(
						results.gestures[0][0].score * 100
					).toFixed(2);
					const handedness = results.handednesses[0][0].displayName;
					console.log(categoryName, categoryScore, handedness);
					if (categoryName === "Thumb_Up") {
						simulateKeyDown('a');
					}
					if (categoryName === "Thumb_Down") {
						simulateKeyDown('d');
					}
					if (categoryName === "Closed_Fist") {
						simulateKeyDown('j');
					}
				} else {

				}
			}
		}
		window.requestAnimationFrame(predictWebcam);
	}

	let videoElement = document.getElementById("camera");
	navigator.mediaDevices
		.getUserMedia({
			video: {
				deviceId: localStorage.getItem("cameraId"),
				width: 1280,
				height: 720,
			}
		})
		.then(function(stream) {
			videoElement.srcObject = stream;
			videoElement.play();
			videoElement.addEventListener("loadeddata", predictWebcam);
		})
		.catch(function(err0r) {
			alert(err0r);
		});

}




function init(level) {

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
		damage: 20,
		score: 0,
		alive: true,
		life: 10,
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
		damage: 20,
		score: 0,
		alive: true,
		life: 10,
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

	let gameLevel = level;
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
	let particleLight;
	let monsterCreated = true;
	let water = null;


	let composer, effectFXAA, outlinePass;
	let selectedObjects = [];
	let audioObject = [];
	let smokeParticles = [];



	const vertexShader = `
	   void main() {
		   gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	   }
	   `;

	const fragmentShader = document.getElementById("fragmentShader").textContent;

	const textureLoader = new THREE.TextureLoader();

	const smokeMap = textureLoader.load('./lib/smoke.png');

	function setScene() {
		let smokeMaterial = new THREE.MeshLambertMaterial({
			color: new THREE.Color("rgb(255, 249, 75)"),
			map: smokeMap,
			transparent: true
		});
		let smokeGeo = new THREE.PlaneGeometry(100, 100);

		for (let p = 0; p < 150; p++) {
			let particle = new THREE.Mesh(smokeGeo, smokeMaterial);
			particle.position.set(
				Math.random() * 500 - 250,
				10,
				Math.random() * 1000 - 100
			);
			particle.rotation.y = -Math.PI;
			scene.add(particle);
			smokeParticles.push(particle);
		}

	}

	function evolveSmoke(delta) {
		let sp = smokeParticles.length;
		while (sp--) {
			smokeParticles[sp].rotation.z += delta * 0.2;
		}
	}


	function loadMp3() {
		let listener = new THREE.AudioListener();
		let audioLoader = new THREE.AudioLoader();
		audioLoader.load('./lib/shoot.mp3', function(AudioBuffer) {
			let audio = new THREE.Audio(listener);
			audio.setBuffer(AudioBuffer);
			audio.setLoop(false);
			audio.setVolume(0.5);
			audioObject["shoot"] = audio;
			//audio.play();
		});

		audioLoader.load('./lib/boom.mp3', function(AudioBuffer) {
			let audio = new THREE.Audio(listener);
			audio.setBuffer(AudioBuffer);
			audio.setLoop(false);
			audio.setVolume(0.5);
			audioObject["boom"] = audio;
			//audio.play();
		});
	}

	function setBackground() {


		const shaderMaterial = new THREE.ShaderMaterial({
			uniforms: uniforms,
			vertexShader: vertexShader,
			fragmentShader: fragmentShader,
		});

		//const geometry = new THREE.PlaneGeometry(10000, 10000);
		const geometry = new THREE.SphereGeometry(3500, 100, 100);
		geometry.scale(-1, 1, 1);
		const mesh = new THREE.Mesh(geometry, shaderMaterial);
		mesh.position.set(0, 0, 0);
		//mesh.rotation.y = -Math.PI;
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

		particleLight = new THREE.Mesh(
			new THREE.SphereGeometry(10, 8, 8),
			new THREE.MeshBasicMaterial({
				color: 0xffffff
			})
		);
		scene.add(particleLight);

		particleLight.add(new THREE.PointLight(0xffffff, 90));

	}




	const diffuse = textureLoader.load('./lib/Carbon.png');
	diffuse.colorSpace = THREE.SRGBColorSpace;
	diffuse.wrapS = THREE.RepeatWrapping;
	diffuse.wrapT = THREE.RepeatWrapping;
	diffuse.repeat.x = 1;
	diffuse.repeat.y = 1;

	const normalMap = textureLoader.load('./lib/Carbon_Normal.png');
	normalMap.wrapS = THREE.RepeatWrapping;
	normalMap.wrapT = THREE.RepeatWrapping;
	normalMap.repeat.x = 1;
	normalMap.repeat.y = 1;
	const normalMap2 = textureLoader.load('./lib/Water_1_M_Normal.jpg');
	const normalMap4 = textureLoader.load('./lib/golfball.jpg');
	const clearcoatNormalMap = textureLoader.load('./lib/Scratched_gold_01_1K_Normal.png');

	const material = new THREE.MeshPhysicalMaterial({
		clearcoat: 1.0,
		metalness: 1.0,
		color: 0xff0000,
		normalMap: normalMap2,
		normalScale: new THREE.Vector2(0.15, 0.15),
		clearcoatNormalMap: clearcoatNormalMap,

		// y scale is negated to compensate for normal map handedness.
		clearcoatNormalScale: new THREE.Vector2(2.0, -2.0)
	});
	const earthMaterial = new THREE.MeshPhongMaterial({
		specular: 0x333333,
		shininess: 5,
		map: textureLoader.load('./lib/earth_atmos_2048.jpg'),
		specularMap: textureLoader.load('./lib/earth_specular_2048.jpg'),
		normalMap: textureLoader.load('./lib/earth_normal_2048.jpg'),
		normalScale: new THREE.Vector2(0.85, 0.85)
	});
	earthMaterial.map.colorSpace = THREE.SRGBColorSpace;

	function createWall() {
		for (let i = 0; i < 2; i++) {
			let cubeGeometry = new THREE.SphereGeometry(100, 200, 100);
			let cube = new THREE.Mesh(cubeGeometry, i == 0 ? earthMaterial : material);
			cube.position.x = 500;
			cube.position.y = 100;
			cube.position.z = 2000 * i;
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
		bullet.speed = 100;
		bullet.angle = 0;
		bullet.distance = 0;
		bullet.alive = true;
		bullet.id = id;
		bullet.human = true;
		bulletArr.push(bullet);

		audioObject["shoot"].play();
	}

	function createMonsterBullet(monster) {
		const geometry = new THREE.SphereGeometry(9, 50, 50);
		//const material = new THREE.MeshBasicMaterial({ map: map });
		const material = new THREE.MeshPhongMaterial({
			color: 0x00ff00, // 设置材质颜色
			specular: 0x00ff11,
			shininess: 50
		});
		let sphere = new THREE.Mesh(geometry, material);;
		let d = 50;
		sphere.position.x = monster.position.x - d * Math.sin(monster.rotation.y);
		sphere.position.y = 120;
		sphere.position.z = monster.position.z - d * Math.cos(monster.rotation.y);
		scene.add(sphere);
		let bullet = {};
		bullet.obj = sphere;
		bullet.speed = 10;
		bullet.angle = monster.rotation.y;;
		bullet.distance = 0;
		bullet.alive = true;
		bullet.id = 3;
		bullet.human = false;
		bulletArr.push(bullet);
	}




	function createMonsterRock() {
		let r = monsterRadius;
		let x = THREE.MathUtils.randFloatSpread(1000) - 500;
		let y = 120;
		let z = 1088;
		const geometry = new THREE.SphereGeometry(r, 10, 10);
		const material = new THREE.MeshPhongMaterial({
			color: "#0000ff"
		});
		const group = new THREE.Group();
		for (let i = -3; i <= 3; i++)
			for (let j = -3; j <= 3; j++)
				for (let m = -3; m <= 3; m++) {
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
		group.life = 100;
		group.action = "move";
		group.moveDuration = 900;
		group.rotDuration = 500;
		group.fireDuration = 600;
		group.direction = [0, 0];
		group.actionClock = 0;
		group.targetRot = 0;
		group.fired = false;
		group.position.set(x, y, z);
		scene.add(group);
		monsterArr.push(group);
	}
	const stoneMass = 120;
	let enemy_model;

	function momsterBegin() {
		createMonster();
	}
	/*
	 */
	function monsterAct(monster) {
		//console.log(monster);
		let t = Date.now();
		let randomNumber = Math.floor(Math.random() * 2);
		let directionRandom = Math.floor(Math.random() * 4);
		if (monster.action === "move") {
			if (t - monster.actionClock > monster.moveDuration) {
				monster.action = randomNumber > 0 ? "rot" : "move";
				if (monster.action == "move") {
					switch (directionRandom) {
						case 0:
							monster.direction = [0, 1];
						case 1:
							monster.direction = [0, -1];
						case 2:
							monster.direction = [1, 0];
						case 3:
							monster.direction = [-1, 0];
					}
				} else {

				}
				monster.actionClock = t;
			}
		}
		if (monster.action === "rot") {
			if (t - monster.actionClock > monster.rotDuration) {

				monster.action = "fire";
				monster.fired = false;
				monster.actionClock = t;
			}
		}
		if (monster.action === "fire") {
			if (t - monster.actionClock > monster.fireDuration) {
				monster.action = "move";
				monster.actionClock = t;
			}
		}
	}


	function createMonster() {
		let num = gameLevel + 0;
		for (let i = 0; i < num; i++) {
			let x = -200 + i * 250;;
			let y = 10;
			let z = 2500;
			const group = new THREE.Group();
			const g1 = new THREE.CylinderGeometry(50, 60, 100, 20);
			const m1 = new THREE.MeshPhongMaterial({
				color: "#0000ff"
			});
			const g2 = new THREE.SphereGeometry(40, 40, 20);
			const m2 = new THREE.MeshPhongMaterial({
				color: "#ffff7f"
			});

			const g3 = new THREE.CylinderGeometry(10, 10, 80, 20);
			const m3 = new THREE.MeshPhongMaterial({
				color: "#aa5500"
			});

			const body = new THREE.Mesh(g1, m1);
			const head = new THREE.Mesh(g2, m2);
			const gun = new THREE.Mesh(g3, m3);
			gun.position.set(0, 100, -40);
			gun.rotation.x = Math.PI / 2;

			head.position.set(0, 90, 0);

			group.add(body);
			group.add(head);
			group.add(gun);
			group.position.set(x, y, z);
			group.bom = false;
			group.bomTimer = 0;
			group.bomSpeed = 5;
			group.alive = true;
			group.speed = 5;
			group.angle = 0;
			group.life = 20;
			group.action = "move";
			group.moveDuration = 900;
			group.rotDuration = 500;
			group.fireDuration = 600;
			group.direction = [0, 0];
			group.actionClock = 0;
			group.targetRot = 0;
			group.fired = false;
			scene.add(group);
			monsterArr.push(group);
		}
		monsterCreated = true;
	}

	function levelUp() {
		gameLevel += 1;
		createMonster();
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
		audioObject["boom"].play();
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
		momsterBegin();
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
		if (newActionName !== 'death' && newActionName !== 'idle' && !player.alive) {
			return;
		}
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
		const params = {
			color: '#0055ff',
			scale: 1,
			flowX: 1,
			flowY: 1
		};

		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshPhongMaterial({
			color: '#83828b',
			roughness: 0.8,
			metalness: 0.4
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
	setScene();
	setBackground();
	setFloor();
	setLight();
	setHelper();
	setControll();
	createWall();
	loadAvatar(player1, new THREE.Vector3(-100, 0, 0));
	loadMp3();

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


		wallArr.forEach(item => {
			item.rotation.y += 0.01;

		});
		let bulletList = [];
		bulletArr.forEach(item => {
			if (item.alive && item.distance < 5000)
				bulletList.push(item);
			else
				scene.remove(item.obj)
		});
		bulletArr = bulletList;
		bulletArr.forEach(item => {
			if (item.alive) {
				let dx = item.speed * Math.sin(item.angle);
				let dz = item.speed * Math.cos(item.angle);
				if (item.human) {
					item.obj.position.x += dx;
					item.obj.position.z += dz;
				} else {
					item.obj.position.x -= dx;
					item.obj.position.z -= dz;
				}
				item.distance += item.speed;
			}
		});

		let monsterList = [];
		monsterArr.forEach(item => {
			if (item.alive) {
				monsterList.push(item);
			}
			if (item && item.bom) {
				if (item.bomTimer < 20) {
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
				monsterAct(item);
				if (item.action === "move") {
					item.translateX(item.direction[0] * 0.5);
					item.translateZ(item.direction[1] * 0.5);
				}
				if (item.action === "fire") {
					if (item.fired == false) {
						createMonsterBullet(item);
						item.fired = true;
					}
				}
				if (item.action === "rot") {
					//item.lookAt(player1.model.position);
					let target = player1;
					if(app.doublePlayer)
					{
						let r=Math.floor(Math.random() * 100) + 1;
						if(r%2==0)
						{
							target=player2;
						}
					}
					
					let dx = item.position.x - target.model.position.x;
					let dz = item.position.z - target.model.position.z;
					let da = Math.atan(dx / dz);
					if (item.rotation.y < da) {
						item.rotation.y += 0.01;
					} else {
						item.rotation.y -= 0.01;
					}
				}
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

		evolveSmoke(delta);

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
					player1.life -= 100;
					item.life -= 100;

				}
				if (playerBox2 && playerBox2.intersectsBox(boxMeshBox)) {
					player2.life -= 100;
					item.life -= 100;

				}
				wallArr.forEach(wall => {
					let wallMeshBox = new THREE.Box3().setFromObject(wall);
					if (wallMeshBox.intersectsBox(boxMeshBox)) {
						item.life -= 100;
					}
				})
				bulletArr.filter(x => x.human).forEach(bullet => {

					let bulletMeshBox = new THREE.Box3().setFromObject(bullet.obj);
					if (bulletMeshBox.intersectsBox(boxMeshBox)) {
						bullet.alive = false;
						if (bullet.id == 1) {
							player1.score += 1;
							item.life -= player1.damage;
						} else {
							player2.score += 1;
							item.life -= player2.damage;
						}
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
		});

		bulletArr.filter(x => x.human == false).forEach(bullet => {
			let bulletMeshBox = new THREE.Box3().setFromObject(bullet.obj);
			if (playerBox.intersectsBox(bulletMeshBox)) {
				player1.life -= 2;
				bullet.alive = false;
			}
			if (playerBox2 && playerBox2.intersectsBox(bulletMeshBox)) {
				player2.life -= 2;
				bullet.alive = false;
			}
		});

		monsterArr.forEach(item => {
			if (item.life <= 0) {
				item.alive = false;
				bomMonster(item);
			}
		})
		if (player1.alive && player1.life <= 0) {
			switchAction(player1, "death");
			player1.alive = false;
		}
		if (player2.alive && player2.life <= 0) {
			switchAction(player2, "death");
			player2.alive = false;
		}
		app.player1Life = player1.life < 0 ? 0 : player1.life;
		app.player1Score = player1.score;
		app.player2Life = player2.life < 0 ? 0 : player2.life;
		app.player2Score = player2.score;
		app.level = gameLevel;
		uniforms.iTime.value += 0.05;
		stats.update();

		const timer = Date.now() * 0.000025;

		particleLight.position.x = Math.sin(timer * 7) * 500;
		particleLight.position.y = 300;
		particleLight.position.z = Math.cos(timer * 3) * 500;

		if (monsterCreated && monsterArr.length == 0) {
			monsterCreated = false;
			levelUp();
		}

		let needCompose = false;
		if (bulletArr.length > 0)
			needCompose = true;

		renderer.render(scene, camera);
		requestAnimationFrame(animate);
	}




	// keyborad control camera position
	document.addEventListener("keydown", (event) => {
		console.log(event, event.key);
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