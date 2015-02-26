export const MAX_OSPATH = 260;
// Largest message that can be sent in bytes.
export const NET_MAX_PAYLOAD = 262144 - 4;

// How many bits to use to encode an edict?
// # of bits needed to represent max edicts.
export const MAX_EDICT_BITS = 11;
// Max # of edicts in a level.
export const MAX_EDICTS = ( 1 << MAX_EDICT_BITS );

export const MAX_USERDATA_BITS = 14;
export const MAX_USERDATA_SIZE = ( 1 << MAX_USERDATA_BITS );
export const SUBSTRING_BITS = 5;

export const NUM_NETWORKED_EHANDLE_SERIAL_NUMBER_BITS = 10;

export const MAX_PLAYER_NAME_LENGTH = 128;
// Max 4 files.
export const MAX_CUSTOM_FILES = 4;
// Hashed CD Key (32 hex alphabetic chars + 0 terminator).
export const SIGNED_GUID_LEN = 32;

export const ENTITY_SENTINEL = 9999;


export const UpdateType = {
  // Entity came back into PVS, create new entity if one doesn't exist.
  EnterPVS: 0,
  // Entity left PVS.
  LeavePVS: 1,
  // There is a delta for this entity.
  DeltaEnt: 2,
  // Entity stays alive but no delta ( could be LOD, or just unchanged ).
  PreserveEnt: 3,
  // Finished parsing entities successfully.
  Finished: 4,
  // Parsing error occured while reading entities.
  Failed: 5,
};

// Flags for delta encoding header.
export const HeaderFlags = {
  FHDR_ZERO: 0,
  FHDR_LEAVEPVS: 1,
  FHDR_DELETE: 2,
  FHDR_ENTERPVS: 4
};

export const GameEventValue = {
  TYPE_STRING: 1,
  TYPE_FLOAT: 2,
  TYPE_LONG: 3,
  TYPE_SHORT: 4,
  TYPE_BYTE: 5,
  TYPE_BOOL: 6,
  TYPE_UINT64: 7,
  TYPE_WSTRING: 8
};
