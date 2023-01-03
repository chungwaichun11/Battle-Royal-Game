const Camera = function(x, y) {

    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    let mousePos = { x: 0, y: 0 }

    // Set mouse pos in game space
    function setMousePos(x, y) {
        mousePos.x = x;
        mousePos.y = y
    }

    function setBounds(minX_, minY_, maxX_, maxY_) {
        minX = minX_ + 160;
        minY = minY_ + 90;
        maxX = maxX_ - 160;
        maxY = maxY_ - 90;
    }

    // Returns mouse coordinate in game space
    function getMouseCoord() {
        return {
            x: x + mousePos.x - 160,
            y: y + mousePos.y - 90
        }
    }

    function getPos() {
        return { x, y }
    }

    function lerp(target) {
        x = Math.min(maxX, Math.max(minX, target.x));
        y = Math.min(maxY, Math.max(minY, target.y));
    }

    return { setMousePos, setBounds, getMouseCoord, getPos, lerp }
};