import * as THREE from '../external/three.module.js';
import {TrackballControls} from '../external/TrackballControls.js';

import {LogoVertexShader} from './glsl/logo.vertex.glsl.js';
import {LogoFragmentShader} from './glsl/logo.fragment.glsl.js';

window.THREE = THREE;
export class TriangulatedLogo{
	constructor(){
		this.introFinished = false;
		this.completeIntroCount = 0;
		this.completeIntroTotal = 3;
		this.meshes = {};
		//this.loadLogo();
		
		//this.initLogo();
	}
	loadStaticJSONLogo(assetName,positionParams){
		return new Promise((resolve,reject)=>{
			let complete = 0;
			let total = 2;
			let colors = [];
			let positions = [];
			fetch('./intro/data/'+assetName+'.colors.json').then(d=>d.json()).then(data=>{
				colors = data;
				complete++;
				if(complete == total){
					//done
					this.processStaticLogo(assetName,colors,positions,positionParams,resolve)
				}

			})
			fetch('./intro/data/'+assetName+'.positions.json').then(d=>d.json()).then(data=>{
				positions = data;
				complete++;
				if(complete == total){
					//done
					this.processStaticLogo(assetName,colors,positions,positionParams,resolve)
				}
			})
		})
	}
	processStaticLogo(assetName,colors,positions,positionParams,resolve){
		const cellCount = positions.length / 9;
		const {directions,centroids,faces,opacity,normals} = this.getRandomData(cellCount);

		const logoColors = colors;
		const logoDirections = directions;
		const logoPositions = positions;
		const logoFaces = faces;
		const logoCentroids = centroids;
		const logoOpacity = opacity;
		const logoNormals = normals;
		const logoAssets = {
			logoColors,
			logoDirections,
			logoPositions,
			logoFaces,
			logoCentroids,
			logoOpacity,
			logoNormals
		};
		resolve(this.initLogo(logoAssets,positionParams,true));
	}
	
	
	getRandomData(cellTotalNumber){
		let directions = [];
		let centroids = [];
		let faces = [];
		let opacity = [];
		let normals = [];
		for(let i=0;i<cellTotalNumber;i++){
			const randomDirX = Math.random() * 500 - 250;
			const randomDirY = Math.random() * 500 - 250;
			const randomDirZ = Math.random() * 500 - 250;

			const randomCentroidX = Math.random() * 1000 - 500;
			const randomCentroidY = Math.random() * 1000 - 500;
			const randomCentroidZ = Math.random() * 1000 - 500;

			directions.push(randomDirX,randomDirY,randomDirZ);
			directions.push(randomDirX,randomDirY,randomDirZ);
			directions.push(randomDirX,randomDirY,randomDirZ);
			/*const dirVec3 = new THREE.Vector3(randomDirX,randomDirY,randomDirZ)
			directions.push(dirVec3,dirVec3,dirVec3);*/
			centroids.push(randomCentroidX,randomCentroidY,randomCentroidZ);
			centroids.push(randomCentroidX,randomCentroidY,randomCentroidZ);
			centroids.push(randomCentroidX,randomCentroidY,randomCentroidZ);
			/*const centroidVec3 = new THREE.Vector3(randomCentroidX,randomCentroidY,randomCentroidZ);
			centroids.push(centroidVec3,centroidVec3,centroidVec3);*/
			normals.push(0,0,0);

			for(let f=0;f<3;f++){
				faces.push(i*3+f);
			}
			opacity.push(1.0,1.0,1.0);
		}

		return {
			directions,
			centroids,
			faces,
			normals,
			opacity
		}
	}
	
