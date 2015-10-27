import THREE from 'three';

// Temporary vector.
const vector = new THREE.Vector3();

function createBSPGeometry( bsp ) {
  const {
    vertexes,
    edges,
    surfedges,
    faces
  } = bsp;

  const geometry = new THREE.Geometry();

  // Vertices.
  for ( let i = 0; i < vertexes.length; i++ ) {
    geometry.vertices.push( new THREE.Vector3().copy( vertexes[i] ) );
  }

  // Faces.
  for ( let i = 0; i < faces.length; i++ ) {
    const face = faces[i];

    // Triangulate BSP faces (convex polygons).
    let vi, vj, vk;
    for ( let j = 0; j < face.numedges - 1; j++ ) {
      const surfedge = surfedges[ face.firstedge + j ];
      const edge = edges[ Math.abs( surfedge ) ];

      // Initial vertex.
      // Reverse winding order if surfedge is negative.
      if ( !j ) {
        vi = surfedge >= 0 ? edge.v[0] : edge.v[1];
      } else {
        // BSP uses a clockwise winding order. THREE is counter-clockwise.
        if ( surfedge >= 0 ) {
          vj = edge.v[1];
          vk = edge.v[0];
        } else {
          vj = edge.v[0];
          vk = edge.v[1];
        }

        geometry.faces.push( new THREE.Face3( vi, vj, vk ) );
      }
    }
  }

  geometry.computeFaceNormals();
  geometry.computeVertexNormals();

  return geometry;
}

function createDisplacementGeometries( bsp ) {
  const {
    vertexes,
    surfedges,
    edges,
    faces,
    dispinfos,
    dispVerts
  } = bsp;

  function startVertex( face ) {
    const surfedge = surfedges[ face ];
    const edge = edges[ Math.abs( surfedge ) ];
    return vertexes[ surfedge >= 0 ? edge.v[0] : edge.v[1] ];
  }

  const disps = [];

  // Edge deltas.
  const du = new THREE.Vector3();
  const dv = new THREE.Vector3();

  for ( let f = 0; f < faces.length; f++ ) {
    const face = faces[f];
    if ( face.dispinfo < 0 ) {
      continue;
    }

    const dispinfo = dispinfos[ face.dispinfo ];
    const disp = new THREE.Geometry();

    /**
     *   1       2
     *    0-----o
     *    |     |
     *    |     |
     *    o-----o
     *   0       3
     */
    const v0 = startVertex( face.firstedge );
    du.subVectors( startVertex( face.firstedge + 1 ), v0 );
    dv.subVectors( startVertex( face.firstedge + 3 ), v0 );

    const size = ( 1 << dispinfo.power ) + 1;
    const vertexCount = size * size;
    for ( let i = 0; i < vertexCount; i++ ) {
      const dispVert = dispVerts[ dispinfo.dispVertStart + i ];

      // Parameters along face.
      const ut = ( i % size ) / ( size - 1 );
      const vt = Math.floor( i / size ) / ( size - 1 );

      vector.copy( v0 )
        .addScaledVector( du, ut )
        .addScaledVector( dv, vt )
        .addScaledVector( dispVert.vector, dispVert.dist );

      disp.vertices.push( vector.clone() );
    }

    // Faces.
    for ( let i = 0; i < size - 1; i++ ) {
      for ( let j = 0; j < size - 1; j++ ) {
        const a = j + size * i;
        const b = j + size * ( i + 1 );
        const c = ( j + 1 ) + size * ( i + 1 );
        const d = ( j + 1 ) + size * i;

        disp.faces.push( new THREE.Face3( a, b, d ) );
        disp.faces.push( new THREE.Face3( b, c, d ) );
      }
    }

    disps.push( disp );
  }

  return disps;
}

let options = {
  displacements: false
};

let container;
let scene, camera, renderer;
let mesh, geometry, material;

let scale = 1;

export function init( bsp ) {
  container = document.createElement( 'div' );
  document.body.appendChild( container );

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  container.appendChild( renderer.domElement );

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2( '#000', 1e-5 );

  camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 1e5 );
  scene.add( camera );

  material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    opacity: 0.8,
    transparent: true,
    shading: THREE.FlatShading
  });

  geometry = createBSPGeometry( bsp );
  geometry.computeBoundingSphere();

  mesh = new THREE.Mesh( geometry, material );
  scene.add( mesh );

  const helper = new THREE.EdgesHelper( mesh, 0x000000 );
  scene.add( helper );

  // Displacements.
  if ( options.displacements ) {
    const dispMaterial = new THREE.MeshPhongMaterial({
      color: 0xbbbbbb,
      ambient: 0xff3333,
      opacity: 0.8,
      transparent: true,
      shading: THREE.FlatShading
    });

    createDisplacementGeometries( bsp ).map( geometry => {
      geometry.computeFaceNormals();
      geometry.computeVertexNormals();

      const mesh = new THREE.Mesh( geometry, dispMaterial );
      scene.add( mesh );
      return mesh;
    });
  }

  const light = new THREE.DirectionalLight( '#fff' );
  light.position.copy( geometry.boundingSphere.center );
  light.position.z += geometry.boundingSphere.radius;
  scene.add( light );

  scene.add( new THREE.AmbientLight( '#555' ) );

  // Handle resize events.
  window.addEventListener( 'resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
  });

  container.addEventListener( 'wheel', event => {
    event.preventDefault();

    const speed = 0.98;
    if ( event.deltaY > 0 ) {
      scale /= speed;
    } else {
      scale *= speed;
    }
  });
}

export function animate() {
  const time = Date.now() * 1e-3;

  const { center, radius } = geometry.boundingSphere;
  const angle = 0.25 * time;

  camera.position.set(
    scale * radius * Math.cos( angle ) + center.x,
    scale * radius * Math.sin( angle ) + center.y,
    scale * radius * 0.5
  );

  camera.lookAt( center );
  camera.up.set( 0, 0, 1 );

  renderer.render( scene, camera );
  requestAnimationFrame( animate );
}
