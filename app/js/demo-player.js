/**
 * A lightweight parser that only extracts data of particular interest to an
 * average player.
 */
import _ from 'lodash';
import protobuf from 'protocol-buffers';
import BN from 'bn.js';
import BufferReader from './buffer-reader';
import BitBufferReader from './bit-buffer-reader';
import { DemoCommandInfo, EntityEntry } from './classes';

import {
  MAX_OSPATH,
  UpdateType,
  HeaderFlags
} from './constants';

import {
  SendPropType,
  SPROP,
  decodeProp
} from './prop';

import { messages, DemoMessage } from './messages';

export function parse( file ) {
  console.time( 'parse' );

  const buffer = new Buffer( new Uint8Array( file ) );
  const reader = new BufferReader( buffer );
  const { length } = buffer;

  const demoHeader = {
    demoFileStamp:   reader.readString( 8 ),
    demoProtocol:    reader.readInt32(),
    networkProtocol: reader.readInt32(),
    serverName:      reader.readString( MAX_OSPATH ),
    clientName:      reader.readString( MAX_OSPATH ),
    mapName:         reader.readString( MAX_OSPATH ),
    gameDirectory:   reader.readString( MAX_OSPATH ),
    playbackTime:    reader.readFloat(),
    playbackTicks:   reader.readInt32(),
    playbackFrames:  reader.readInt32(),
    signonLength:    reader.readInt32()
  };

  console.log( demoHeader );

  // Advance by read size.
  function readRawData() {
    reader.offset += reader.readInt32();
  }

  function dumpDemoPacket( start, length ) {
    while ( reader.offset - start < length ) {
      const command = reader.readVarInt32();
      const size = reader.readVarInt32();
      if ( reader.offset - start + size > length ) {
        return;
      }

      if ( !size ) {
        return;
      }

      reader.offset += size;
    }
  }

  function handleDemoPacket() {
    const democmdinfo = DemoCommandInfo.read( reader );

    const seqNrIn  = reader.readInt32();
    const seqNrOut = reader.readInt32();

    const length = reader.readInt32();
    dumpDemoPacket( reader.offset, length );
  }

  while ( reader.offset < length ) {
    const command    = reader.readUInt8();
    const timestamp  = reader.readInt32();
    const playerSlot = reader.readUInt8();

    switch ( command ) {
      case DemoMessage.DEM_STOP:
        console.timeEnd( 'parse' );
        return;

      case DemoMessage.DEM_CONSOLECMD:
        readRawData();
        break;

      case DemoMessage.DEM_DATATABLES:
        readRawData();
        break;

      case DemoMessage.DEM_STRINGTABLES:
        readRawData();
        break;

      case DemoMessage.DEM_USERCMD:
        readRawData();
        break;

      case DemoMessage.DEM_SIGNON:
      case DemoMessage.DEM_PACKET:
        handleDemoPacket();
        break;
    }
  }
}
