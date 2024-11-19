const theModel = {
	"name": "Vanguard",
	"path": "model/Vanguard.fbx",
	"type": "fbx",
	"isBuildIn": true,
	"picBg": "model/Vanguard.png",
	"accessories": {
		"Shoes": "Bodybaked_6",
		"Pants": "Bodybaked_5"
	}
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
		failedText: "加载失败",
	},
});

var avatar = null;
var avatarRotY = 0;
var actions = [];
var currentActionName = "idle";
var currentAction = null;
var previousAction = null;
var animationMixer = null;
var clock = new THREE.Clock();
// gltf and vrm
var loader = null;
var bulletArr = [];
var innerWidth = document.querySelector("#model").clientWidth;
var innerHeight = document.querySelector("#model").clientHeight;
const scene = new THREE.Scene();
var skeletonHelper;
let composer;

function setBackground() {
	const textureLoader = new THREE.TextureLoader();
	textureLoader.load('./model/universe.png', function(texture) {
		// 将纹理设置为场景背景
		scene.background = texture;
	});
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

function readMoveJson() {
	fetch('./model/dance.json').then(response => {
		if (!response.ok) {
			throw new Error("read error")
		}
		return response.json()
	}).then(data => {
		console.log(data)
	}).catch(error => {
		console.error("read json error", error)
	})
}

const textureLoader = new THREE.TextureLoader();
//const map = textureLoader.load('./lib/lensflare/lensflare0.png');

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
	bullet.angle = avatarRotY;
	bullet.distance = 0;
	bulletArr.push(bullet)
}


function loadAvatar() {
	if (theModel.type == "fbx") {
		loader = new THREE.FBXLoader();
	} else {
		loader = new THREE.GLTFLoader();
	}
	loader.crossOrigin = "anonymous";
	loader.load(
		// URL of the VRM you want to load
		theModel.path,

		// called when the resource is loaded
		(gltf) => {
			var model = null;
			if (theModel.type == "fbx") {
				model = gltf;
				gltf.scale.set(0.01, 0.01, 0.01);
			} else {
				model = gltf.scene;
			}
			skeletonHelper = new THREE.SkeletonHelper(model);
			skeletonHelper.visible = false;
			skeletonHelper.material.linewidth = 30;

			scene.add(skeletonHelper);


			if (theModel.type == "vrm") {
				THREE.VRMUtils.removeUnnecessaryVertices(model);
				THREE.VRMUtils.removeUnnecessaryJoints(model);

				// generate VRM instance from gltf
				THREE.VRM.from(gltf).then((vrm) => {
					console.log(vrm);
					scene.add(vrm.scene);
					avatar = vrm.scene;
					app.loaded = true;

					vrm.humanoid.getBoneNode(
						THREE.VRMSchema.HumanoidBoneName.Hips
					).rotation.y = Math.PI;
				});
			} else {
				model.castShadow = true;
				model.children.forEach(child => {
					// 设置每个子对象的 castShadow 属性为 true
					child.castShadow = true;
				});
				scene.add(model);
				avatar = model;
				avatarRotY = model.rotation.y;
				app.loaded = true;
				//skeletonHelper.bones[0].rotation.y = Math.PI;
				//avatarRotY = Math.PI;
				animationMixer = new THREE.AnimationMixer(avatar);
				loadActions();

			}

			setupDatGui();
			var bones = [];
			for (var i in skeletonHelper.bones)
				bones.push({
					index: i,
					name: skeletonHelper.bones[i].name,
				});
			app.bones = bones;
			mdui.mutation();
		},

		// called while loading is progressing
		(progress) =>
		console.log(
			"Loading model...",
			100.0 * (progress.loaded / progress.total),
			"%"
		),

		// called when loading has errors
		(error) => {
			app.failed = app.loaded = true;
			console.log(error);
		}
	);
}

function setHelper() {
	// helpers
	const gridHelper = new THREE.GridHelper(50, 50);
	gridHelper.receiveShadow = true;
	scene.add(gridHelper);

	const axesHelper = new THREE.AxesHelper(50);
	scene.add(axesHelper);
}

function getCenter() {
	const selectedDecorationBbox = new THREE.Box3().setFromObject(avatar);
	var center = new THREE.Vector3();
	let midPoint = selectedDecorationBbox.getCenter(center);
}

function loadActions() {
	var loader = new THREE.FBXLoader();
	loader.load('./model/walkforward.fbx', function(gltf) {
		gltf.animations.forEach((clip) => {
			//console.log(clip)
			actions["walk_forward"] = animationMixer.clipAction(clip);
		});

	});
	loader.load('./model/walkbackward.fbx', function(gltf) {
		gltf.animations.forEach((clip) => {
			//console.log(clip)
			actions["walk_backward"] = animationMixer.clipAction(clip);
		});

	});
	loader.load('./model/walkleft.fbx', function(gltf) {
		gltf.animations.forEach((clip) => {
			//console.log(clip)
			actions["walk_left"] = animationMixer.clipAction(clip);
		});

	});
	loader.load('./model/walkright.fbx', function(gltf) {
		gltf.animations.forEach((clip) => {
			//console.log(clip)
			actions["walk_right"] = animationMixer.clipAction(clip);
		});

	});
	loader.load('./model/idle.fbx', function(gltf) {
		gltf.animations.forEach((clip) => {
			//console.log(clip)
			actions["idle"] = animationMixer.clipAction(clip);
		});

	});
	loader.load('./model/jumping.fbx', function(gltf) {
		gltf.animations.forEach((clip) => {
			//console.log(clip)
			actions["jump"] = animationMixer.clipAction(clip);
		});

	});
	loader.load('./model/shooting.fbx', function(gltf) {
		gltf.animations.forEach((clip) => {
			//console.log(clip)
			actions["shoot"] = animationMixer.clipAction(clip);
		});

	});
	loader.load('./model/death.fbx', function(gltf) {
		gltf.animations.forEach((clip) => {
			//console.log(clip)
			actions["death"] = animationMixer.clipAction(clip);
		});

	});
	setTimeout(() => {
		console.log(actions)
		actions["idle"].play()
		currentAction = actions["idle"];
		currentActionName = "idle";
	}, 2000)

}

