const container = document.querySelector('#container');
const canvasContainer = document.querySelector('#canvas-container');
const info = document.querySelector('#info');
function positionContainers() {
    console.log(window.innerWidth, window.innerHeight);
    if (window.innerHeight > window.innerWidth) {
        positionContainersVertically();
        return;
    }
    positionContainersHorizontally();
}

function positionContainersVertically() {
    console.log('here');
    container.style.flexDirection = 'column';
    canvasContainer.style.width = '100vw';
    canvasContainer.style.height = '80vh';
    info.style.width = '100vw';
    info.style.height = '20vh';
}

function positionContainersHorizontally() {
    container.style.flexDirection = 'row';
    canvasContainer.style.width = '80vw';
    canvasContainer.style.height = '100vh';
    info.style.width = '20vw';
    info.style.height = '100vh';
}

positionContainers();
window.addEventListener('resize', positionContainers);
window.addEventListener('orientationchange', positionContainers);
