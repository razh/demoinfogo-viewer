import THREE from 'three';

const mergeBoundingSpheres = (() => {
  const difference = new THREE.Vector3();

  return ( a, b ) => {
    difference.subVectors( b.center, a.center );

    const length = difference.length();
    const ra = a.radius;
    const rb = b.radius;

    if ( ra + rb >= length ) {
      if ( ra - rb >= length ) { return a.clone(); }
      if ( rb - ra >= length ) { return b.clone(); }
    }

    const min = Math.min( -ra, length - rb );
    const max = ( Math.max( ra, length + rb ) - min ) / 2;

    return new THREE.Sphere(
      // Center.
      a.center.clone().add( difference.setLength( max + min ) ),
      // Radius.
      max
    );
  };
})();

export default function createPlayerViewer( players ) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 1e5 );
  scene.add( camera );

  const boundingSpheres = players.map( player => {
    const { geometry } = player;
    geometry.computeBoundingSphere();

    // Ignore invalid geometry.
    const { boundingSphere } = geometry;
    if ( !boundingSphere.radius || !boundingSphere.center.length() ) {
      return;
    }

    const line = new THREE.Line( geometry, new THREE.LineBasicMaterial() );
    scene.add( line );

    return boundingSphere;
  });

  const boundingSphere = boundingSpheres
    .filter( Boolean )
    .reduce( mergeBoundingSpheres );

  function animate() {
    const time = Date.now() * 1e-3;

    const { center, radius } = boundingSphere;
    const angle = 0.25 * time;

    camera.position.set(
      Math.cos( angle ) * radius + center.x,
      Math.sin( angle ) * radius + center.y,
      0.5 * radius
    );

    camera.lookAt( center );
    camera.up.set( 0, 0, 1 );

    renderer.render( scene, camera );
    requestAnimationFrame( animate );
  }

  return { animate };
}
