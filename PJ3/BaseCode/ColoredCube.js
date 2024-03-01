
"use strict";

class ColoredCubeLoader {
  constructor(entity, config) {
    this.entity = entity;
    this.gl = config.gl;
  }

  init() {
    this.initShaders();

    this.initBuffers();

    this.initPerspective();

    return this;
  }

  initShaders() {
    // Vertex shader program
    let VSHADER_SOURCE = `
      attribute vec4 a_Position;
      attribute vec4 a_Color;
      uniform mat4 u_MvpMatrix;
      varying vec4 v_Color;

      uniform mat4 u_ModelMatrix;
      uniform vec3 u_PointLightPosition;
      varying float v_Dist;

      varying vec4 v_PositionFromLight;
      uniform mat4 u_MvpMatrixFromLight;
      void main() {
        gl_Position = u_MvpMatrix * a_Position;
        v_Color = a_Color;

        v_PositionFromLight = u_MvpMatrixFromLight * a_Position;  // position from the perspective of light

        vec4 vertexPosition = u_ModelMatrix * a_Position;
        v_Dist = distance(vec3(vertexPosition), u_PointLightPosition);
      }`

    // Fragment shader program
    let FSHADER_SOURCE = `
      #ifdef GL_ES
      precision mediump float;
      #endif
      varying vec4 v_Color;

      uniform sampler2D u_ShadowMap;
      varying vec4 v_PositionFromLight;
      uniform bool u_ShadowOn;

      uniform vec3 u_FogColor;
      uniform vec2 u_FogDist;
      varying float v_Dist;
      uniform bool u_FogOn;

      // get the depth value from the shadow map
      float unpackDepth(const in vec4 rgbaDepth) {
        const vec4 bitShift = vec4(1.0, 1.0/256.0, 1.0/(256.0*256.0), 1.0/(256.0*256.0*256.0));
        float depth = dot(rgbaDepth, bitShift);
        return depth;
      }
      void main() {
        vec4 tempColor = v_Color;

        // u_ShadowOn always false, because colored cube is weird to have shadow on it
        if (u_ShadowOn)
        {
          // get the coordinate of the pixel in the shadow map
          vec3 shadowCoord = (v_PositionFromLight.xyz/v_PositionFromLight.w)/2.0 + 0.5;
          vec4 rgbaDepth = texture2D(u_ShadowMap, shadowCoord.xy);
          float depth = unpackDepth(rgbaDepth);
          // epsilon = 0.0024, to avoid shadow acne
          float visibility = (shadowCoord.z > depth + 0.0024) ? 0.3 : 1.0;
          tempColor = vec4(tempColor.rgb * visibility, tempColor.a);
        }

        gl_FragColor = tempColor;

        if (u_FogOn) {
          float fogFactor = clamp((u_FogDist.y - v_Dist) / (u_FogDist.y - u_FogDist.x), 0.0, 1.0);
          vec3 color = mix(u_FogColor, vec3(tempColor), fogFactor);
          gl_FragColor = vec4(color, tempColor.a);
        }     
      }`

    // Initialize shaders for normal rendering
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

    // Initialize shaders for generating a shadow map
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

  // initialize perspective
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
    this.a_Color = this.gl.getAttribLocation(this.program, 'a_Color');

    this.u_MvpMatrix = this.gl.getUniformLocation(this.program, 'u_MvpMatrix');
    this.g_modelMatrix = new Matrix4();
    this.g_modelMatrix.translate(this.entity.translate[0], this.entity.translate[1], this.entity.translate[2]);
    this.g_modelMatrix.scale(this.entity.scale[0], this.entity.scale[1], this.entity.scale[2]);

  }

  initBuffers() {
    // Write the vertex coordinates to the buffer object
    this.vertexBuffer = this.gl.createBuffer();

    // Write the vertex texture coordinates to the buffer object
    this.vertexBuffer = this.gl.createBuffer();

    // Write the indices to the buffer object
    this.vertexIndexBuffer = this.gl.createBuffer();
  }

  render() {
    // use normal program to render
    this.gl.useProgram(this.program);
    this.gl.program = this.program;

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);

    var data = new Float32Array(this.entity.vertex);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);

    var fsize = data.BYTES_PER_ELEMENT;
    this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, fsize * 6, 0);
    this.gl.enableVertexAttribArray(this.a_Position);

    this.gl.vertexAttribPointer(this.a_Color, 3, this.gl.FLOAT, false, fsize * 6, fsize * 3);
    this.gl.enableVertexAttribArray(this.a_Color);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.vertexIndexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.entity.index), this.gl.STATIC_DRAW);


    // Set the eye point and the viewing volume, eye point from camera
    this.mvpMatrix = Camera.getMatrix();
    this.mvpMatrix.concat(this.g_modelMatrix);

    // Pass the model view projection matrix to u_MvpMatrix
    this.gl.uniformMatrix4fv(this.u_MvpMatrix, false, this.mvpMatrix.elements);

    this.gl.uniform1i(this.u_ShadowOn, 0);  // no need to render shadow on colored cude, because it's weird
    this.gl.uniform1i(this.u_ShadowMap, 2);  // the shadow map texture's index is 2
    let g_mvpMatrix = Camera.getViewProjMatrixFromLight();
    g_mvpMatrix.concat(this.g_modelMatrix);
    this.gl.uniformMatrix4fv(this.u_MvpMatrixFromLight, false, g_mvpMatrix.elements);

    // set fog
    this.gl.uniform3fv(this.u_FogColor, new Vector3(FogPara.fogColor).elements);
    this.gl.uniform2fv(this.u_FogDist, new Float32Array(FogPara.fogDist));
    this.gl.uniform1i(this.u_FogOn, Camera.state.fogOn);
    this.gl.uniformMatrix4fv(this.u_ModelMatrix, false, this.g_modelMatrix.elements);
    this.gl.uniform3fv(this.u_PointLightPosition, Camera.eye.elements);

    // Draw the texture
    this.gl.drawElements(this.gl.TRIANGLE_STRIP, this.entity.index.length, this.gl.UNSIGNED_SHORT, 0);
  }

  // render shadow map
  renderShadow() {
    // use shadow program to render
    this.gl.useProgram(this.shadowProgram);
    this.gl.program = this.shadowProgram;

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(this.entity.vertex), this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.shadowProgram.a_Position, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.shadowProgram.a_Position);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.vertexIndexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.entity.index), this.gl.STATIC_DRAW);


    // Set the eye point and the viewing volume, eye point from light
    this.mvpMatrix = Camera.getViewProjMatrixFromLight();
    this.mvpMatrix.concat(this.g_modelMatrix);

    // Pass the model view projection matrix to u_MvpMatrix
    this.gl.uniformMatrix4fv(this.shadowProgram.u_MvpMatrix, false, this.mvpMatrix.elements);

    // Draw the texture
    this.gl.drawElements(this.gl.TRIANGLE_STRIP, this.entity.index.length, this.gl.UNSIGNED_SHORT, 0);
  }
}
