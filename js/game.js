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
		showSketelon: false,
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
	var lightBoosterAmbient = app.model.lightAmbient ?
		app.model.lightAmbient :
		1.0;
	var lightBoosterDirectionalHigh = app.model.lightDirectionalHigh ?
		app.model.lightDirectionalHigh :
		1.0;
	var lightBoosterDirectional = app.model.lightDirectional ?
		app.model.lightDirectional :
		0.0;

	const light = new THREE.AmbientLight(
		0xffffff,
		0.8 * lightBoosterAmbient
	);
	light.position.set(10.0, 10.0, 10.0).normalize();
	scene.add(light);
	var light2 = new THREE.DirectionalLight(
		0xffffff,
		1 * lightBoosterDirectionalHigh
	);
	light2.position.set(0, 3, 2);
	light2.castShadow = true;
	scene.add(light2);
	var light3 = new THREE.DirectionalLight(
		0xffffff,
		1 * lightBoosterDirectional
	);
	light3.position.set(0, 0, 2);
	light3.castShadow = true;
	scene.add(light3);
}

function createBox() {
	cubeGeometry = new THREE.BoxGeometry(1, 4, 1);
	cubeMaterial = new THREE.MeshDepthMaterial({
		color: 0x444fff
	});

	cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
	cube.position.x = 3;
	cube.position.y = 0.5;
	cube.position.z = 3;

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


function createBullet(pos) {
	let sphere = createGlowBall();
	sphere.position.x = pos.x + 0;
	sphere.position.y = 1.3;
	sphere.position.z = pos.z + 0.8;

	scene.add(sphere);
	var bullet = {};
	bullet.obj = sphere;
	bullet.speed = 0.1;
	bullet.angle = avatarRotY;
	bullet.distance = 0;
	bulletArr.push(bullet)
}

function createGlowBall() {
	const haloVertexShader = /*glsl*/ `
	
	uniform vec3 viewVector;
	uniform float c;
	uniform float p;
	varying float intensity;
	void main() 
	{
	    vec3 vNormal = normalize( normalMatrix * normal );
		vec3 vNormel = normalize( normalMatrix * viewVector );
		intensity = pow( c - dot(vNormal, vNormel), p );
		
	    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
	}
	`;

	const haloFragmentShader = /*glsl*/ `
	
	uniform vec3 glowColor;
	varying float intensity;
	void main() 
	{
		vec3 glow = glowColor * intensity;
	    gl_FragColor = vec4( glow, 1.0 );
	}
	`;

	const halo = new THREE.Mesh(

		new THREE.SphereGeometry(0.1, 50, 50),

		new THREE.ShaderMaterial( 
			{
			    uniforms: 
				{ 
					"c":   { type: "f", value: 1.0 },
					"p":   { type: "f", value: 1.4 },
					glowColor: { type: "c", value: new THREE.Color(0xff0000) },
					viewVector: { type: "v3", value: camera.position }
				},
				vertexShader: haloVertexShader,
				fragmentShader:haloFragmentShader,
				side: THREE.FrontSide,
				blending: THREE.AdditiveBlending,
				transparent: false
			}   ));
	return halo;

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
renderer.toneMapping = THREE.ACESFilmicToneMapping; // 色调映射
renderer.toneMappingExposure = 0.7; // 色调映射曝光
renderer.setPixelRatio(window.devicePixelRatio);
// renderer.setClearColor(0x000000,1); //设置背景颜色
document.querySelector("#model").appendChild(renderer.domElement);




// camera
const camera = new THREE.PerspectiveCamera(
	30.0,
	document.querySelector("#model").clientWidth /
	document.querySelector("#model").clientHeight,
	0.1,
	20.0
);
camera.position.set(0, 3, -10);

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
loadAvatar();
setLight();
setHelper();
//setControll();
createBox();




function animate() {
	requestAnimationFrame(animate);
	if (animationMixer != null)
		animationMixer.update(clock.getDelta());

	let bulletList = [];
	bulletArr.forEach(item => {
		if (item.distance < 30)
			bulletList.push(item);
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



	renderer.render(scene, camera);
}

animate();

var GUI = lil.GUI;
var gui = new GUI();
gui.hide();

function setupDatGui() {
	let folder = gui.addFolder("Skeletons");

	folder.add(skeletonHelper, "visible");
	setTimeout(() => {
		folder.add(avatar, "visible");
		folder.controllers[1].name("Show Avatar");
	}, 5000);
	folder.controllers[0].name("Show Skeleton");

	const bones = skeletonHelper.bones;

	for (let i = 0; i < bones.length; i++) {
		const bone = bones[i];

		folder = gui.addFolder("Bone: " + bone.name);

		if (i == 0) {
			folder.add(
				bone.position,
				"x",
				-10 + bone.position.x,
				10 + bone.position.x
			);
			folder.add(
				bone.position,
				"y",
				-10 + bone.position.y,
				10 + bone.position.y
			);
			folder.add(
				bone.position,
				"z",
				-10 + bone.position.z,
				10 + bone.position.z
			);
		}

		folder.add(bone.rotation, "x", -Math.PI, Math.PI);
		folder.add(bone.rotation, "y", -Math.PI, Math.PI);
		folder.add(bone.rotation, "z", -Math.PI, Math.PI);
		if (i == 0) {
			folder.controllers[0].name("position.x");
			folder.controllers[1].name("position.y");
			folder.controllers[2].name("position.z");
			folder.controllers[3].name("rotation.x");
			folder.controllers[4].name("rotation.y");
			folder.controllers[5].name("rotation.z");
		} else {
			folder.controllers[0].name("rotation.x");
			folder.controllers[1].name("rotation.y");
			folder.controllers[2].name("rotation.z");
		}
	}
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