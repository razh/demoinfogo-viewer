import BufferReader from './../buffer-reader';

var Buffer = require( 'buffer' ).Buffer;

// https://developer.valvesoftware.com/wiki/Source_BSP_File_Format
// https://github.com/ValveSoftware/source-sdk-2013/blob/master/mp/src/public/bspfile.h
const HEADER_LUMPS = 64;

const MAXLIGHTMAPS = 4;

// Lump types.
// NOTE: This list is incomplete.
const LUMP = {
  // Map entities.
  ENTITIES: 0,
  // Plane array.
  PLANES: 1,
  // Index to texture names.
  TEXDATA: 2,
  // Vertex array.
  VERTEXES: 3,
  // Compressed visibility bit arrays.
  VISIBILITY: 4,
  // BSP tree nodes.
  NODES: 5,
  // Face texture array.
  TEXINFO: 6,
  // Face array.
  FACES: 7,
  // Lightmap samples.
  LIGHTING: 8,
  // Occlusion polygons and vertices.
  OCCLUSION: 9,
  // BSP tree leaf nodes.
  LEAFS: 10,
  // Correlates between dfaces and Hammer face IDs. Also used as random seed
  // for detail prop placement.
  FACEIDS: 11,
  // Edge array.
  EDGES: 12,
  // Index of edges.
  SURFEDGES: 13,
  // Brush models (geometry of brush entities).
  MODELS: 14,
  // Internal world lights converted from the entity lump.
  WORLDLIGHTS: 15,
  // Index to faces in each leaf.
  LEAFFACES: 16,
  // Index to brushes in each leaf.
  LEAFBRUSHES: 17,
  // Brush array.
  BRUSHES: 18,
  // Brush-side array.
  BRUSHSIDES: 19,
  // Area array.
  AREAS: 20,
  // Portals between areas.
  AREAPORTALS: 21,
  UNUSED0: 22,
  UNUSED1: 23,
  UNUSED2: 24,
  UNUSED3: 25,
  // Displacement surface array.
  DISPINFO: 26,
  // Brush faces array before splitting.
  ORIGINALFACES: 27
};

class Lump {
  constructor() {
    // Offset into file (bytes).
    this.fileofs = 0;
    // Length of lump (bytes).
    this.filelen = 0;
    // Lump format version.
    this.version = 0;
    // Lump ident code.
    this.fourCC = '';
  }

  read( reader ) {
    this.fileofs = reader.readInt32();
    this.filelen = reader.readInt32();
    this.version = reader.readInt32();
    this.fourCC = reader.readString( 4 );
    return this;
  }

  static read( reader ) {
    return new Lump().read( reader );
  }
}

class Header {
  constructor() {
    // BSP file identifier.
    this.ident = 0;
    // BSP file version.
    this.version = 0;
    // Lump directory array.
    this.lumps = [];
    // This map's revision (iteration, version) number.
    this.mapRevision = 0;
  }

  read( reader ) {
    this.ident = reader.readInt32();
    this.version = reader.readInt32();

    this.lumps = [];
    for ( var i = 0; i < HEADER_LUMPS; i++ ) {
      this.lumps.push( Lump.read( reader ) );
    }

    this.mapRevision = reader.readInt32();
    return this;
  }

  static read( reader ) {
    return new Header().read( reader );
  }
}

class Vector {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }

  read( reader ) {
    this.x = reader.readFloat();
    this.y = reader.readFloat();
    this.z = reader.readFloat();
    return this;
  }

  static read( reader ) {
    return new Vector().read( reader );
  }
}

class Plane {
  constructor() {
    // Normal vector.
    this.normal = null;
    // Distance from origin.
    this.dist = 0;
    // Plane axis identifier.
    this.type = 0;
  }

  read( reader ) {
    this.normal = Vector.read( reader );
    this.dist = reader.readFloat();
    this.type = reader.readInt32();
    return this;
  }

  static read( reader ) {
    return new Plane().read( reader );
  }
}

class Edge {
  constructor() {
    // Vertex indices.
    this.v = [];
  }

  read( reader ) {
    this.v = [ reader.readUInt16(), reader.readUInt16() ];
    return this;
  }

  static read( reader ) {
    return new Edge().read( reader );
  }
}

