//该函数在一个canvas上绘制一个点
//其中cxt是从canvas中获得的一个2d上下文context
//    x,y分别是该点的横纵坐标
//    color是表示颜色的整形数组，形如[r,g,b]
//    color在这里会本转化为表示颜色的字符串，其内容也可以是：
//        直接用颜色名称:   "red" "green" "blue"
//        十六进制颜色值:   "#EEEEFF"
//        rgb分量表示形式:  "rgb(0-255,0-255,0-255)"
//        rgba分量表示形式:  "rgba(0-255,1-255,1-255,透明度)"
//由于canvas本身没有绘制单个point的接口，所以我们通过绘制一条短路径替代
function drawPoint(cxt, x, y, color) {
    //建立一条新的路径
    cxt.beginPath();
    //设置画笔的颜色
    cxt.strokeStyle = "rgb(" + color[0] + "," +
        +color[1] + "," +
        +color[2] + ")";
    //设置路径起始位置
    cxt.moveTo(x, y);
    //在路径中添加一个节点
    cxt.lineTo(x + 1, y + 1);
    //用画笔颜色绘制路径
    cxt.stroke();
}
//绘制线段的函数绘制一条从(x1,y1)到(x2,y2)的线段，cxt和color两个参数意义与绘制点的函数相同，
function drawLine(cxt, x1, y1, x2, y2, color) {

    cxt.beginPath();
    cxt.strokeStyle = "rgba(" + color[0] + "," +
        +color[1] + "," +
        +color[2] + "," +
        +255 + ")";
    //这里线宽取1会有色差，但是类似半透明的效果有利于debug，取2效果较好
    cxt.lineWidth = lineWidth;
    cxt.moveTo(x1, y1);
    cxt.lineTo(x2, y2);
    cxt.stroke();
}

//绘制顶点上的圆形句柄，通过一行一行地画水平线实现
function drawCircle(cxt, x, y, radius, color) {
    for (j = y - radius; j < y + radius; j++) {
        height = Math.abs(y - j);
        step = Math.sqrt(radius * radius - height * height);
        drawLine(cxt, x - step, j, x + step, j, color);
    }
}

//判断线段与水平扫描线是否相交
function isIntersect(y, v1, v2) {
    return ((vertex_pos[v1][1] - y) * (vertex_pos[v2][1] - y) <= 0);
}

//如果相交，求交点；如果线段与扫描线重合，返回-1
function getIntersect(y, v1, v2) {
    x1 = vertex_pos[v1][0];
    y1 = vertex_pos[v1][1];
    x2 = vertex_pos[v2][0];
    y2 = vertex_pos[v2][1];
    if (y1 == y2) {
        return -1;
    }
    return ((y * (x1 - x2) - x1 * y2 + x2 * y1) / (y1 - y2));
}

//使用多边形扫描算法绘制四边形
function renderRect(cxt, vertex, color) {
    //确定扫描线的范围
    minX = canvasSize.maxX;
    maxX = 0;
    minY = canvasSize.maxY;
    maxY = 0;
    for (var i in vertex) {
        minX = Math.min(minX, vertex_pos[vertex[i]][0]);
        minY = Math.min(minY, vertex_pos[vertex[i]][1]);
        maxX = Math.max(maxX, vertex_pos[vertex[i]][0]);
        maxY = Math.max(maxY, vertex_pos[vertex[i]][1]);
    }
    var active = [];  //记录扫描线与四边形的交点的x坐标
    for (j = minY; j <= maxY; j++) {
        active = [];
        for (i = 0; i < 4; i++) {
            //如果线段与扫描线重合，将线段的两个端点加入active数组中；否则将交点加入active数组中
            if (isIntersect(j, vertex[i], vertex[(i + 1) % 4])) {
                if ((x = getIntersect(j, vertex[i], vertex[(i + 1) % 4])) < 0) {
                    active.push(vertex_pos[vertex[i]][0]);
                    active.push(vertex_pos[vertex[(i + 1) % 4]][0]);
                }
                else {
                    active.push(x);
                }
            }
        }
        //将所有交点x坐标排序
        active.sort(function (a, b) { return a - b });
        //分4种情况：2个、3个、4个交点、大于等于5个交点，进行渲染
        //2个交点直接渲染
        if (active.length == 2) {
            drawLine(cxt, active[0], j, active[1], j, color);
        }
        //3个交点则线段过顶点
        else if (active.length == 3) {
            for (i = 0; i + 1 < active.length;) {
                if (active[i] == active[i + 1]) {
                    i++;
                    continue;
                }
                drawLine(cxt, active[i], j, active[i + 1], j, color);
                i += 2;
            }
        }
        //4个交点每2个一组进行渲染
        //特殊情况：扫描线过两个不相邻顶点，这时需判断是凸四边形还是凹四边形
        else if (active.length == 4) {
            if (active[0] == active[1] && active[2] == active[3]) {
                positive = 0;
                negative = 0;
                for (var i in vertex) {
                    if (vertex_pos[vertex[i]][1] > j) {
                        positive = 1;
                    }
                    else if (vertex_pos[vertex[i]][1] < j) {
                        negative = 1;
                    }
                }
                if (positive * negative) {
                    drawLine(cxt, active[1], j, active[2], j, color);
                }
            }
            else {
                drawLine(cxt, active[0], j, active[1], j, color);
                drawLine(cxt, active[2], j, active[3], j, color);
            }
        }
        //大于等于5个交点则必有平行线，消除掉重复的点即可
        else if (active.length >= 5) {
            for (i = 0; i + 1 < active.length;) {
                if (active[i] == active[i + 1]) {
                    i++;
                    continue;
                }
                drawLine(cxt, active[i], j, active[i + 1], j, color);
                i++;
            }
        }
    }
}

//计算两点之间的距离
function getDis(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
}

//绘制顶点
function drawVertex(cxt) {
    for (var i in vertex_pos) {
        drawCircle(cxt, vertex_pos[i][0], vertex_pos[i][1], radius, [255, 0, 0]);
        //绘制句柄周围的圆弧
        cxt.beginPath();
        cxt.arc(vertex_pos[i][0], vertex_pos[i][1], radius, 0, 2 * Math.PI);
        cxt.strokeStyle = "black";
        cxt.stroke();
    }
}