import _ from 'lodash';
import protobuf from 'protocol-buffers';

var fs = require( 'fs' );

// Protocol buffer definitions.
export const messages = protobuf(
  fs.readFileSync( __dirname + '/../proto/netmessages_public.proto', 'utf8' ) +
  fs.readFileSync( __dirname + '/../proto/cstrike15_usermessages_public.proto', 'utf8' )
);

export const { NET_Messages, SVC_Messages, ECstrike15UserMessages } = messages;


/**
 * Invert message objects into arrays for fast lookup.
 */
function getMessageTypes( messages, prefix ) {
  return _.reduce( messages, ( array, value, key ) => {
    array[ value ] = key.replace( prefix, '' );
    return array;
  }, [] );
}

export const UserMessageTypes = getMessageTypes( ECstrike15UserMessages, 'CS_UM_' );
export const NETMessageTypes  = getMessageTypes( NET_Messages, 'net_' );
export const SVCMessageTypes  = getMessageTypes( SVC_Messages, 'svc_' );


export const DemoMessage = {
  // Startup message. Process as fast as possible.
  DEM_SIGNON: 1,
  // Normal network packet that is stored off.
  DEM_PACKET: 2,
  // Sync client clock to demo tick.
  DEM_SYNCTICK: 3,
  // Console command.
  DEM_CONSOLECMD: 4,
  // User input command.
  DEM_USERCMD: 5,
  // Network data tables.
  DEM_DATATABLES: 6,
  // End of time.
  DEM_STOP: 7,
  // A blob of binary data understood by a callback function.
  DEM_CUSTOMDATA: 8,
  DEM_STRINGTABLES: 9,
  // Last command. Same as DEM_STRINGTABLES.
  DEM_LASTCMD: 9
};
