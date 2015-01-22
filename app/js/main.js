import _ from 'lodash';
import { parse } from './demo';

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
  ).then( events => events.map( event => parse( event.srcElement.result ) ) );
});

document.addEventListener( 'dragover', event => {
  event.stopPropagation();
  event.preventDefault();
});
