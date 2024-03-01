
"use strict";

window.onload = () => {
  let canvas = document.getElementById('webgl');
  let positon_text = document.getElementById('position');
  let lookat_text = document.getElementById('lookat');
  canvas.setAttribute("width", canvas_width);
  canvas.setAttribute("height", canvas_height);
  window.ratio = canvas.width / canvas.height;
  let gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }

  // Load a new scene
  new SceneLoader(gl, positon_text, lookat_text).init();
};

class SceneLoader {
  constructor(gl, positon_text, lookat_text) {
    this.gl = gl;
    this.position_text = positon_text;
    this.lookat_text = lookat_text;
    this.loaders = [];
    this.keyboardController = new KeyboardController();
  }

  init() {

    this.initKeyController();

    this.initLoaders();

    let render = (timestamp) => {
      this.initWebGL();

      this.initCamera(timestamp);

      // switch to frame buffer for shadow map
      this.shadowLoader.switchToShadow();

      // render shadow map
      for (let loader of this.loaders) {
        loader.renderShadow(timestamp);
      }

      // switch to normal rendering mode
      this.shadowLoader.switchToNormal();
      for (let loader of this.loaders) {
        loader.render(timestamp);
      }

      requestAnimationFrame(render, this.gl);
    };

    render();
  }


  initWebGL() {
    // Set clear color and enable hidden surface removal
    this.gl.clearColor(FogPara.fogColor[0], FogPara.fogColor[1], FogPara.fogColor[2], 1.0);

    // Clear color and depth buffer
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  initKeyController() {
    Camera.init();
    let cameraMap = new Map();
    cameraMap.set('a', 'posLeft');
    cameraMap.set('d', 'posRight');
    cameraMap.set('s', 'posDown');
    cameraMap.set('w', 'posUp');
    cameraMap.set('j', 'rotLeft');
    cameraMap.set('l', 'rotRight');
    cameraMap.set('i', 'rotUp');
    cameraMap.set('k', 'rotDown');
    cameraMap.set('f', 'lightOn');   // light on/off
    cameraMap.set('z', 'fogOn');   // fog effect on/off
    cameraMap.set('x', 'phongOn');  // phong shading on/off

    cameraMap.forEach((val, key) => {
      this.keyboardController.bind(key, {
        on: (() => {
          // fog effect or phong shading, press once to turn on, press again to turn off
          if (val == 'fogOn' || val == 'phongOn') {
            Camera.state[val] = !Camera.state[val];
          }
          else {
            Camera.state[val] = 1;
          }
        }),
        off: (() => {
          if (val == 'fogOn' || val == 'phongOn') {
            Camera.state[val] = Camera.state[val];
          }
          else {
            Camera.state[val] = 0;
          }
        })
      });
    }
    )
  }

  initCamera(timestamp) {
    let elapsed = timestamp - this.keyboardController.last;
    this.keyboardController.last = timestamp;

    let posY = (Camera.state.posRight - Camera.state.posLeft) * MOVE_VELOCITY * elapsed / 1000;
    let rotY = (Camera.state.rotRight - Camera.state.rotLeft) * ROT_VELOCITY * elapsed / 1000 / 180 * Math.PI;
    let posX = (Camera.state.posUp - Camera.state.posDown) * MOVE_VELOCITY * elapsed / 1000;
    let rotX = (Camera.state.rotUp - Camera.state.rotDown) * ROT_VELOCITY * elapsed / 1000 / 180 * Math.PI;

    // move or rotate camera
    if (posY) Camera.move(0, posY, this.position_text, this.lookat_text);
    if (posX) Camera.move(posX, 0, this.position_text, this.lookat_text);
    if (rotY) Camera.rotate(0, rotY, this.position_text, this.lookat_text);
    if (rotX) Camera.rotate(rotX, 0, this.position_text, this.lookat_text);
    // Camera.move(posX, posY, this.position_text, this.lookat_text);
    // Camera.rotate(rotX, rotY, this.position_text, this.lookat_text);
  }

  initLoaders() {
    // Load floor
    let floorLoader = new TextureLoader(floorRes, {
      'gl': this.gl,
      'activeTextureIndex': 0,
      'enableLight': true,
      'isFloor': true  // whether it is floor
    }).init();
    this.loaders.push(floorLoader);

    // Load box
    let boxLoader = new TextureLoader(boxRes, {
      'gl': this.gl,
      'activeTextureIndex': 1,
      'enableLight': true,
      'isFloor': false  // whether it is floor
    }).init();
    this.loaders.push(boxLoader);

    // load colored cube
    let cubeLoader = new ColoredCubeLoader(cubeRes, {
      'gl': this.gl
    }).init();
    this.loaders.push(cubeLoader);

    // Load objects
    for (let o of ObjectList) {
      let loader = new ObjectLoader(o, { 'gl': this.gl }).init();
      // Add animation to bird
      if (o.objFilePath.indexOf('bird') > 0) {
        loader.addAnimation();
      }
      this.loaders.push(loader);
    }

    // Load shadow
    this.shadowLoader = new ShadowLoader({
      'gl': this.gl,
      'activeTextureIndex': 2
    }).init();
  }
}