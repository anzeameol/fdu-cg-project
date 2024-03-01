
"use strict";

class TextureLoader {

  constructor(entity, config) {
    this.entity = entity;
    this.gl = config.gl;
    this.enableLight = config.enableLight;
    this.activeTextureIndex = config.activeTextureIndex;
    this.isFloor = config.isFloor;
  }

  init() {
    this.initShaders();

    this.initTextures();

    this.initBuffers();

    this.initPerspective();

    return this;
  }

  initShaders() {
    // Vertex shader program
    let VSHADER_SOURCE = `
            attribute vec4 a_Position;
            uniform mat4 u_MvpMatrix;
            attribute vec2 a_TexCoord;
            varying vec2 v_TexCoord;

            uniform mat4 u_ModelMatrix;
            uniform vec3 u_PointLightPosition;
            varying float v_Dist;

            varying vec4 v_PositionFromLight;
            uniform mat4 u_MvpMatrixFromLight;
            void main() {
              gl_Position = u_MvpMatrix * a_Position;
              v_TexCoord = a_TexCoord;

              v_PositionFromLight = u_MvpMatrixFromLight * a_Position;

              vec4 vertexPosition = u_ModelMatrix * a_Position;
              v_Dist = distance(vec3(vertexPosition), u_PointLightPosition);
            }`;

    // Fragment shader program
    let FSHADER_SOURCE = `
            #ifdef GL_ES
            precision mediump float;
            #endif
            uniform sampler2D u_Sampler;
            varying vec2 v_TexCoord;

            uniform sampler2D u_ShadowMap;
            varying vec4 v_PositionFromLight;
            uniform bool u_ShadowOn;

            uniform vec3 u_FogColor;
            uniform vec2 u_FogDist;
            varying float v_Dist;
            uniform bool u_FogOn;

            float unpackDepth(const in vec4 rgbaDepth) {
              const vec4 bitShift = vec4(1.0, 1.0/256.0, 1.0/(256.0*256.0), 1.0/(256.0*256.0*256.0));
              float depth = dot(rgbaDepth, bitShift);
              return depth;
            }

            void main() {

              vec4 tempColor = texture2D(u_Sampler, v_TexCoord);

              if (u_ShadowOn)
              {
                vec3 shadowCoord = (v_PositionFromLight.xyz/v_PositionFromLight.w)/2.0 + 0.5;
                vec4 rgbaDepth = texture2D(u_ShadowMap, shadowCoord.xy);
                float depth = unpackDepth(rgbaDepth);
                // float depth = rgbaDepth.r;
                float visibility = (shadowCoord.z > depth + 0.0024) ? 0.3 : 1.0; //0.0003
                tempColor = vec4(tempColor.rgb * visibility, tempColor.a);

                // the following code is for debugging, judge that if the shadow map is correct
                // gl_FragColor = vec4(1.0,1.0,1.0,depth);
              }
              
              gl_FragColor = tempColor;

              if (u_FogOn) {
                float fogFactor = clamp((u_FogDist.y - v_Dist) / (u_FogDist.y - u_FogDist.x), 0.0, 1.0);
                vec3 color = mix(u_FogColor, vec3(tempColor), fogFactor);
                gl_FragColor = vec4(color, tempColor.a);
              }
            }`;

    // Initialize shaders
    this.program = createProgram(this.gl, VSHADER_SOURCE, FSHADER_SOURCE);
    if (!this.program) {
      console.log('Failed to create program');
      return;
    }

    this.u_MvpMatrixFromLight = this.gl.getUniformLocation(this.program, 'u_MvpMatrixFromLight');
    this.u_ShadowOn = this.gl.getUniformLocation(this.program, 'u_ShadowOn');
    this.u_ShadowMap = this.gl.getUniformLocation(this.program, 'u_ShadowMap');

    this.u_PointLightPosition = this.gl.getUniformLocation(this.program, 'u_PointLightPosition');
    this.u_ModelMatrix = this.gl.getUniformLocation(this.program, 'u_ModelMatrix');
    this.u_FogColor = this.gl.getUniformLocation(this.program, 'u_FogColor');
    this.u_FogDist = this.gl.getUniformLocation(this.program, 'u_FogDist');
    this.u_FogOn = this.gl.getUniformLocation(this.program, 'u_FogOn');

    var shadowProgram = createProgram(this.gl, SHADOW_VSHADER_SOURCE, SHADOW_FSHADER_SOURCE);
    shadowProgram.a_Position = this.gl.getAttribLocation(shadowProgram, 'a_Position');
    shadowProgram.u_MvpMatrix = this.gl.getUniformLocation(shadowProgram, 'u_MvpMatrix');
    if (shadowProgram.a_Position < 0 || !shadowProgram.u_MvpMatrix) {
      console.log('Failed to get the storage location of attribute or uniform variable from shadowProgram');
      return;
    }
    this.shadowProgram = shadowProgram;

    this.gl.useProgram(null);
    this.gl.program = null;
  }

  initPerspective() {
    this.gl.enable(this.gl.DEPTH_TEST);
    // Get the storage location of u_MvpMatrix
    this.u_MvpMatrix = this.gl.getUniformLocation(this.program, 'u_MvpMatrix');
    if (!this.u_MvpMatrix) {
      console.log('Failed to get the storage location of u_MvpMatrix');
    }


    this.g_normalMatrix = new Matrix4();
    // Assign the buffer object to a_Position and enable the assignment
    this.a_Position = this.gl.getAttribLocation(this.program, 'a_Position');
    // Assign the buffer object to a_TexCoord variable and enable the assignment of the buffer object
    this.a_TexCoord = this.gl.getAttribLocation(this.program, 'a_TexCoord');

    this.u_MvpMatrix = this.gl.getUniformLocation(this.program, 'u_MvpMatrix');
    this.g_modelMatrix = new Matrix4();
    this.g_modelMatrix.translate(this.entity.translate[0], this.entity.translate[1], this.entity.translate[2]);
    this.g_modelMatrix.scale(this.entity.scale[0], this.entity.scale[1], this.entity.scale[2]);

  }

