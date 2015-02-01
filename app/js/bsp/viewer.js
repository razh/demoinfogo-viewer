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

  camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 1e6 );
  camera.position.set( 0, 0, 8192 );
  camera.lookAt( new THREE.Vector3() );
  scene.add( camera );

  material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true
  });

  geometry = createBSPGeometry( bsp );
  mesh = new THREE.Mesh( geometry, material );

  scene.add( mesh );
}

export function animate() {
  renderer.render( scene, camera );
  requestAnimationFrame( animate );
}
