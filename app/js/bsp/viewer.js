import THREE from 'three';

function createBSPGeometry( bsp ) {
  var {
    vertexes,
    edges,
    surfedges,
    faces
  } = bsp;

  var geometry = new THREE.Geometry();

  // Vertices.
  var i, il;
  for ( i = 0, il = vertexes.length; i < il; i++ ) {
    geometry.vertices.push( new THREE.Vector3().copy( vertexes[i] ) );
  }

  // Faces.
  var edge;
  var surfedge;
  var face;
  var vi, vj, vk;
  var j;
  for ( i = 0, il = faces.length; i < il; i++ ) {
    face = faces[i];

    // Triangulate BSP faces (convex polygons).
    for ( j = 0; j < face.numedges - 1; j++ ) {
      surfedge = surfedges[ face.firstedge + j ];
      edge = edges[ Math.abs( surfedge ) ];

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

function createDisplacementGeometry( bsp ) {
  var {
    vertexes,
    surfedges,
    edges,
    faces,
    dispinfos,
    dispVerts
  } = bsp;

  function startVertex( face ) {
    var surfedge = surfedges[ face ];
    var edge = edges[ Math.abs( surfedge ) ];
    return vertexes[ surfedge >= 0 ? edge.v[0] : edge.v[1] ];
  }

  var disps = [];

  var face;
  var dispinfo;
  var disp;
  var vector = new THREE.Vector3();
  var temp = new THREE.Vector3();
  var size;
  var vertexCount;
  var vertex;
  var v0;
  // Edge deltas.
  var du = new THREE.Vector3();
  var dv = new THREE.Vector3();
  var i, il;
  var j;
  // Parameters along face.
  var ut, vt;
  for ( i = 0, il = faces.length; i < il; i++ ) {
    face = faces[i];
    dispinfo = dispinfos[ face.dispinfo ];
    disp = new THREE.Geometry();

    v0 = startVertex( face.firstedge );
    du.copy( startVertex( face.firstedge + 1 ) ).sub( v0 );
    dv.copy( startVertex( face.firstedge + 3 ) ).sub( v0 );

    /**
     *   1       2
     *    0-----o
     *    |     |
     *    |     |
     *    o-----o
     *   0       3
     */
    size = Math.pow( 2, dispinfo.power ) + 1;
    vertexCount = size * size;
    for ( j = 0; j < vertexCount; j++ ) {
      vertex = dispVerts[ dispinfo.dispVertStart + j ];

      ut = ( j % size ) / ( size - 1 );
      vt = Math.floor( j / size ) / ( size - 1 );

      vector.copy( v0 )
        .add( temp.copy( du ).multiplyScalar( ut ) )
        .add( temp.copy( dv ).multiplyScalar( vt ) );

      disp.vertices.push( vector.clone() );
    }

    disps.push( disp );
  }

  return disps;
}

var container;
var scene, camera, renderer;
var mesh, geometry, material;

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

  var helper = new THREE.EdgesHelper( mesh, 0x000000 );
  scene.add( helper );

  var light = new THREE.DirectionalLight( '#fff' );
  light.position.set( 2048, 0, 2048 );
  scene.add( light );

  scene.add( new THREE.AmbientLight( '#555' ) );

  // Handle resize events.
  window.addEventListener( 'resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
  });
}

export function animate() {
  var time = Date.now() * 1e-3;

  var { center, radius } = geometry.boundingSphere;
  var angle = 0.25 * time;

  camera.position.set(
    radius * Math.cos( angle ) + center.x,
    radius * Math.sin( angle ) + center.y,
    0.5 * radius
  );

  camera.lookAt( geometry.boundingSphere.center );
  camera.up.set( 0, 0, 1 );

  renderer.render( scene, camera );
  requestAnimationFrame( animate );
}
