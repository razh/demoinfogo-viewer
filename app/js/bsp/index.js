import BufferReader from './../buffer-reader';

var Buffer = require( 'buffer' ).Buffer;

// https://developer.valvesoftware.com/wiki/Source_BSP_File_Format
// https://github.com/ValveSoftware/source-sdk-2013/blob/master/mp/src/public/bspfile.h
const HEADER_LUMPS = 64;

const MAXLIGHTMAPS = 4;

// Lump types.
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
  ORIGINALFACES: 27,
  // Displacement physics collision data.
  PHYSDISP: 28,
  // Physics collision data.
  PHYSCOLLIDE: 29,
  // Face plane normals.
  VERTNORMALS: 30,
  // Face plane normal index array.
  VERTNORMALINDICES: 31,
  // Displacement lightmap alphas.
  DISP_LIGHTMAP_ALPHAS: 32,
  // Vertices of displacement surface meshes.
  DISP_VERTS: 33,
  // Displacement lightmap sample positions.
  DISP_LIGHTMAP_SAMPLE_POSITIONS: 34,
  // Game-specific data lump.
  GAME_LUMP: 35,
  // Data for leaf nodes that are inside water.
  LEAFWATERDATA: 36,
  // Water polygon data.
  PRIMITIVES: 37,
  // Water polygon vertices.
  PRIMVERTS: 38,
  // Water polygon vertex index array.
  PRIMINDICES: 39,
  // Embedded uncompressed zip-format file.
  PAKFILE: 40,
  // Clipped portal polygon vertices.
  CLIPPORTALVERTS: 41,
  // env_cubemap location array.
  CUBEMAPS: 42,
  // Texture name data.
  TEXDATA_STRING_DATA: 43,
  // Index array into texdata string data.
  TEXDATA_STRING_TABLE: 44,
  // info_overlay data array.
  OVERLAYS: 45,
  // Distance from leaves to water.
  LEAFMINDISTTOWATER: 46,
  // Macro texture info for faces.
  FACE_MACRO_TEXTURE_INFO: 47,
  // Displacement surface triangles.
  DISP_TRIS: 48,
  // Compressed win32-specific Havok terrain surface collision data.
  PHYSCOLLIDESURFACE: 49,
  WATEROVERLAYS: 50,
  // Index of LUMP_LEAF_AMBIENT_LIGHTING_HDR.
  LEAF_AMBIENT_INDEX_HDR: 51,
  // Index of LUMP_LEAF_AMBIENT_LIGHTING.
  LEAF_AMBIENT_INDEX: 52,
  // HDR lightmap samples.
  LIGHTING_HDR: 53,
  // Internal HDR world lights converted from the entity lump.
  WORLDLIGHTS_HDR: 54,
  // Overrides part of the data stored in LUMP_LEAFS.
  LEAF_AMBIENT_LIGHTING_HDR: 55,
  LEAF_AMBIENT_LIGHTING: 56,
  // xzip version of pak file for Xbox.
  XZIPPAKFILE: 57,
  // HDR maps may have different face data.
  FACES_HDR: 58,
  // Extended level-wide flags. Not present in all levels.
  MAP_FLAGS: 59,
  // Fade distances for overlays.
  OVERLAY_FADES: 60
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
    this.normal = new Vector();
    // Distance from origin.
    this.dist = 0;
    // Plane axis identifier.
    this.type = 0;
  }

  read( reader ) {
    this.normal.read( reader );
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

// Compressed color format.
class ColorRGBExp32 {
  constructor() {
    this.r = 0;
    this.g = 0;
    this.b = 0;
    this.exponent = 0;
  }

  read( reader ) {
    this.r = reader.readByte();
    this.g = reader.readByte();
    this.b = reader.readByte();
    // signed char.
    this.exponent = reader.readInt8();
    return this;
  }

  static read( reader ) {
    return new ColorRGBExp32().read( reader );
  }
}

// Displacement maps.
const ALLOWEDVERTS_SIZE = 10;
// Maximum number of neighboring displacements touching a displacement's corner.
const MAX_DISP_CORNERS_NEIGHBORS = 4;

// These denote where one dispinfo fits on another.
const NeighborSpan = {
  CORNER_TO_CORNER: 0,
  CORNER_TO_MIDPOINT: 1,
  MIDPOINT_TO_CORNER: 2
};

// These define relative orientations of displacement neighbors.
const NeighborOrientation = {
  ORIENTATION_CCW_0: 0,
  ORIENTATION_CCW_90: 1,
  ORIENTATION_CCW_180: 2,
  ORIENTATION_CCW_270: 3
};

class DispSubNeighbor {
  constructor() {
    // Indexes into ddispinfos. 0xFFFF if there is no neighbor here.
    this.neighbor = 0;
    // CCW rotation of the neighbor w/r/t this displacement.
    this.neighborOrientation = 0;
    // These use the NeighborSpan type.
    // Where the neighbor fits onto this side of our displacement.
    this.span = 0;
    // Where we fit onto our neighbor.
    this.neighborSpan = 0;
  }

  read( reader ) {
    this.neighbor = reader.readUInt16();
    this.neighborOrientation = reader.readUInt8();
    this.span = reader.readUInt8();
    this.neighborSpan = reader.readUInt8();
    return this;
  }

  static read( reader ) {
    return new DispSubNeighbor().read( reader );
  }
}

class DispNeighbor {
  constructor() {
    // Note: If there is a neighbor that fills the whole side
    // (CORNER_TO_CORNER), then it will always be in DispNeighbor.neighbors[0].
    this.subNeighbors = [];
  }

  read( reader ) {
    this.subNeighbors = [
      DispSubNeighbor.read( reader ),
      DispSubNeighbor.read( reader )
    ];
    return this;
  }

  static read( reader ) {
    return new DispNeighbor().read( reader );
  }
}

class DispCornerNeighbors {
  constructor() {
    // Indices of neighbors.
    this.neighbors = [];
    this.nNeighbors = 0;
  }

  read( reader ) {
    this.neighbors = [];
    for ( var i = 0; i < MAX_DISP_CORNERS_NEIGHBORS; i++ ) {
      this.neighbors.push( reader.readUInt16() );
    }

    this.nNeighbors = reader.readUInt8();
    return this;
  }

  static read( reader ) {
    return new DispCornerNeighbors().read( reader );
  }
}

class Dispinfo {
  constructor() {
    // Start position used for orientation.
    this.startPosition = new Vector();
    // Index into LUMP_DISP_VERTS.
    this.dispVertStart = 0;
    // Index into LUMP_DISP_TRIS.
    this.dispTriStart = 0;
    // Power - indicates size of map/surface (2^power + 1).
    this.power = 0;
    // Minimum tessellation allowed.
    this.minTess = 0;
    // Lighting smoothing angle.
    this.smoothingAngle = 0;
    // Surface contents.
    this.contents = 0;
    // Which map face this displacement comes from.
    this.mapFace = 0;
    // Index into ddisplightmapalpha.
    this.lightmapAlphaStart = 0;
    // Index into LUMP_DISP_LIGHTMAP_SAMPLE_POSITIONS.
    this.lightmapSamplePositionStart = 0;
    // Indexed by NEIGHBOREDGE_ defines.
    this.edgeNeighbors = [];
    // Indexed by CORNER_ defines.
    this.cornerNeighbors = [];
    // Active vertices.
    // This is built based on the layout and sizes of our neighbors and tells
    // us which vertices are allowed to be active.
    this.allowedVerts = [];
  }

  read( reader ) {
    var start = reader.offset;

    this.startPosition.read( reader );
    this.dispVertStart = reader.readInt32();
    this.dispTriStart = reader.readInt32();
    this.power = reader.readInt32();
    this.minTess = reader.readInt32();
    this.smoothingAngle = reader.readFloat();
    this.contents = reader.readInt32();
    this.mapFace = reader.readUInt16();
    this.lightmapAlphaStart = reader.readInt32();
    this.lightmapSamplePositionStart = reader.readInt32();

    var i;

    this.edgeNeighbors = [];
    for ( i = 0; i < 4; i++ ) {
      this.edgeNeighbors.push( DispNeighbor.read( reader ) );
    }

    this.cornerNeighbors = [];
    for ( i = 0; i < 4; i++ ) {
      this.cornerNeighbors.push( DispCornerNeighbors.read( reader ) );
    }

    this.allowedVerts = [];
    for ( i = 0; i < ALLOWEDVERTS_SIZE; i++ ) {
      this.allowedVerts.push( reader.readUInt32() );
    }

    // Align dispinfo reads to struct size (176 bytes).
    reader.offset = start + Dispinfo.size;
    return this;
  }

  static read( reader ) {
    return new Dispinfo().read( reader );
  }
}

Dispinfo.size = 176;


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

  // Lighting.
  var lightingLump = header.lumps[ LUMP.LIGHTING ];
  var lighting = readLumpData( reader, lightingLump, ColorRGBExp32.read );
  console.log( lighting );

  // HDR Lighting.
  var lightingHDRLump = header.lumps[ LUMP.LIGHTING_HDR ];
  var lightingHDR = readLumpData( reader, lightingHDRLump, ColorRGBExp32.read );
  console.log( lightingHDR );

  // Dispinfos.
  var dispinfosLump = header.lumps[ LUMP.DISPINFO ];
  var dispinfos = readLumpData( reader, dispinfosLump, Dispinfo.read );
  console.log( dispinfos );
}
