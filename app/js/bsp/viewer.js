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

function createDisplacementGeometries( bsp ) {
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
  var dispVert;
  var disp;
  var v0;
  var size;
  var vertexCount;
  // Edge deltas.
  var du = new THREE.Vector3();
  var dv = new THREE.Vector3();
  // Temporary vector.
  var vector = new THREE.Vector3();
  var f, fl;
  var i, j;
  // Parameters along face.
  var ut, vt;
  for ( f = 0, fl = faces.length; f < fl; f++ ) {
    face = faces[f];
    if ( face.dispinfo < 0 ) {
      continue;
    }

    dispinfo = dispinfos[ face.dispinfo ];
    disp = new THREE.Geometry();

    /**
     *   1       2
     *    0-----o
     *    |     |
     *    |     |
     *    o-----o
     *   0       3
     */
    v0 = startVertex( face.firstedge );
    du.subVectors( startVertex( face.firstedge + 1 ), v0 );
    dv.subVectors( startVertex( face.firstedge + 3 ), v0 );

    size = ( 1 << dispinfo.power ) + 1;
    vertexCount = size * size;
    for ( i = 0; i < vertexCount; i++ ) {
      dispVert = dispVerts[ dispinfo.dispVertStart + i ];

      ut = ( i % size ) / ( size - 1 );
      vt = Math.floor( i / size ) / ( size - 1 );

      vector.copy( v0 )
        .addScaledVector( du, ut )
        .addScaledVector( dv, vt )
        .addScaledVector( dispVert.vector, dispVert.dist );

      disp.vertices.push( vector.clone() );
    }

    // Faces.
    var a, b, c, d;
    for ( i = 0; i < size - 1; i++ ) {
      for ( j = 0; j < size - 1; j++ ) {
        a = j + size * i;
        b = j + size * ( i + 1 );
        c = ( j + 1 ) + size * ( i + 1 );
        d = ( j + 1 ) + size * i;

        disp.faces.push( new THREE.Face3( a, b, d ) );
        disp.faces.push( new THREE.Face3( b, c, d ) );
      }
    }

    disps.push( disp );
  }

  return disps;
}

var options = {
  displacements: false
};

var container;
var scene, camera, renderer;
var mesh, geometry, material;

var scale = 1;

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

  // Displacements.
  if ( options.displacements ) {
    var dispMaterial = new THREE.MeshPhongMaterial({
      color: 0xbbbbbb,
      ambient: 0xff3333,
      opacity: 0.8,
      transparent: true,
      shading: THREE.FlatShading
    });

    createDisplacementGeometries( bsp ).map( geometry => {
      geometry.computeFaceNormals();
      geometry.computeVertexNormals();

      var mesh = new THREE.Mesh( geometry, dispMaterial );
      scene.add( mesh );
      return mesh;
    });
  }

  var light = new THREE.DirectionalLight( '#fff' );
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

    var speed = 0.98;
    if ( event.deltaY > 0 ) {
      scale /= speed;
    } else {
      scale *= speed;
    }
  });
}

export function animate() {
  var time = Date.now() * 1e-3;

  var { center, radius } = geometry.boundingSphere;
  var angle = 0.25 * time;

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
