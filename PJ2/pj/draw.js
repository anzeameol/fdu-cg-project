//用于画三角形的shader
var VSHADER_SOURCE_TRIANGLE =
    'attribute vec4 a_Position;\n' +
    'attribute vec4 a_Color;\n' +
    'varying vec4 v_Color;\n' +
    'uniform mat4 u_ModelMatrix;\n' +
    'void main() {\n' +
    '  gl_Position = u_ModelMatrix * a_Position;\n' +
    '  v_Color = a_Color;\n' +
    '}\n';

var FSHADER_SOURCE_TRIANGLE =
    'precision mediump float;\n' +
    'varying vec4 v_Color;\n' +
    'void main() {\n' +
    '  gl_FragColor = v_Color;\n' +
    '}\n';

//用于画线的shader
var VSHADER_SOURCE_LINE =
    'attribute vec4 a_Position;\n' +
    'uniform mat4 u_ModelMatrix;\n' +
    'void main() {\n' +
    '  gl_Position = u_ModelMatrix * a_Position;\n' +
    '}\n';

var FSHADER_SOURCE_LINE =
    'void main() {\n' +
    '  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n' +
    '}\n';

//三角形的顶点编号
var triangle = [
    [6, 7, 3],
    [3, 7, 4],
    [7, 8, 4],
    [4, 8, 5],
    [4, 5, 1],
    [1, 5, 2],
    [0, 4, 1],
    [3, 4, 0]
];

//建立并初始化缓冲区
function initBuffer(gl) {
    var data = new Float32Array(8 * 3 * 9);
    var idx = 0;
    for (var i in triangle) {
        for (j = 0; j < 3; j++) {
            data[idx++] = normPosX(vertex_pos[triangle[i][j]][0]);
            data[idx++] = normPosY(vertex_pos[triangle[i][j]][1]);
            data[idx++] = vertex_color[triangle[i][j]][0] / 255;
            data[idx++] = vertex_color[triangle[i][j]][1] / 255;
            data[idx++] = vertex_color[triangle[i][j]][2] / 255;
        }
    }
    for (var i in triangle) {
        for (j = 0; j < 3; j++) {
            data[idx++] = normPosX(vertex_pos[triangle[i][j]][0]);
            data[idx++] = normPosY(vertex_pos[triangle[i][j]][1]);
            data[idx++] = normPosX(vertex_pos[triangle[i][(j + 1) % 3]][0]);
            data[idx++] = normPosY(vertex_pos[triangle[i][(j + 1) % 3]][1]);
        }
    }
    var buffer = gl.createBuffer();
    if (!buffer) {
        console.log('Failed to create the buffer object');
        return -1;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return data.BYTES_PER_ELEMENT;
}

//分配缓冲区中三角形的信息
function setBufferTriangle(gl, fsize) {
    var n = 8 * 3;
    var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    if (a_Position < 0) {
        console.log('Failed to get the storage location of a_Position');
        return -1;
    }
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, fsize * 5, 0);
    gl.enableVertexAttribArray(a_Position);

    var a_Color = gl.getAttribLocation(gl.program, 'a_Color');
    if (a_Color < 0) {
        console.log('Failed to get the storage location of a_Color');
        return -1;
    }
    gl.vertexAttribPointer(a_Color, 3, gl.FLOAT, false, fsize * 5, fsize * 2);
    gl.enableVertexAttribArray(a_Color);
    return n;
}

//分配缓冲区中线段的信息
function setBufferLine(gl, fsize) {
    var n = 8 * 6;
    var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    if (a_Position < 0) {
        console.log('Failed to get the storage location of a_Position');
        return -1;
    }
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, fsize * 8 * 3 * 5);
    gl.enableVertexAttribArray(a_Position);

    return n;
}

//设置变换矩阵
function setTransform(gl, modelMatrix) {
    var u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    if (!u_ModelMatrix) {
        console.log('Failed to get the storage location of u_ModelMatrix');
        return -1;
    }
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    return 0;
}

