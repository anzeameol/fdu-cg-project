

"use strict";
class ObjectLoader {
  constructor(entity, config) {
    this.gl = config.gl;
    this.entity = entity;
  }

  init() {

    this.initShaders();

    this.initPerspective();

    this.g_objDoc = null;      // The information of OBJ file
    this.g_drawingInfo = null; // The information for drawing 3D model


    // Prepare empty buffer objects for vertex coordinates, colors, and normals
    this.initBuffers();
    if (!this.buffers) {
      console.log('Failed to set the vertex information');
      return;
    }

    // Start reading the OBJ file
    this.readOBJFile(`${this.entity.objFilePath}`, this.buffers, 1, true);

    return this;
  }

  initShaders() {
    //Vertex shader program
    let VSHADER_SOURCE = `
        attribute vec4 a_Position;
        attribute vec4 a_Color;
        attribute vec4 a_Normal;

        varying vec3 v_Normal;  // for phong shading
        varying vec4 v_Position;

        uniform mat4 u_MvpMatrix;
        uniform mat4 u_ModelMatrix;
        uniform mat4 u_NormalMatrix;
        varying vec4 v_Color;

        varying vec4 v_PositionFromLight;
        uniform mat4 u_MvpMatrixFromLight;
        void main() {
          gl_Position = u_MvpMatrix * a_Position;

          vec4 normal1 = u_NormalMatrix * a_Normal;

          vec3 normal = normalize(normal1.xyz);
          v_Normal = normal;
          
          v_Position = u_ModelMatrix * a_Position;

          v_Color = a_Color;

          // for shadow rendering
          v_PositionFromLight = u_MvpMatrixFromLight * a_Position;
        }`;

    // Fragment shader program
    let FSHADER_SOURCE = `
        #ifdef GL_ES
        precision mediump float;
        #endif
        varying vec4 v_Color;

        varying vec4 v_Position;
        varying vec3 v_Normal;

        uniform vec3 u_FogColor;
        uniform vec2 u_FogDist;
        uniform bool u_FogOn;

        uniform sampler2D u_ShadowMap;
        varying vec4 v_PositionFromLight;
        uniform bool u_ShadowOn;

        uniform vec3 u_Color;
        uniform vec3 u_LightDirection;
        uniform vec3 u_AmbientLight;
        uniform vec3 u_PointLightPosition;
        uniform vec3 u_CameraDirection;
        uniform vec3 u_PointLightColor;

        uniform bool u_PhongOn;
        uniform vec3 u_SpecularLight;

        uniform bool u_LightOn;

        // get the depth value from the shadow map
        float unpackDepth(const in vec4 rgbaDepth) {
          const vec4 bitShift = vec4(1.0, 1.0/256.0, 1.0/(256.0*256.0), 1.0/(256.0*256.0*256.0));
          float depth = dot(rgbaDepth, bitShift);
          return depth;
        }

        void main() {
          // ambient + diffuse
          float nDotL = max(dot(u_LightDirection, v_Normal), 0.0);
          vec3 u_DiffuseLight = vec3(1.0, 1.0, 1.0);
          vec3 diffuse = u_DiffuseLight * u_Color * nDotL;
          vec3 ambient = u_AmbientLight * u_Color;

          vec3 PointLightDirection = normalize(u_PointLightPosition - vec3(v_Position));

          // add point light
          if(u_LightOn)
          {
            nDotL = max(dot(PointLightDirection, v_Normal), 0.0);
            diffuse += u_PointLightColor * u_Color * nDotL;
          }

          // add specular light
          vec3 specular = vec3(0.0,0.0,0.0);
          if (u_PhongOn) {
            float k_specular = 0.0;
            vec3 halfDirection = normalize(u_CameraDirection + normalize(u_LightDirection));
            k_specular = pow(max(dot(halfDirection, v_Normal), 0.0), 50.0);
            specular = u_SpecularLight * u_Color * k_specular;

            if(u_LightOn)
            {
              halfDirection = normalize(u_CameraDirection + normalize(PointLightDirection));
              k_specular = pow(max(dot(halfDirection, v_Normal), 0.0), 50.0);
              specular += u_SpecularLight * u_Color * k_specular;
            }
          }

          vec4 tempColor = vec4(diffuse + ambient + specular, v_Color.a);

          // render shadow
          if (u_ShadowOn)
          {
            vec3 shadowCoord = (v_PositionFromLight.xyz/v_PositionFromLight.w)/2.0 + 0.5;
            vec4 rgbaDepth = texture2D(u_ShadowMap, shadowCoord.xy);
            float depth = unpackDepth(rgbaDepth);
            // float depth = rgbaDepth.r;
            float visibility = (shadowCoord.z > depth + 0.0024) ? 0.3 : 1.0;
            tempColor = vec4(tempColor.rgb * visibility, tempColor.a);
          }

          gl_FragColor = tempColor;

          // add fog effect
          float v_Dist = distance(vec3(v_Position), u_PointLightPosition);
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

    this.gl.enable(this.gl.DEPTH_TEST);

    // Get the storage locations of attribute and uniform variables
    this.a_Position = this.gl.getAttribLocation(this.program, 'a_Position');
    this.a_Color = this.gl.getAttribLocation(this.program, 'a_Color');
    this.a_Normal = this.gl.getAttribLocation(this.program, 'a_Normal');
    this.u_MvpMatrix = this.gl.getUniformLocation(this.program, 'u_MvpMatrix');
    this.u_NormalMatrix = this.gl.getUniformLocation(this.program, 'u_NormalMatrix');
    this.u_ModelMatrix = this.gl.getUniformLocation(this.program, 'u_ModelMatrix');


    this.u_LightDirection = this.gl.getUniformLocation(this.program, 'u_LightDirection');
    this.u_AmbientLight = this.gl.getUniformLocation(this.program, 'u_AmbientLight');
    this.u_Color = this.gl.getUniformLocation(this.program, 'u_Color');

    this.u_LightOn = this.gl.getUniformLocation(this.program, 'u_LightOn');
    this.u_PointLightColor = this.gl.getUniformLocation(this.program, 'u_PointLightColor');
    this.u_PointLightPosition = this.gl.getUniformLocation(this.program, 'u_PointLightPosition');
    this.u_CameraDirection = this.gl.getUniformLocation(this.program, 'u_CameraDirection');

    this.u_FogColor = this.gl.getUniformLocation(this.program, 'u_FogColor');
    this.u_FogDist = this.gl.getUniformLocation(this.program, 'u_FogDist');
    this.u_FogOn = this.gl.getUniformLocation(this.program, 'u_FogOn');

    this.u_PhongOn = this.gl.getUniformLocation(this.program, 'u_PhongOn');
    this.u_SpecularLight = this.gl.getUniformLocation(this.program, 'u_SpecularLight');

    this.u_MvpMatrixFromLight = this.gl.getUniformLocation(this.program, 'u_MvpMatrixFromLight');
    this.u_ShadowOn = this.gl.getUniformLocation(this.program, 'u_ShadowOn');
    this.u_ShadowMap = this.gl.getUniformLocation(this.program, 'u_ShadowMap');

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

  // initialize the perspective matrix
  initPerspective() {
    this.g_modelMatrix = new Matrix4();
    this.g_normalMatrix = new Matrix4();
    for (let t of this.entity.transform) {
      this.g_modelMatrix[t.type].apply(this.g_modelMatrix, t.content);
    }
  }

  initBuffers() {
    // Create a buffer object, assign it to attribute variables, and enable the assignment
    this.buffers = {
      vertexBuffer: this.gl.createBuffer(),
      normalBuffer: this.gl.createBuffer(),
      colorBuffer: this.gl.createBuffer(),
      indexBuffer: this.gl.createBuffer()
    };
  }

  readOBJFile(fileName, model, scale, reverse) {
    let request = new XMLHttpRequest();

    request.onreadystatechange = () => {
      if (request.readyState === 4 && (request.status == 200 || request.status == 0)) {
        this._onReadOBJFile(request.responseText, fileName, model, scale, reverse);
      }
    };
    request.open('GET', fileName, true);
    request.send();
  }


  _onReadOBJFile(fileString, fileName, o, scale, reverse) {
    let objDoc = new OBJDoc(fileName);  // Create a OBJDoc object
    let result = objDoc.parse(fileString, scale, reverse); // Parse the file
    if (!result) {
      this.g_objDoc = null;
      this.g_drawingInfo = null;
      console.log("OBJ file parsing error.");
      return;
    }
    this.g_objDoc = objDoc;
  }

  render(timestamp) {
    this.gl.useProgram(this.program);
    this.gl.program = this.program;

    if (this.g_objDoc != null && this.g_objDoc.isMTLComplete()) {
      this.onReadComplete();
    }
    if (!this.g_drawingInfo) {
      return;
    }

    // let lightDirection = new Vector3([0.15, 0.15, 0.17]);
    let lightDirection = new Vector3(sceneDirectionLight);
    lightDirection.normalize();
    this.gl.uniform3fv(this.u_LightDirection, lightDirection.elements);
    // this.gl.uniform3fv(this.u_AmbientLight, new Vector3([1.2, 1.2, 1.2]).elements);
    this.gl.uniform3fv(this.u_AmbientLight, new Vector3(sceneAmbientLight).elements);

    this.gl.uniform3fv(this.u_Color, new Vector3(this.entity.color).elements);

    // set point light
    this.gl.uniform1i(this.u_LightOn, Camera.state.lightOn);
    this.gl.uniform3fv(this.u_PointLightColor, new Vector3(scenePointLightColor).elements);
    this.gl.uniform3fv(this.u_PointLightPosition, Camera.eye.elements);
    this.gl.uniform3fv(this.u_CameraDirection, VectorMinus(Camera.eye, Camera.at).elements);

    // set fog
    this.gl.uniform3fv(this.u_FogColor, new Vector3(FogPara.fogColor).elements);
    this.gl.uniform2fv(this.u_FogDist, new Float32Array(FogPara.fogDist));
    this.gl.uniform1i(this.u_FogOn, Camera.state.fogOn);

    // set phong shading
    this.gl.uniform1i(this.u_PhongOn, Camera.state.phongOn);
    this.gl.uniform3fv(this.u_SpecularLight, new Vector3(specularLight).elements);

    this.g_normalMatrix.setInverseOf(this.g_modelMatrix);
    this.g_normalMatrix.transpose();
    this.gl.uniformMatrix4fv(this.u_NormalMatrix, false, this.g_normalMatrix.elements);
    this.gl.uniformMatrix4fv(this.u_ModelMatrix, false, this.g_modelMatrix.elements);

    let g_mvpMatrix = Camera.getMatrix();
    g_mvpMatrix.concat(this.g_modelMatrix);
    this.gl.uniformMatrix4fv(this.u_MvpMatrix, false, g_mvpMatrix.elements);

    // render shadow
    this.gl.uniform1i(this.u_ShadowOn, !Camera.state.lightOn);  // if light is on, then shadow is off
    this.gl.uniform1i(this.u_ShadowMap, 2);  // the texture unit for shadow map is 2
    g_mvpMatrix = Camera.getViewProjMatrixFromLight();
    g_mvpMatrix.concat(this.g_modelMatrix);
    this.gl.uniformMatrix4fv(this.u_MvpMatrixFromLight, false, g_mvpMatrix.elements);

    // Draw
    this.gl.drawElements(this.gl.TRIANGLES, this.g_drawingInfo.indices.length, this.gl.UNSIGNED_SHORT, 0);
  }

  onReadComplete() {
    // Acquire the vertex coordinates and colors from OBJ file
    this.g_drawingInfo = this.g_objDoc.getDrawingInfo();

    // Write date into the buffer object
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.g_drawingInfo.vertices, this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_Position, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_Position);


    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.normalBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.g_drawingInfo.normals, this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_Normal, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_Normal);


    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.g_drawingInfo.colors, this.gl.STATIC_DRAW);

    this.gl.vertexAttribPointer(this.a_Color, 4, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.a_Color);

    // Write the indices to the buffer object
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.g_drawingInfo.indices, this.gl.STATIC_DRAW);

  }

  // add animation to bird
  addAnimation() {
    this.angle = 0;  // current angle
    this.angle_per_second = 60;  // angle per second
    this.radius = 1;  // radius of the circle
    this.phi = 30 * Math.PI / 180;  // the angle between the circle and the ground

    // add the 'nextFrame' function to the object
    // it update the angle according to the timestamp
    this.nextFrame = (timestamp) => {
      this.angle = this.angle_per_second * timestamp / 1000;
      this.angle %= 360;
    }
  }

  // render shadow map
  renderShadow(timestamp) {
    this.gl.useProgram(this.shadowProgram);
    this.gl.program = this.shadowProgram;

    if (this.g_objDoc != null && this.g_objDoc.isMTLComplete()) {
      // Acquire the vertex coordinates and colors from OBJ file
      this.g_drawingInfo = this.g_objDoc.getDrawingInfo();

      // Write date into the buffer object
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.vertexBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, this.g_drawingInfo.vertices, this.gl.STATIC_DRAW);

      this.gl.vertexAttribPointer(this.shadowProgram.a_Position, 3, this.gl.FLOAT, false, 0, 0);
      this.gl.enableVertexAttribArray(this.shadowProgram.a_Position);

      // Write the indices to the buffer object
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indexBuffer);
      this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.g_drawingInfo.indices, this.gl.STATIC_DRAW);
    }
    if (!this.g_drawingInfo) {
      return;
    }

    // update the model matrix, because the bird is rotating
    if (this.hasOwnProperty('nextFrame')) {
      this.nextFrame(timestamp);
      this.initPerspective();

      this.g_modelMatrix.translate(-1, 0, 0);
      this.g_modelMatrix.rotate(this.angle, 0, 1, 0);

      /*
      according to the following formula:
      x = r cos(phi) sin(theta)
      y = r sin(phi) sin(theta)
      z = r cos(theta)
      so that:
      dx = r cos(phi) cos(theta)
      dy = r sin(phi) cos(theta)
      dz = -r sin(theta)
      */
      var theta = this.angle * Math.PI / 180;
      var dx = this.radius * Math.cos(this.phi) * Math.cos(theta);
      var dy = this.radius * Math.sin(this.phi) * Math.cos(theta);
      var dz = -1 * this.radius * Math.sin(theta);

      this.g_modelMatrix.translate(dx, dy, dz);
    }

    let g_mvpMatrix = Camera.getViewProjMatrixFromLight();
    g_mvpMatrix.concat(this.g_modelMatrix);

    // set the mvp matrix from light
    this.gl.uniformMatrix4fv(this.shadowProgram.u_MvpMatrix, false, g_mvpMatrix.elements);

    // Draw
    this.gl.drawElements(this.gl.TRIANGLES, this.g_drawingInfo.indices.length, this.gl.UNSIGNED_SHORT, 0);
  }
}