	getDynamicScreenInitBounds(params){
		//positionParams.cellPos.cols,positionParams.cellPos.rows,positionParams.cellPos.rowPos,positionParams.cellPos.colPos
		//colSpan?,rowSpan?
		const colSpan = params.colSpan ? params.colSpan : 1;
		const rowSpan = params.rowSpan ? params.rowSpan : 1;
		const topLeft = new THREE.Vector3( -1, 1, -1 ).unproject( this.camera );
		const topRight = new THREE.Vector3( 1, 1, -1 ).unproject( this.camera );
		const bottomLeft = new THREE.Vector3( -1, -1, -1 ).unproject( this.camera );
		const bottomRight = new THREE.Vector3( 1, 1, -1 ).unproject( this.camera );
		const width = Math.abs(topRight.x - topLeft.x);
		const height = Math.abs(topRight.y + bottomRight.y);
		const z = topLeft.z;
		const colW = width / params.cols * colSpan;
		const rowH = height / params.rows * rowSpan;
		//console.log('rowH',rowH,height/params.rows,rowSpan)
		const cellX = topLeft.x + (params.colPos * colW);
		const cellY = topRight.y - (rowH + (params.rowPos) * rowH);
		const centerX = cellX + (colW/2);
		const centerY = cellY + (rowH/2);
		return {
			center:new THREE.Vector3(centerX,centerY,z),
			width:colW,
			height:rowH
		}
	}
	getScreenInitBounds(){
		const topLeft = new THREE.Vector3( -1, 1, -1 ).unproject( this.camera );
		const topRight = new THREE.Vector3( 1, 1, -1 ).unproject( this.camera );
		const bottomLeft = new THREE.Vector3( -1, -1, -1 ).unproject( this.camera );
		const bottomRight = new THREE.Vector3( 1, 1, -1 ).unproject( this.camera );
		const width = Math.abs(topRight.x - topLeft.x);
		const height = Math.abs(topRight.y + bottomRight.y);
		const z = topLeft.z;
		const projectedBounds = {
			center: new THREE.Vector3(0,0,z),
			width:width,
			height:height
		}
		return projectedBounds
	}
	
	setMeshPosition(mesh,positionParams){
		//center the mesh in the screen space
		//let {projectedBounds};
		let projectedBounds;
		if(typeof positionParams.cellPos != "undefined"){
			//console.log('cellpos',positionParams.cellPos);
			projectedBounds = this.getDynamicScreenInitBounds(positionParams.cellPos);
		}
		else{
			projectedBounds = this.getScreenInitBounds();
		}
		
		
		const box = new THREE.BoxHelper( mesh, 0xffff00 );
		//this.scene.add( box );
		//console.log('box',box);
		const size = new THREE.Vector3();
		const box3 = new THREE.Box3();
		box3.setFromObject(box);
		box3.getSize(size);
		//console.log('boxsize',size);
		let scale;
		/*if(typeof positionParams.size != "undefined"){
			size.x *= positionParams.size;
			size.y *= positionParams.size;
		}*/
		
		if(size.x > size.y){
			scale = (projectedBounds.width / size.x);
		}
		//mesh.scale.x = scale;
		//mesh.scale.y = scale;
		const maxDim = Math.max(size.x,size.y);
		
		let aspectRatio = 1;//size.x > size.y ? width/height : 1;
		let padding = 2.5;
		if(typeof positionParams.logo != "undefined"){
			padding = 5.0//2.5;
			if(typeof positionParams.padding != "undefined"){
				padding = positionParams.padding;
			}
			if($(window).width() < $(window).height()){
				padding = 14.5;
			}
		}
		if(size.x >= size.y){
			aspectRatio = Math.min(projectedBounds.width/projectedBounds.height,size.x/size.y);
			//padding = 1.5;
		}
		if(size.x == size.y){
			//padding = 2.0;
		}


		const cameraZ = maxDim / 2 / aspectRatio /  Math.tan(Math.PI * this.camera.fov / 360) * padding; //distance from the camera to fill the screen
		
		const projCenter = this.getProjectedPoint(projectedBounds.center,cameraZ);
		mesh.position.x = projCenter.x - (size.x/2);// - (size.x/2 * scale);
		mesh.position.y = projCenter.y + (size.y/2);// + (size.y/2 * scale);
		mesh.position.z = -cameraZ;

		let minDist;
		let minDistW,minDistH;
		const projTop = this.getProjectedPoint(new THREE.Vector3(0,projectedBounds.height/1.3,projectedBounds.center.z),cameraZ);
		const projLeft = this.getProjectedPoint(new THREE.Vector3(projectedBounds.width/1.3,0,projectedBounds.center.z),cameraZ);
		
		minDistW = projCenter.distanceTo(projLeft); //dist from center to horizontal edge
		minDistH = projCenter.distanceTo(projTop); //dist from center to top edge

		if(projectedBounds.width > projectedBounds.height){
			minDist = projCenter.distanceTo(projTop);//(projectedBounds.height - projCenter.y) / 2
		}
		else{
			minDist = projCenter.distanceTo(projLeft);//(projectedBounds.width - projCenter.x) / 2
		}
		switch(positionParams.type){
			case 'radial':
				const offsetX = Math.sin(positionParams.radian) * minDist;
				const offsetY = Math.cos(positionParams.radian) * minDist;
				//console.log('offsetX',offsetX,offsetY);
				mesh.position.x += offsetX;
				mesh.position.y += offsetY;
			break;
			default:
			break;
			case 'static':
				const top = minDistH * positionParams.top;
				const left = minDistW * positionParams.left;
				mesh.position.y -= top;
				mesh.position.x += left;
			break;
		}
		let color;
		if(typeof positionParams.logo != "undefined"){
			color = 0x111111;
			const box3Mat = new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.0});
			const topLeft = projectedBounds.center.clone();
			topLeft.x -= projectedBounds.width/2;
			topLeft.y += projectedBounds.height/2;
			const bottomRight = projectedBounds.center.clone();
			bottomRight.x += projectedBounds.width/2;
			bottomRight.y -= projectedBounds.height/2;
			const tlProj = this.getProjectedPoint(topLeft,cameraZ);
			const brProj = this.getProjectedPoint(bottomRight,cameraZ);