//渲染pipeline
function render(gl, modelMatrix, fsize, lineOpen) {
    if (!initShaders(gl, VSHADER_SOURCE_TRIANGLE, FSHADER_SOURCE_TRIANGLE)) {
        console.log('Failed to intialize shaders.');
        return;
    }
    if (setTransform(gl, modelMatrix) < 0) {
        console.log('Failed to set u_ModelMatrix');
        return;
    }
    var n = setBufferTriangle(gl, fsize);
    if (n < 0) {
        console.log('Failed to set the positions of the vertices');
        return;
    }
    gl.drawArrays(gl.TRIANGLES, 0, n);
    if (lineOpen) {
        if (!initShaders(gl, VSHADER_SOURCE_LINE, FSHADER_SOURCE_LINE)) {
            console.log('Failed to intialize shaders.');
            return;
        }
        if (setTransform(gl, modelMatrix) < 0) {
            console.log('Failed to set u_ModelMatrix');
            return;
        }
        n = setBufferLine(gl, fsize);
        if (n < 0) {
            console.log('Failed to set the positions of the vertices');
            return;
        }
        gl.drawArrays(gl.LINES, 0, n);
    }
}

//旋转角度和比例随时间变换
var g_last = Date.now();
function animate(angle, scale, direction) {
    var now = Date.now();
    var elapsed = now - g_last;
    g_last = now;
    var newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
    var newScale = scale + direction * (SCALE_STEP * elapsed) / 1000.0;
    return { newAngle: newAngle, newScale: newScale };
}

function main() {
    var canvas = document.getElementById('webgl');
    canvas.width = canvasSize.maxX;
    canvas.height = canvasSize.maxY;
    var gl = getWebGLContext(canvas);
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    //清空颜色缓冲区
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    var currentAngle = 0.0;
    var currentScale = 1.0;
    var direction = -1;
    var modelMatrix = new Matrix4();
    var lineOpen = 1;
    var onTransform = 0;
    var onEdit = 1;

    var fsize = initBuffer(gl);
    if (fsize < 0) {
        console.log('Failed to intialize buffer.');
        return;
    }

    // 一帧动画
    var tick = function () {
        if (onTransform) {
            var ret = animate(currentAngle, currentScale, direction);
            currentAngle = ret.newAngle;
            currentScale = ret.newScale;
            if (currentScale < 0.2) {
                direction = 1;
                currentScale = 0.2;
            }
            if (currentScale > 1.0) {
                direction = -1;
                currentScale = 1.0;
            }
        }
        if (onEdit) {
            currentAngle = 0;
            currentScale = 1.0;
            direction = -1;
        }
        modelMatrix.setRotate(currentAngle, 0, 0, 1);
        modelMatrix.scale(currentScale, currentScale, 1);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        render(gl, modelMatrix, fsize, lineOpen)
        requestAnimationFrame(tick, canvas);
    };

    tick();

    //检测按钮按下事件：并设置参数表示现在处于编辑状态还是动画状态
    window.onkeydown = function (ev) {
        switch (ev.keyCode) {
            case 84: // T
                onTransform = !onTransform;
                g_last = Date.now();
                onEdit = 0;
                break;
            case 69: // E
                onEdit = 1;
                onTransform = 0;
                break;
            case 66: // B
                lineOpen = !lineOpen;
                break;
            default: return;
        }
    };

    //检测鼠标按下事件：判断是否选中顶点
    var isSelect = 0;
    pointNum = -1;
    canvas.onmousedown = function (ev) {
        if (onTransform) {
            return;
        }
        var x = ev.clientX;
        var y = ev.clientY;
        var rect = ev.target.getBoundingClientRect();
        x = x - rect.left;
        y = y - rect.top;
        pointNum = -1;
        isSelect = 0;
        for (var i in vertex_pos) {
            if (getDis(vertex_pos[i][0], vertex_pos[i][1], x, y) < radius) {
                isSelect = 1;
                pointNum = i;
                break;
            }
        }
    };
    //检测鼠标松开事件：还原
    canvas.onmouseup = function () {
        isSelect = 0;
    };
    //检测鼠标移动事件：如果选中顶点，则移动顶点并重新渲染
    canvas.onmousemove = function (ev) {
        if (onTransform) {
            return;
        }
        var x = ev.clientX;
        var y = ev.clientY;
        var rect = ev.target.getBoundingClientRect();
        x = x - rect.left;
        y = y - rect.top;
        if (isSelect) {
            if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) {
                vertex_pos[pointNum][0] = x;
                vertex_pos[pointNum][1] = y;
                gl.clearColor(0.0, 0.0, 0.0, 1.0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                fsize = initBuffer(gl);
                render(gl, modelMatrix, fsize, lineOpen);
            }
        }
    };
}