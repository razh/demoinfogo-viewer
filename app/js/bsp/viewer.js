import THREE from 'three';

function createBSPGeometry( bsp ) {
  var {
    vertexes,
    edges,
    surfedges,
    faces
  } = bsp;

  var geometry = new THREE.BufferGeometry();

  var indices = [];
  var positions = new Float32Array( 3 * vertexes.length );

  // Vertices.
  var vertex;
  var i, il;
  for ( i = 0, il = vertexes.length; i < il; i++ ) {
    vertex = vertexes[i];
    positions[ 3 * i     ] = vertex.x;
    positions[ 3 * i + 1 ] = vertex.y;
    positions[ 3 * i + 2 ] = vertex.z;
  }

  // Faces.
  var edge;
  var surfedge;
  var face;
  var v0, vi, vj;
  var j;
  for ( i = 0, il = faces.length; i < il; i++ ) {
    face = faces[i];

    for ( j = 0; j < face.numedges; j++ ) {
      surfedge = surfedges[ face.firstedge + j ];
      edge = edges[ Math.abs( surfedge ) ];

      // Initial vertex.
      if ( !j ) {
        v0 = surfedge >= 0 ? edge.v[0] : edge.v[1];
        j++;
      } else {
        if ( surfedge >= 0 ) {
          // Positive direction.
          vi = edge.v[0];
          vj = edge.v[1];
        } else {
          // Negative direction.
          vi = edge.v[1];
          vj = edge.v[0];
        }

        indices.push( v0 );
        indices.push( vi );
        indices.push( vj );
      }
    }
  }

  geometry.addAttribute( 'index', new THREE.BufferAttribute( new Uint32Array( indices ), 1 ) );
  geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

  return geometry;
}

var container;
var scene, camera, renderer;
var mesh, geometry, material;

export function init( bsp ) {
  container = document.createElement( 'div' );
  document.body.appendChild( container );

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize( window.innerWidth, window.innerHeight );
  container.appendChild( renderer.domElement );

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 1e6 );
  camera.position.set( 0, 0, 8192 );
  camera.lookAt( new THREE.Vector3() );
  scene.add( camera );

  material = new THREE.MeshBasicMaterial({
    color: 0xFFFFFF,
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
