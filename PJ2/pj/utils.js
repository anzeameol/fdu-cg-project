//将canvas坐标转化为webgl坐标
function normPosX(pos, width) {
    width = canvasSize.maxX;
    return (2 * pos - width) / width;
}

function normPosY(pos, height) {
    height = canvasSize.maxY;
    return (height - 2 * pos) / height;
}

//未使用
function normVertexPos(width, height) {
    for (var i in vertex_pos) {
        vertex_pos[i][0] = (2 * vertex_pos[i][0] - width) / width;
        vertex_pos[i][1] = (height - 2 * vertex_pos[i][1]) / height;
    }
}

//计算两点之间的距离
function getDis(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
}