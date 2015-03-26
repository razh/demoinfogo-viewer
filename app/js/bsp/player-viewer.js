import THREE from 'three';

export default function createPlayerViewer( player ) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 1e5 );
  scene.add( camera );

  const { geometry } = player;
  geometry.computeBoundingSphere();

  const line = new THREE.Line( geometry, new THREE.LineBasicMaterial() );
  scene.add( line );

  function animate() {
    const time = Date.now() * 1e-3;

    const { center, radius } = geometry.boundingSphere;
    const angle = 0.25 * time;

    camera.position.set(
      Math.cos( angle ) * radius + center.x,
      Math.sin( angle ) * radius + center.y,
      0.5 * radius
    );

    camera.lookAt( geometry.boundingSphere.center );
    camera.up.set( 0, 0, 1 );

    renderer.render( scene, camera );
    requestAnimationFrame( animate );
  }

  return { animate };
}
