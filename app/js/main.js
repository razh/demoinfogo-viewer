import _ from 'lodash';
import dat from 'dat-gui';
import { parse, options, debug } from './demo';

function createGUI() {
  // Add options interface.
  var gui = new dat.GUI();

  function createFolder( options, name ) {
    var folder = gui.addFolder( name );
    _.forOwn( options, ( value, key ) => folder.add( options, key ) );
    folder.open();
  }

  createFolder( options, 'options' );
  createFolder( debug, 'debug' );

  function updateGUI() {
    _.forOwn( gui.__folders, folder =>
      _.forEach( folder.__controllers, controller => controller.updateDisplay() )
    );
  }

  function toggleAll() {
    _.forEach( [ options, debug ], object =>
      // Avoid explicit returns of false from exiting iterator.
      _.map( object, ( value, key ) => object[ key ] = !value )
    );

    updateGUI();
  }

  gui.add( { toggleAll }, 'toggleAll' );

  // Default to silence.
  toggleAll();
}

createGUI();


// Drag and drop.
document.addEventListener( 'drop', event => {
  event.stopPropagation();
  event.preventDefault();

  Promise.all(
    _.map( event.dataTransfer.files, file => {
      return new Promise( ( resolve, reject ) => {
        var reader = new FileReader();
        reader.onload = resolve;
        reader.onerror = reject;
        reader.readAsArrayBuffer( file );
      });
    })
  ).then( events => events.map( event => parse( event.target.result ) ) );
});

document.addEventListener( 'dragover', event => {
  event.preventDefault();
  event.stopPropagation();
});