  initBuffers() {
    // Write the vertex coordinates to the buffer object
    this.vertexBuffer = this.gl.createBuffer();

    // Write the vertex texture coordinates to the buffer object
    this.vertexTexCoordBuffer = this.gl.createBuffer();

    // Write the indices to the buffer object
    this.vertexIndexBuffer = this.gl.createBuffer();
  }

  initTextures() {
    // Create a texture object
    this.texture = this.gl.createTexture();

    // Get the storage location of u_Sampler
    this.u_Sampler = this.gl.getUniformLocation(this.program, 'u_Sampler');
    if (!this.u_Sampler) {
      console.log('Failed to get the storage location of u_Sampler');
      return;
    }

    // Load texture image
    this.textureImage = new Image();
    // this.textureImage.src = './image/sky.jpg';
    this.textureImage.src = this.entity.texImagePath;
    this.textureImage.onload = () => {
      this.handleTextureLoad();
    };
  }

  handleTextureLoad() {
    this.gl.useProgram(this.program);
    this.gl.activeTexture(this.gl[`TEXTURE${this.activeTextureIndex}`]);
    // this.gl.activeTexture(this.gl[`TEXTURE2`]);
    // Flip the image's y axis
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 1);


    // this.gl.activeTexture(this.gl[`TEXTURE${this.activeTextureIndex}`]);

    // Bind the texture object to the target
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);

    // Set the texture parameters
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    // Set the texture image
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, this.gl.RGB, this.gl.UNSIGNED_BYTE, this.textureImage);

    // Set the texture unit 0 to the sampler
    this.gl.uniform1i(this.u_Sampler, this.activeTextureIndex);
  }

  // render normal scene
  render() {
    this.gl.useProgram(this.program);
    this.gl.program = this.program;

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.entity.vertex), this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_Position);


    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexTexCoordBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.entity.texCoord), this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_TexCoord, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_TexCoord);

    this.gl.activeTexture(this.gl[`TEXTURE${this.activeTextureIndex}`]);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.vertexIndexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.entity.index), this.gl.STATIC_DRAW);


    // Set the eye point and the viewing volume
    this.mvpMatrix = Camera.getMatrix();
    this.mvpMatrix.concat(this.g_modelMatrix);

    // Pass the model view projection matrix to u_MvpMatrix
    this.gl.uniformMatrix4fv(this.u_MvpMatrix, false, this.mvpMatrix.elements);

    this.g_normalMatrix.setInverseOf(this.g_modelMatrix);
    this.g_normalMatrix.transpose();
    this.gl.uniformMatrix4fv(this.u_NormalMatrix, false, this.g_normalMatrix.elements);
    this.gl.uniformMatrix4fv(this.u_ModelMatrix, false, this.g_modelMatrix.elements);

    this.gl.uniform1i(this.u_ShadowOn, !Camera.state.lightOn);  // if the light is on, then there will be no shadow
    this.gl.uniform1i(this.u_ShadowMap, 2);  // the shadow map texture's index is 2
    let g_mvpMatrix = Camera.getViewProjMatrixFromLight();
    g_mvpMatrix.concat(this.g_modelMatrix);
    this.gl.uniformMatrix4fv(this.u_MvpMatrixFromLight, false, g_mvpMatrix.elements);

    // set fog
    this.gl.uniform3fv(this.u_FogColor, new Vector3(FogPara.fogColor).elements);
    if (this.isFloor) {
      this.gl.uniform2fv(this.u_FogDist, new Float32Array(FogPara.fogDistForFloor));
    }
    else {
      this.gl.uniform2fv(this.u_FogDist, new Float32Array(FogPara.fogDist));
    }
    this.gl.uniform1i(this.u_FogOn, Camera.state.fogOn);
    this.gl.uniformMatrix4fv(this.u_ModelMatrix, false, this.g_modelMatrix.elements);
    this.gl.uniform3fv(this.u_PointLightPosition, Camera.eye.elements);

    // Draw the texture
    this.gl.drawElements(this.gl.TRIANGLE_STRIP, this.entity.index.length, this.gl.UNSIGNED_SHORT, 0);
  }

  // render shadow map
  renderShadow() {
    this.gl.useProgram(this.shadowProgram);
    this.gl.program = this.shadowProgram;

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.entity.vertex), this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.shadowProgram.a_Position, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.shadowProgram.a_Position);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.vertexIndexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.entity.index), this.gl.STATIC_DRAW);

    // Set the eye point and the viewing volume
    this.mvpMatrix = Camera.getViewProjMatrixFromLight();
    this.mvpMatrix.concat(this.g_modelMatrix);

    // Pass the model view projection matrix to u_MvpMatrix
    this.gl.uniformMatrix4fv(this.shadowProgram.u_MvpMatrix, false, this.mvpMatrix.elements);

    // Draw the texture
    this.gl.drawElements(this.gl.TRIANGLE_STRIP, this.entity.index.length, this.gl.UNSIGNED_SHORT, 0);
  }
}