			const box3Mesh = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(brProj.x - tlProj.x),Math.abs(tlProj.y - brProj.y),16),box3Mat);
			box3Mesh.position.x = mesh.position.x + size.x/2;
			box3Mesh.position.y = mesh.position.y - size.y/2;
			box3Mesh.position.z = mesh.position.z;//-cameraZ-0.1;
			box3Mesh.userData.futurePos = -cameraZ-0.1;
			this.scene.add(box3Mesh);
			mesh.userData.box = box3Mesh;
			this.meshes[mesh.uuid] = {mesh,box3Mesh,positionParams};
		}
		


	}
	getProjectedPoint(vec3,targetZ){
		//gen projected center of our mesh to position it with
		const projCenter = new THREE.Vector3();
		const center = vec3.clone();
		center.sub( this.camera.position ).normalize();
		const distance = ( -targetZ - this.camera.position.z ) / center.z;
		projCenter.copy( this.camera.position ).add( center.multiplyScalar( distance ) );

		return projCenter;
	}
	linearScale(value, istart, istop, ostart, ostop) {
		return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
	};
	getDimensions(){
		return {
			width:$('#introLogo').width(),
			height:$('#introLogo').height()
		}
	}
	checkIsAndroid() {
	    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

	    if (/android/i.test(userAgent)) {
	        return true;
	    }
	    return false;
	}
	initLogo(logoAssets,params,isStaticJSON){
		
		this.shouldRenderLogo = true;
		if(typeof this.scene == "undefined"){
			let pixelRatio = window.devicePixelRatio;
			if(this.checkIsAndroid()){
				pixelRatio = 1;
			}
			this.scene = new THREE.Scene();
			this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 100000 );
			this.shouldAnimate = true;
			this.renderer = new THREE.WebGLRenderer({
				antialias: true,
				devicePixelRatio: pixelRatio,
				alpha:true
			})
			this.renderer.setPixelRatio(pixelRatio);
			this.renderer.setClearColor(0x111111, 0.0)
			this.camera.position.z = 100;
			this.camera.lookAt(new THREE.Vector3(0,0,0));
			
			const width = $('#introLogo').width();
			const height = $('#introLogo').height();
			this.renderer.setSize(width,height);
			$('#introLogo').append( this.renderer.domElement );
			//this.animate();
			setTimeout(()=>{
				this.buildCircle();
			},2000)
			this.raycaster = new THREE.Raycaster();
			this.mouse = new THREE.Vector2(0,0);
			
			this.renderer.domElement.addEventListener('mousemove',(e)=>{
				if(!this.introFinished){
					return;
				}
				let x = e.offsetX;
				let y = e.offsetY;
				const {width,height} = this.getDimensions();

				//normalize the mouse X and Y to [-1,1]
				this.mouse.x = (x / width) * 2 - 1;
				this.mouse.y = - (y / height) * 2 + 1; //invert because world space [Y=0 ===> Y=N] is up and screen is down.
				this.doRaycast(x,y);
				this.animate();
			});
			this.renderer.domElement.addEventListener('click',(e)=>{
				
				if(this.mouseOverTarget){
					this.bounceLogo(this.mouseOverTarget.iconMesh,true,350).then(()=>{
						window.location.href = this.mouseOverTarget.params.link;
					})

					
				}
			})
			
		}

		//build the buffer geometry for the logo
		const multiplier = isStaticJSON ? 1 : 3;
		const divisor = isStaticJSON ? 3 : 1;
		const gl_directions = new Float32Array(logoAssets.logoDirections.length*multiplier);
		const gl_centroids = new Float32Array(logoAssets.logoCentroids.length*multiplier);
		const gl_positions = new Float32Array(logoAssets.logoPositions.length*multiplier);
		const gl_colors = new Float32Array(logoAssets.logoColors.length*multiplier);
		const gl_initColor = new Float32Array(logoAssets.logoColors.length*multiplier); //say you wanted to start at some grey and animate to final color
		const gl_normals = new Float32Array(logoAssets.logoPositions.length*multiplier);
		const gl_opacity = new Float32Array(logoAssets.logoPositions.length/divisor); //opacity per triangle
		let gl_faces = [];

		if(!isStaticJSON){
			logoAssets.logoDirections.map(function(v,i){
				gl_directions[i*3+0] = v.x;
				gl_directions[i*3+1] = v.y;
				gl_directions[i*3+2] = v.z;

			});

			logoAssets.logoCentroids.map(function(c,i){
				gl_centroids[i*3+0] = c.x;
				gl_centroids[i*3+1] = c.y;
				gl_centroids[i*3+2] = c.z;
			})

			logoAssets.logoColors.map(function(c,i){
				//this is where you could play with the color&opacity init value per triangle a bit if you choose
				gl_colors[i*3+0] = c.x;
				gl_colors[i*3+1] = c.y;
				gl_colors[i*3+2] = c.z;
				
				//set initColor to some color (r = x, g = y, b = z) range 0-1 instead of 0-255 to initialize at some other color and animate to the final color (gl_colors)
				gl_initColor[i*3+0] = c.x;
				gl_initColor[i*3+1] = c.y;
				gl_initColor[i*3+2] = c.z;
				//like this:
				/*
				gl_initColor[i*3+0] = Math.random()*0.5+0.5;
				gl_initColor[i*3+1] = 0.0;
				gl_initColor[i*3+2] = 0.618;
				*/

				gl_opacity[i] = 1.0; //you can control the opacity of each triangle
			})


			logoAssets.logoPositions.map((p,i)=>{
				gl_positions[i*3+0] = p.x;
				gl_positions[i*3+1] = p.y;
				gl_positions[i*3+2] = p.z;
				gl_normals[i*3+0] = 0;
				gl_normals[i*3+1] = 0;
				gl_normals[i*3+2] = 0;
			})
			logoAssets.logoFaces.map((f,i)=>{
				gl_faces.push(f.x,f.y,f.z);
			})
		}
		else{
			gl_directions.set(logoAssets.logoDirections);
			gl_centroids.set(logoAssets.logoCentroids);
			gl_colors.set(logoAssets.logoColors);
			gl_initColor.set(logoAssets.logoColors);
			gl_positions.set(logoAssets.logoPositions);
			gl_normals.set(logoAssets.logoNormals);
			gl_faces = logoAssets.logoFaces.slice(0);
			gl_opacity.set(logoAssets.logoOpacity);
		}
		
		
		
		const bufferGeometry = new THREE.BufferGeometry();//.fromGeometry(geometry)
		bufferGeometry.setIndex(gl_faces);
		bufferGeometry.setAttribute( 'direction', new THREE.BufferAttribute( gl_directions, 3 ) );
		bufferGeometry.setAttribute( 'pCentroid', new THREE.BufferAttribute( gl_centroids, 3 ) );
		bufferGeometry.setAttribute( 'position', new THREE.BufferAttribute( gl_positions, 3 ) );
		bufferGeometry.setAttribute('normal',new THREE.BufferAttribute(gl_normals,3) );
		bufferGeometry.setAttribute( 'customColor', new THREE.BufferAttribute( gl_colors, 3 ) );
		bufferGeometry.setAttribute('initColor',new THREE.BufferAttribute(gl_initColor,3));
		bufferGeometry.setAttribute('opacity', new THREE.BufferAttribute(gl_opacity,1) );
		// our shader 
		
		const material = new THREE.ShaderMaterial({
			vertexShader: LogoVertexShader,
			fragmentShader: LogoFragmentShader,
			wireframe: params.wireframe,
			transparent: true,
			opacity:1.0,
			vertexColors:true,
			side:THREE.DoubleSide,
			uniforms: {
			  opacity: { type: 'f', value: 1 },
			  scale: { type: 'f', value: 0 },
			  animate: { type: 'f', value: 0 },
			  isHighlighted: {type:'f', value:0},
			  shouldGrey: {type: 'f', value:0}
			}
		})
		
		bufferGeometry.computeBoundingSphere();
		const mesh = new THREE.Mesh(bufferGeometry, material)
		this.setMeshPosition(mesh,params);
		this.scene.add(mesh);
		//this.mesh = mesh;
		setTimeout(()=>{
			this.addLogoTransition(params.easing,mesh);
		},100)
		
		return mesh;
		
	}
	doRaycast(screenX,screenY){
		this.raycaster.setFromCamera(this.mouse,this.camera);
		const intersections = this.raycaster.intersectObjects(Object.keys(this.meshes).map(d=>{return this.meshes[d].box3Mesh;}))
		//console.log('intersections',intersections);
		if(intersections.length > 0){
			let uuid = intersections[0].object.uuid;
			Object.keys(this.meshes).map(meshKey=>{
				let mesh = this.meshes[meshKey].box3Mesh;
				let iconMesh = this.meshes[meshKey].mesh;
				let params = this.meshes[meshKey].positionParams;
				if(mesh.uuid != uuid){
					iconMesh.material.uniforms.isHighlighted.value = 0.0;
					iconMesh.material.uniforms.shouldGrey.value = 1.0;
					iconMesh.material.wireframe = true;
					mesh.material.color.setHex(0x111111);
					delete iconMesh.userData.didAnimate;
				}
				else{
					iconMesh.material.uniforms.isHighlighted.value = 1.0;
					iconMesh.material.uniforms.shouldGrey.value = 0.0;
					iconMesh.material.wireframe = false;
					mesh.material.color.setHex(0x333333);
					$('body').css('cursor','pointer');
					this.mouseOverTarget = {params,iconMesh};
					this.bounceLogo(iconMesh)
				}

			})
		}
		else{
			Object.keys(this.meshes).map(meshKey=>{
				let mesh = this.meshes[meshKey].mesh;
				let bkgdMesh = this.meshes[meshKey].box3Mesh;
				let iconMesh = this.meshes[meshKey].mesh;
				mesh.material.uniforms.isHighlighted.value = 0.0;
				mesh.material.uniforms.shouldGrey.value = 0.0;
				mesh.material.wireframe = true;
				bkgdMesh.material.color.setHex(0x111111);
				$('body').css('cursor','default');
				delete this.mouseOverTarget;
				delete iconMesh.userData.didAnimate;
				/*iconMesh.material.uniforms.scale.value = 1.0;
				iconMesh.material.uniforms.animate.value = 1.0;*/

			})
		}
	}
	addLogoTransition(tweenMethod,mesh){
		//const mesh = this.mesh;
		mesh.material.uniforms.scale.value = 0;
		mesh.material.uniforms.animate.value = 0;
		const method = typeof tweenMethod == "undefined" ? TWEEN.Easing.Exponential.Out : tweenMethod;
		
		let isTweening = true;
		const _this = this;
		function animate(time) {
			if(isTweening){
				requestAnimationFrame(animate)
				_this.renderer.render(_this.scene,_this.camera);
			}
			TWEEN.update(time)
		}
		requestAnimationFrame(animate)
		let val = 0;
		new TWEEN.Tween(val) 
		.to(1.0, 2000) 
		.easing(method) 
		.onUpdate((v) => {
			mesh.material.uniforms.animate.value = v;
			mesh.material.uniforms.scale.value = v;
		})
		.onComplete(()=>{
			isTweening = false;
			if(typeof mesh.userData.box != "undefined"){
				mesh.userData.box.position.z = mesh.userData.box.userData.futurePos;
				mesh.userData.box.material.opacity = 0.5;
				_this.renderer.render(_this.scene,_this.camera);
			}
			this.completeIntroCount += 1;
			if(this.completeIntroCount == this.completeIntroTotal){
				this.introFinished = true;
			}
		
			//console.log('comp',mesh.userData);
		})
		.start() // Start the tween immediately.	
	}
	bounceLogo(mesh,forceAnimate,msOverride){
		return new Promise((resolve,reject)=>{
			if(mesh.userData.didAnimate && !forceAnimate){
				resolve();
				return false;
			}
			mesh.material.uniforms.scale.value = 0.98;
			mesh.material.uniforms.animate.value = 0.98;
			mesh.userData.didAnimate = true;
			const method = TWEEN.Easing.Bounce.Out;
			let isTweening = true;
			const _this = this;
			function animate(time) {
				if(isTweening){
					requestAnimationFrame(animate)
					_this.renderer.render(_this.scene,_this.camera);
					//console.log('animate');
				}
				TWEEN.update(time)
			}
			requestAnimationFrame(animate);
			let duration = 500;
			if(msOverride){
				duration = msOverride;
			}
			let val = {v:0.98};
			new TWEEN.Tween(val) 
			.to({v:1.0}, duration) 
			.easing(method) 
			.onUpdate((v) => {
				//console.log('v',val);
				mesh.material.uniforms.animate.value = val.v;
				mesh.material.uniforms.scale.value = val.v;
			})
			.onComplete(()=>{
				isTweening = false;
				mesh.material.uniforms.animate.value = 1.0;
				mesh.material.uniforms.scale.value = 1.0;
				_this.renderer.render(_this.scene,_this.camera);
				resolve();
				/*if(typeof mesh.userData.box != "undefined"){
					mesh.userData.box.position.z = mesh.userData.box.userData.futurePos;
					mesh.userData.box.material.opacity = 0.5;
					
					
				}*/
				//console.log('comp',mesh.userData);
			})
			.start() // Start the tween immediately.	
		})
		
	}
	animate(){

		window.requestAnimationFrame(()=>{
			/*if(this.shouldAnimate){
				this.animate();
			}*/
			this.renderer.render(this.scene,this.camera);
		});
		
	}
	buildCircle(){
		const w = $(window).width();
		const h = $(window).height();
		const radius = Math.min(w,h) / 2 * 0.9;
		const strokeWidth = Math.min(w,h) / 2 * 0.05;
		$('.circle svg circle').attr('r',radius+'px');
		$('.circle svg circle').attr('stroke-width',strokeWidth+'px')
		$('.circle svg circle').attr('cx',(w/2)+'px')
		$('.circle svg circle').attr('cy',(h/2)+'px');
		//$('.circle svg circle').attr('stroke','rgba(255,255,255,0.25')
		$('.circle svg circle').css('opacity',1);
	}
}