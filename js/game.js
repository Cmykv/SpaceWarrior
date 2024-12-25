import * as THREE from 'three';
import {
	Tween
} from 'three/addons/libs/tween.module.js';

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
} from 'three/addons/objects/Water.js';
import {
	TextGeometry
} from 'three/addons/geometries/TextGeometry.js';
import {
	FontLoader
} from 'three/addons/loaders/FontLoader.js';
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
		level: 1,
		online: false,
		deviceId:''
	},
});

navigator.mediaDevices.enumerateDevices().then((mediaDevices) => {
        
        for (var mediaDevice of mediaDevices)
            if (mediaDevice.kind === "videoinput") {
				app.deviceId=mediaDevice.deviceId;
                break;
            }
       
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
document.getElementById("btn_start_3").onclick = () => {
	modal.style.display = "none";
	app.online = true;
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
	console.log(app.deviceId);
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
					//console.log(categoryName, categoryScore, handedness);
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
				deviceId: app.deviceId,
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
		foot: null,
		shootHelper: null,
		positionX: Math.floor(Math.random() * 400),
		positionZ: Math.floor(Math.random() * 400)
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
		foot: null,
		shootHelper: null,
		positionX: Math.floor(Math.random() * 400),
		positionZ: Math.floor(Math.random() * 400)
	};

	let onlinePlayers = [];


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
	let selectedObjects = [];
	let composer, effectFXAA, outlinePass;
	let audioObject = [];
	let smokeParticles = [];
	let enemyModel = null;
	const renderer = new THREE.WebGLRenderer({
		antialias: true
	});
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(
		innerWidth,
		innerHeight
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



	const vertexShader = `
	   void main() {
		   gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	   }
	   `;

	const fragmentShader = document.getElementById("fragmentShader").textContent;
	const floorShader = document.getElementById("floorShader").textContent;

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
				Math.random() * 3000 - 250,
				0,
				Math.random() * 3000 + 200
			);
			particle.rotation.y = -Math.PI;
			scene.add(particle);
			smokeParticles.push(particle);
		}

		const params1 = {
			color: '#aa0000',
			scale: 50,
			flowX: 50,
			flowY: 50
		};

		const waterGeometry = new THREE.PlaneGeometry(500, 500);

		water = new Water(
			waterGeometry, {
				textureWidth: 512,
				textureHeight: 512,
				waterNormals: new THREE.TextureLoader().load('./lib/waternormals.jpg', function(texture) {

					texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

				}),
				sunDirection: new THREE.Vector3(),
				sunColor: 0xffffff,
				waterColor: 0x0000ff,
				distortionScale: 50,
				fog: scene.fog !== undefined
			}
		);

		water.position.y = 1;
		water.rotation.x = Math.PI * -0.5;

		scene.add(water);

	}

	function setComposer() {
		composer = new EffectComposer(renderer);

		const renderPass = new RenderPass(scene, camera);
		composer.addPass(renderPass);

		outlinePass = new OutlinePass(new THREE.Vector2(innerWidth, innerHeight), scene, camera);
		outlinePass.edgeStrength = Number(3);
		outlinePass.edgeGlow = Number(0.1);
		outlinePass.edgeThickness = Number(1);
		outlinePass.pulsePeriod = Number(0);
		outlinePass.visibleEdgeColor.set('#ffffff');
		outlinePass.hiddenEdgeColor.set('#190a05');
		composer.addPass(outlinePass);
		const outputPass = new OutputPass();
		composer.addPass(outputPass);

		effectFXAA = new ShaderPass(FXAAShader);
		effectFXAA.uniforms['resolution'].value.set(1 / innerWidth, 1 / innerHeight);
		composer.addPass(effectFXAA);
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
		dirLight.position.set(0, 500, -300);
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
		for (let i = 0; i < 1; i++) {
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
		bullet.angle = 0;
		bullet.distance = 0;
		bullet.alive = true;
		bullet.id = 3;
		bullet.human = false;
		bulletArr.push(bullet);
	}

	let tween = null;

	function beShoot(player) {
		tween = new Tween(camera.position);
		tween.to({
				y: 210
			}, 80)
			.onUpdate(() => {})
			.yoyo(true)
			.repeat(1)
			.start();
	}


	const stoneMass = 120;
	let enemy_model;

	function momsterBegin() {
		createMonster();
	}


	function getRandomColor() {
		let colorArray = new Float32Array([Math.random(), Math.random(), Math.random()]);
		return 0xFFFFFF * Math.random();
	}

	function randomColor(model) {
		model.traverse(function(obj) {
			if (obj.isMesh) {
				obj.material = new THREE.MeshPhongMaterial({
					color: getRandomColor(),
					specular: '#0000ff',
					combine: THREE.MixOperation,
					reflectivity: 1,
					shininess: 5
				});
			}
		});
	}



	function createMonster() {
		let num = gameLevel + 0;
		for (let i = 0; i < num; i++) {
			let x = -500 + i * 400;;
			let y = 0;
			let z = 2500;
			const group = SkeletonUtils.clone(player1.model);
			randomColor(group);
			group.animationMixer = new THREE.AnimationMixer(group);
			group.actions = [];
			group.actions["idle"] = group.animationMixer.clipAction(clipActions[8]);
			group.actions["idle"].setEffectiveTimeScale(0.5);
			group.actions["death"] = group.animationMixer.clipAction(clipActions[7]);
			group.actions["shoot"] = group.animationMixer.clipAction(clipActions[6]);
			group.rotation.y = Math.PI;
			group.position.set(x, y, z);
			group.bom = false;
			group.bomTimer = 0;
			group.bomSpeed = 5;
			group.alive = true;
			group.speed = 5;
			group.angle = 0;
			group.life = 20;
			group.action = "idle";
			group.moveDuration = 900;
			group.rotDuration = 500;
			group.fireDuration = 600;
			group.actionClock = Date.now();
			group.targetRot = 0;
			group.fired = false;

			scene.add(group);
			group.currentAction = group.actions["idle"];
			group.currentAction.play();
			monsterArr.push(group);
		}
		monsterCreated = true;
	}

	/*
	 */
	function monsterAct(monster) {
		//console.log(monster);
		let t = Date.now();
		if (monster.action == "idle") {
			monster.translateZ(0.5);
			if (t - monster.actionClock > 3000) {

				monster.action = "fire";
				monster.fired = false;
				switchMonsterAction(monster, "shoot", 0.5);
				monster.actionClock = t;
			}
		}
		if (monster.action == "fire") {
			if (!monster.fired && (monster.currentAction.time >= monster.currentAction.getClip().duration)) {
				console.log("monster fired");
				createMonsterBullet(monster);
				monster.fired = true;
				monster.action = "idle";
				monster.actions["idle"].setEffectiveTimeScale(0.5);
				switchMonsterAction(monster, "idle", 0.5);
				monster.actionClock = t;
			}

		}
		if (monster.action == "death") {
			if (monster.currentAction.time >= monster.currentAction.getClip().duration) {
				monster.alive = false;
			}
		}


	}

	let fontMesh = null;

	function levelUp() {
		const fontLoader = new FontLoader();
		fontLoader.load("./lib/gentilis_bold.typeface.json", function(font) {
			const geometry = new TextGeometry('Level Up!', {
				font: font,
				size: 100,
				height: 5,
				curveSegments: 12,
				bevelEnabled: true,
				bevelThickness: 10,
				bevelSize: 2,
				bevelSegments: 5
			});
			const material = new THREE.MeshPhongMaterial({
				color: 0xff0000
			})
			fontMesh = new THREE.Mesh(geometry, material)
			fontMesh.position.set(0, 100, 500);
			fontMesh.rotation.y = Math.PI;
			scene.add(fontMesh);
		})

		setTimeout(removeFont, 1000);
	}

	let gameEnded = false;

	function gameOver() {
		if (gameEnded) return;
		gameEnded = true;
		const fontLoader = new FontLoader();
		fontLoader.load("./lib/gentilis_bold.typeface.json", function(font) {
			const geometry = new TextGeometry('Game over!', {
				font: font,
				size: 100,
				height: 5,
				curveSegments: 12,
				bevelEnabled: true,
				bevelThickness: 10,
				bevelSize: 2,
				bevelSegments: 5
			});
			const material = new THREE.MeshPhongMaterial({
				color: 0xff0000
			})
			fontMesh = new THREE.Mesh(geometry, material)
			fontMesh.position.set(0, 100, 500);
			fontMesh.rotation.y = Math.PI;
			scene.add(fontMesh);
		})

	}

	function removeFont() {
		console.log("remove font");
		if (fontMesh) {
			fontMesh.visible = false;
			scene.remove(fontMesh);
		}
		gameLevel += 1;
		createMonster();
	}



	function bomMonster(monster) {
		if (monster.bom)
			return;
		monster.traverse(function(obj) {

			if (obj.isMesh) {
				obj.material = new THREE.MeshPhongMaterial({
					color: 0xff0000,
					specular: 0xffffff,
					shininess: 100,
					combine: THREE.MixOperation,
					reflectivity: 1
				});
			}
		});
		monster.bom = true;
		monster.action = "death";
		switchMonsterAction(monster, "death", 0.5);
		audioObject["boom"].play();
	}



	const actionUrls = ["./model/walkforward.fbx",
		"./model/walkbackward.fbx",
		"./model/walkleft.fbx",
		"./model/walkright.fbx",
		"./model/idle.fbx",
		"./model/jumping.fbx",
		"./model/shooting.fbx",
		"./model/death.fbx",
		"./model/monster_walk.fbx"
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

						if (resFile.endsWith("m3.fbx")) {

							enemyModel = obj;
						} else {
							clipActions.push(obj.animations[0]);
						}

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

	let ws = null;

	function beginGame() {


		if (app.online) {
			if ('WebSocket' in window) {

				ws = new WebSocket('ws://122.51.11.127:80/websocket');

				ws.onopen = () => {
					console.log('websocket success---');
					ws.send('init ' + player1.positionX + ' ' + player1.positionZ);
					beginSync();
				}
				ws.onmessage = (message) => {
					let data = message.data;
					console.log('get websocket message---', data);
					if (data.indexOf('player') >= 0) {
						let list = data.split(' ');
						let obj = {
							id: parseInt(list[1]),
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
							foot: null,
							shootHelper: null,
							positionX: parseInt(list[2]),
							positionZ: parseInt(list[3])
						};
						crtOnlinePlayer(obj);
					}
					if (data.indexOf('key') >= 0) {
						let list = data.split(' ');
						doOnlinePlayerAct(parseInt(list[2]), list[1]);
					}
				}
				ws.onerror = () => {
					console.error('websocket fail');
				}
			} else {
				console.error('dont support websocket');
			};
		}

		player2.model = SkeletonUtils.clone(player1.model);
		initPlayer(player2, new THREE.Vector3(player2.positionX, 0, player2.positionZ));
		if (!app.doublePlayer) {
			player2.model.visible = false;
			player2.foot.visible = false;
			player2.shootHelper.visible = false;
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

		selectedObjects = [];
		selectedObjects.push(player1.model);
		outlinePass.selectedObjects = selectedObjects;
		

		//////////////////////////////////////
		
		momsterBegin();
		animate();

	}
	
	function beginSync()
	{
		setInterval(()=>{
			if(ws)
			{
				ws.send('sync ' + player1.model.position.x + ' ' + player1.model.position.z);
			}
		},300);
	}

	function crtOnlinePlayer(player) {
		player.model = SkeletonUtils.clone(player1.model);
		player.model.castShadow = true;
		player.model.children.forEach(child => {
			child.castShadow = true;
		});
		scene.add(player.model);
		player.model.position.set(player.positionX, 0, player.positionZ);
		player.animationMixer = new THREE.AnimationMixer(player.model);
		player.actions["walk_forward"] = player.animationMixer.clipAction(clipActions[0]);
		player.actions["walk_backward"] = player.animationMixer.clipAction(clipActions[1]);
		player.actions["walk_left"] = player.animationMixer.clipAction(clipActions[2]);
		player.actions["walk_right"] = player.animationMixer.clipAction(clipActions[3]);
		player.actions["idle"] = player.animationMixer.clipAction(clipActions[4]);
		player.actions["jump"] = player.animationMixer.clipAction(clipActions[5]);
		player.actions["shoot"] = player.animationMixer.clipAction(clipActions[6]);
		player.actions["death"] = player.animationMixer.clipAction(clipActions[7]);
		player.actions["idle"].play();
		player.currentActionName = "idle";
		player.currentAction = player.actions["idle"];

		onlinePlayers.push(player);

	}

	function doOnlinePlayerAct(id, key) {
		let player = null;
		onlinePlayers.forEach(item => {
			if (item.id === id) {
				player = item;
			}
		})
		if (player) {
			switch (key) {
				case "w":
					switchAction(player, 'walk_forward');
					break;
				case "a":
					switchAction(player, 'walk_left');
					break;
				case "d":
					switchAction(player, 'walk_right');
					break;
				case "s":
					switchAction(player, 'walk_backward');
					break;
				case "j":
					switchAction(player, 'shoot');
					break;
				case "k":
					switchAction(player, 'jump');
					break;
			}
		}
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
		let color = 0xff0000;
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


		const points = [];
		points.push(new THREE.Vector3(0, 0, 0));
		points.push(new THREE.Vector3(0, 0, 3000));
		const sline = new THREE.BufferGeometry().setFromPoints(points);
		let lineMaterial = new THREE.LineBasicMaterial({
			color: 0xffffff
		});
		let line = new THREE.Line(sline, lineMaterial);
		line.position.set(pos.x, 120, pos.z);
		scene.add(line);
		player.shootHelper = line;
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

	function switchMonsterAction(player, newActionName, fadeDuration = 0.1) {
		if (newActionName !== 'death' && newActionName !== 'idle' && !player.alive) {
			return;
		}
		//console.log("switch to action " + newActionName, player.id)
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

			player.currentAction.setEffectiveTimeScale(1);
			player.currentAction.setEffectiveWeight(1);
			player.currentAction.fadeIn(fadeDuration).play();
		} else if (newAction && player.currentAction === newAction && newActionName === 'shoot') {
			//console.log("need to fire");
		}
	}

	function setFloor() {

		const floorMap = textureLoader.load("./lib/floor.jpg");
		const floorMaterial = new THREE.MeshPhongMaterial({
			specular: '#785b05',
			shininess: 1,
			map: floorMap
		});
		floorMaterial.map.colorSpace = THREE.SRGBColorSpace;
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), floorMaterial);
		mesh.rotation.x = -Math.PI / 2;
		mesh.receiveShadow = true;
		scene.add(mesh);
	}







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
	setComposer();
	setHelper();
	setControll();
	createWall();
	loadAvatar(player1, new THREE.Vector3(player1.positionX, 0, player1.positionZ));
	loadMp3();

	let colors = ["red", "blue", "green"];

	const params = {
		showPlayer1Skeleton: false,
		showPlayer2Skeleton: false,
		player1Color: "none",
		player2Color: "none",
		player1Halo: true,
		player2Halo: true,
		player1ShootHelper: true,
		player2ShootHelper: true,
		useComposer: false
	};
	const gui = new GUI({
		width: 280
	});
	gui.domElement.id = 'gui';
	gui.domElement.style.marginTop = '450px';

	gui.add(params, 'useComposer').onChange(function(value) {

		params.useComposer = value;

	});

	gui.add(params, 'showPlayer1Skeleton').onChange(function(value) {

		player1.skeletonHelper.visible = value;

	});
	gui.add(params, 'player1Halo').onChange(function(value) {

		player1.foot.visible = value;

	});
	gui.add(params, 'player1ShootHelper').onChange(function(value) {

		player1.shootHelper.visible = value;

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
		gui.add(params, 'player2ShootHelper').onChange(function(value) {

			player2.shootHelper.visible = value;

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
				if (player.foot) player.foot.position.z = player.model.position.z;
				if (player.shootHelper) player.shootHelper.position.z = player.model.position.z;
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
				if (player.foot) player.foot.position.z = player.model.position.z;
				if (player.shootHelper) player.shootHelper.position.z = player.model.position.z;
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
				let dx = 4;
				player.model.position.x += dx;
				if (player.foot)
					player.foot.position.x = player.model.position.x;
				if (player.shootHelper)
					player.shootHelper.position.x = player.model.position.x;
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
				let dx = -4;
				player.model.position.x += dx;
				if (player.foot) player.foot.position.x = player.model.position.x;
				if (player.shootHelper) player.shootHelper.position.x = player.model.position.x;
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
			} else {
				scene.remove(item);
			}
		});
		monsterArr = monsterList;

		monsterArr.forEach(item => {

			if (item.alive) {
				monsterAct(item);
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
		monsterArr.forEach(item => {

			if (item.alive || item.bom) {
				item.animationMixer.update(delta);
			}
		});

		handleActions(player1);
		if (app.doublePlayer)
			handleActions(player2);
		onlinePlayers.forEach(item => {
			item.animationMixer.update(delta);
			handleActions(item);
		})

		// check collide
		let playerBox = new THREE.Box3().setFromObject(player1.model);
		let playerBox2 = null;
		if (app.doublePlayer)
			playerBox2 = new THREE.Box3().setFromObject(player2.model);
		monsterArr.forEach(item => {
			if (item.alive && !item.bom) {
				let boxMeshBox = new THREE.Box3().setFromObject(item);
				//console.log(boxMeshBox);
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
				beShoot(player1);
				player1.life -= 2;
				bullet.alive = false;
			}
			if (playerBox2 && playerBox2.intersectsBox(bulletMeshBox)) {
				beShoot(player2);
				player2.life -= 2;
				bullet.alive = false;
			}
			onlinePlayers.forEach(obj => {
				let box = new THREE.Box3().setFromObject(obj.model);
				if (playerBox.intersectsBox(bulletMeshBox)) {
					obj.life -= 2;
					bullet.alive = false;
				}
			})
		});

		monsterArr.forEach(item => {
			if (item.life <= 0) {
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
		water.material.uniforms['time'].value += 1.0 / 60.0;
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

		if (app.doublePlayer) {
			if (!player1.alive && !player2.alive) {
				gameOver();
			}
		} else {
			if (!player1.alive) {
				gameOver();
			}
		}
		if (tween) {
			tween.update();
		}
		if (params.useComposer)
			composer.render();
		else
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
				if (ws)
					ws.send("key w")
				break;
			case "a":
				switchAction(player1, 'walk_left');
				if (ws)
					ws.send("key a")
				//avatar.rotation.y = avatarRotY;
				break;
			case "d":
				switchAction(player1, 'walk_right');
				if (ws)
					ws.send("key d")
				//avatar.rotation.y = avatarRotY;
				break;
			case "s":
				switchAction(player1, 'walk_backward');
				if (ws)
					ws.send("key s")
				//avatar.rotation.y = avatarRotY;
				break;
			case "j":
				switchAction(player1, 'shoot');
				if (ws)
					ws.send("key j")
				break;
			case "k":
				switchAction(player1, 'jump');
				if (ws)
					ws.send("key k")
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