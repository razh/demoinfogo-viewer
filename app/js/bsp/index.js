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

const SURF = {
  // Value will hold the light strength.
  LIGHT: 0x0001,
  // Don't draw, indicates we should skylight and draw 2d sky but not draw the
  // 3D skybox.
  SKY2D: 0x0002,
  // Don't draw, but add to skybox.
  SKY: 0x0004,
  // Turbulent water warp.
  WARP: 0x0008,
  TRANS: 0x0010,
  // The surface can not have a portal placed on it.
  NOPORTAL: 0x0020,
  // FIXME: This is an xbox hack to work around elimination of trigger
  // surfaces, which breaks occluders.
  TRIGGER: 0x0040,
  // Don't bother referencing the texture.
  NODRAW: 0x0080,
  // Make a primary bsp splitter.
  HINT: 0x0100,
  // Completely ignore, allowing non-closed brushes.
  SKIP: 0x0200,
  // Don't calculate light.
  NOLIGHT: 0x0400,
  // Calculate three lightmaps for the surface for bumpmapping.
  BUMPLIGHT: 0x0800,
  // Don't receive shadows.
  NOSHADOWS: 0x1000,
  // Don't receive decals.
  NODECALS: 0x2000,
  // Don't subdivide patches on this surface.
  NOCHOP: 0x4000,
  // Surface is part of a hitbox.
  HITBOX: 0x8000
};

function readFloats( reader, n ) {
  var floats = [];

  for ( var i = 0; i < n; i++ ) {
    floats.push( reader.readFloat() );
  }

  return floats;
}

class Texinfo {
  constructor() {
    // [s/t][xyz offset].
    this.textureVecs = [];
    // [s/t][xyz offset] - length is in units of texels/area.
    this.lightmapVecs = [];
    // Miptex flags and overrides.
    this.flags = 0;
    // Pointer to texture name, size, etc.
    this.texdata = 0;
  }

  read( reader ) {
    this.textureVecs = [ readFloats( reader, 4 ), readFloats( reader, 4 ) ];
    this.lightmapVecs = [ readFloats( reader, 4 ), readFloats( reader, 4 ) ];
    this.flags = reader.readInt32();
    this.texdata = reader.readInt32();
    return this;
  }

  static read( reader ) {
    return new Texinfo().read( reader );
  }
}

function readLumpData( reader, lump, read ) {
  var prevOffset = reader.offset;
  reader.offset = lump.fileofs;

  var data = [];
  while ( reader.offset - lump.fileofs < lump.filelen ) {
    data.push( read( reader ) );
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
  var planes = readLumpData( reader, planesLump, Plane.read );
  console.log( planes );

  // Vertexes.
  var vertexesLump = header.lumps[ LUMP.VERTEXES ];
  var vertexes = readLumpData( reader, vertexesLump, Vector.read );
  console.log( vertexes );

  // Edges.
  var edgesLump = header.lumps[ LUMP.EDGES ];
  var edges = readLumpData( reader, edgesLump, Edge.read );
  console.log( edges );

  // Surfedges.
  // Signed ints.
  var surfedgesLump = header.lumps[ LUMP.SURFEDGES ];
  var surfedges = readLumpData(
    reader,
    surfedgesLump,
    reader => reader.readInt32()
  );
  console.log( surfedges );

  // Texinfos.
  var texinfosLump = header.lumps[ LUMP.TEXINFO ];
  var texinfos = readLumpData( reader, texinfosLump, Texinfo.read );
  console.log( texinfos );

  // Faces.
  var facesLump = header.lumps[ LUMP.FACES ];
  var faces = readLumpData( reader, facesLump, Face.read );
  console.log( faces );

  // Brushes.
  var brushesLump = header.lumps[ LUMP.BRUSHES ];
  var brushes = readLumpData( reader, brushesLump, Brush.read );
  console.log( brushes );

  // Brushsides.
  var brushsidesLump = header.lumps[ LUMP.BRUSHSIDES ];
  var brushsides = readLumpData( reader, brushsidesLump, Brushside.read );
  console.log( brushsides );
}