function switchAction(newActionName, fadeDuration = 0.1) {
	console.log("switch to action " + newActionName)
	const newAction = actions[newActionName];
	if (newAction && currentAction !== newAction) {
		previousAction = currentAction; // 保留当前的动作
		// 淡出前一个动作
		if (previousAction) {
			previousAction.fadeOut(fadeDuration);
		}

		// 如果切换到 jump 动作，设置播放一次并在结束后停止
		if (newActionName === 'jump' || newActionName === 'death' ||
			newActionName === 'walk_forward' || newActionName === 'shoot' ||
			newActionName === 'walk_backward' || newActionName === 'walk_left' ||
			newActionName === 'walk_right') {
			newAction.loop = THREE.LoopOnce;
			newAction.clampWhenFinished = true; // 停止在最后一帧
		}

		currentAction = newAction; // 设置新的活动动作

		// 复位并淡入新动作
		currentAction.reset();
		currentAction.setEffectiveTimeScale(1);
		currentAction.setEffectiveWeight(1);
		currentAction.fadeIn(fadeDuration).play();
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
		new THREE.Vector2(document.querySelector("#model").clientWidth, document.querySelector("#model")
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

//setBackground();
setFloor();
loadAvatar();
setLight();
//setHelper();
//setControll();
initComposer();
createBox();


function animate() {
	if (animationMixer != null)
		animationMixer.update(clock.getDelta());

	let bulletList = [];
	bulletArr.forEach(item => {
		if (item.distance < 30)
			bulletList.push(item);
		else
			scene.remove(item.obj)
	})
	bulletArr = bulletList;


	if (
		(currentAction === actions['walk_forward'] || currentAction === actions['jump'] ||
			currentAction === actions['shoot'] || currentAction === actions['walk_backward'] ||
			currentAction === actions['walk_left'] || currentAction === actions['walk_right']) &&
		currentAction.time >= currentAction.getClip().duration
	) {
		console.log(avatar.position);
		if (currentAction === actions['shoot'])
			createBullet(avatar.position);
		switchAction('idle', 0.1);
	}
	bulletArr.forEach(item => {
		var dx = item.speed * Math.sin(item.angle);
		var dz = item.speed * Math.cos(item.angle);
		item.obj.position.x += dx;
		item.obj.position.z += dz;
		item.distance += item.speed;
	})


	// 当处于 running 动作时，移动相机
	if (
		currentAction === actions['walk_forward']
	) {
		var dz = 0.03;
		avatar.position.z += dz;
		camera.position.z += dz;
	}
	if (
		currentAction === actions['walk_backward']
	) {
		var dz = -0.03;
		avatar.position.z += dz;
		camera.position.z += dz;
	}
	if (
		currentAction === actions['walk_left']
	) {
		var dx = 0.03;
		avatar.position.x += dx;
		camera.position.x += dx;
	}
	if (
		currentAction === actions['walk_right']
	) {
		var dx = -0.03;
		avatar.position.x += dx;
		camera.position.x += dx;
	}
	if (avatar != null) {
		// 更新控制器的目标为NPC的位置
		const walkerPosition = avatar.position.clone();
		//controls.target = new THREE.Vector3(walkerPosition.x, 1.0, walkerPosition.z);
		//camera.position.x = 10 * Math.sin(avatarRotY) + walkerPosition.x;
		//camera.position.z = -10 * Math.cos(avatarRotY) + walkerPosition.z;
		camera.lookAt(walkerPosition);
	}

	//composer.render();
	renderer.render(scene, camera);
	requestAnimationFrame(animate);
}

animate();

var GUI = lil.GUI;
var gui = new GUI();
gui.hide();

function setupDatGui() {
	let folder = gui.addFolder("Settings");

	folder.add(skeletonHelper, "visible");
	setTimeout(() => {
		folder.add(avatar, "visible");
		folder.controllers[3].name("Show Avatar");
	}, 5000);
	folder.controllers[0].name("Show Skeleton");

	folder.add(camera.position, "z", -10, 10);
	folder.controllers[1].name("camera distance");

	folder.add(app, "doublePlayer");
	folder.controllers[2].name("double player");




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
			switchAction('walk_forward');
			break;
		case "a":
			switchAction('walk_left');
			//avatar.rotation.y = avatarRotY;
			break;
		case "d":
			switchAction('walk_right');
			//avatar.rotation.y = avatarRotY;
			break;
		case "s":
			switchAction('walk_backward');
			//avatar.rotation.y = avatarRotY;
			break;
		case "j":
			switchAction('shoot');
			break;
		case "k":
			switchAction('jump');
			break;
	}
});