class Face {
  constructor() {
    // Plane number.
    this.planenum = 0;
    // Faces opposite to the node's plane direction.
    this.side = 0;
    // 1 if on node, 0 if in leaf.
    this.onNode = 0;
    // Index into surfedges.
    this.firstedge = 0;
    // Number of surfedges.
    this.numedges = 0;
    // Texture info.
    this.texinfo = 0;
    // Displacement info.
    this.dispinfo = 0;
    // Surfaces that are boundaries of fog volumes.
    this.surfaceFogVolumeID = 0;
    // Switchable lighting info.
    this.styles = [];
    // Offset into lightmap lump.
    this.lightofs = 0;
    // Face area in units^2.
    this.area = 0;
    // Texture lighting info.
    this.lightmapTextureMinsInLuxels = [];
    this.lightmapTextureSizeInLuxels = [];
    // Original face this was split from.
    this.origFace = 0;
    // Primitives.
    this.numPrims = 0;
    this.firstPrimID = 0;
    // Lightmap smoothing group.
    this.smoothingGroups = 0;
  }

  read( reader ) {
    this.planenum = reader.readUInt16();
    this.side = reader.readByte();
    this.onNode = reader.readByte();
    this.firstedge = reader.readInt32();
    this.numedges = reader.readShort();
    this.texinfo = reader.readShort();
    this.dispinfo = reader.readShort();
    this.surfaceFogVolumeID = reader.readShort();

    this.styles = [];
    for ( var i = 0; i < MAXLIGHTMAPS; i++ ) {
      this.styles.push( reader.readByte() );
    }

    this.lightofs = reader.readInt32();
    this.area = reader.readFloat();

    this.lightmapTextureMinsInLuxels = [
      reader.readInt32(),
      reader.readInt32()
    ];

    this.lightmapTextureSizeInLuxels = [
      reader.readInt32(),
      reader.readInt32()
    ];

    this.origFace = reader.readInt32();
    this.numPrims = reader.readUInt16();
    this.firstPrimID = reader.readUInt16();
    this.smoothingGroups = reader.readUInt32();
    return this;
  }

  static read( reader ) {
    return new Face().read( reader );
  }
}

class Brush {
  constructor() {
    // First brushside.
    this.firstside = 0;
    // Number of brushsides.
    this.numsides = 0;
    // Contents flags.
    this.contents = 0;
  }

  read( reader ) {
    this.firstside = reader.readInt32();
    this.numsides = reader.readInt32();
    this.contents = reader.readInt32();
    return this;
  }

  static read( reader ) {
    return new Brush().read( reader );
  }
}

class Brushside {
  constructor() {
    // Facing out of the leaf.
    this.planenum = 0;
    // Texture info.
    this.texinfo = 0;
    // Displacement info.
    this.dispinfo = 0;
    // Is the side a bevel plane?
    this.bevel = 0;
  }

  read( reader ) {
    this.planenum = reader.readUInt16();
    this.texinfo = reader.readShort();
    this.dispinfo = reader.readShort();
    this.bevel = reader.readShort();
    return this;
  }

  static read( reader ) {
    return new Brushside().read( reader );
  }
}

function readLumpData( reader, lump, type ) {
  var prevOffset = reader.offset;
  reader.offset = lump.fileofs;

  var data = [];
  while ( reader.offset - lump.fileofs < lump.filelen ) {
    data.push( type.read( reader ) );
  }

  reader.offset = prevOffset;
  return data;
}

export function parse( file ) {
  var buffer = new Buffer( new Uint8Array( file ) );
  var reader = new BufferReader( buffer );

  var header = Header.read( reader );
  console.log( header );

  // Planes.
  var planesLump = header.lumps[ LUMP.PLANES ];
  var planes = readLumpData( reader, planesLump, Plane );
  console.log( planes );

  // Vertexes.
  var vertexesLump = header.lumps[ LUMP.VERTEXES ];
  var vertexes = readLumpData( reader, vertexesLump, Vector );
  console.log( vertexes );

  // Edges.
  var edgesLump = header.lumps[ LUMP.EDGES ];
  var edges = readLumpData( reader, edgesLump, Edge );
  console.log( edges );

  // Faces.
  var facesLump = header.lumps[ LUMP.FACES ];
  var faces = readLumpData( reader, facesLump, Face );
  console.log( faces );

  // Brushes.
  var brushesLump = header.lumps[ LUMP.BRUSHES ];
  var brushes = readLumpData( reader, brushesLump, Brush );
  console.log( brushes );

  // Brushsides.
  var brushsidesLump = header.lumps[ LUMP.BRUSHSIDES ];
  var brushsides = readLumpData( reader, brushsidesLump, Brushside );
  console.log( brushsides );
}
