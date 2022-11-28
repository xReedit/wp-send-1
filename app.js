var config = require('./config');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia  } = require('whatsapp-web.js');
const io = require('socket.io-client');
var _client = null; // venom-bot

/// socket
const socket = io.connect(config.URL_SCOKET_PROD, {query: config.query});
socket.on('connect_error', (e) => { console.log(e);  });

socket.on('disconnect', function() {
  console.log("Socket disconnected.");
});

socket.on("connect", () => {
  console.log('Socket conectadoooo!! == ', socket.connected); // true
});

socket.on("mensaje-test-w", (val) => {
  console.log('mensaje-test-w!! == ', val); // true
  SendMsj(val);
});


socket.on('enviado-send-msj', (data) => {
  console.log('conectado idsede', data);

  // para enviar a varios telefonos si es el caso
  if (data.tipo === 0) {
    const numPhones = data.telefono.split(',');
    numPhones.map(n => {
      data.telefono = n;
      SendMsj(data);
    });
  }  else {
    SendMsj(data);
  } 
});

/// socket


// client session wsp
const client = new Client({
    args: ['--no-sandbox'],
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('auth_failure', (error) => {
	console.log('Client ERROR! == ', error);
})

client.on('ready', () => {
    console.log('Client is ready!');
    start(client);    
});

client.initialize();
// client session wsp


function start(client) {
    _client = client;


 }

 // send msj
 async function SendMsj(dataMsj) {    
    if ( !_client ) { console.log('not _client', _client); return; }
    if ( !dataMsj.telefono ) {return; }
    if ( dataMsj.telefono.length < 9 ) {return; }

    dataMsj.telefono = dataMsj.telefono.replace(/ /g, '');
    dataMsj.telefono = dataMsj.telefono.replace(/\+/g, '');
    const numberPhone = dataMsj.telefono.length === 9 ? `51${dataMsj.telefono}@c.us` : `${dataMsj.telefono}@c.us`;

    if (dataMsj.tipo === 0) { // quitamos el # hastag de la url // mientras actualize servidor
        dataMsj.msj = dataMsj.msj.replace('#/', '');
    }
    
    if (dataMsj.tipo === 3) { // envia comprobante pdf comprobante
      
      // pdf
      try {
        var media = await MessageMedia.fromUrl(dataMsj.url_comprobante, {unsafeMime: true});
        media.mimetype = "application/pdf";
  	    media.filename = dataMsj.nombre_file+'.pdf';
        await _client
        .sendMessage(
          numberPhone,
          media
        )
        .then((result) => {
          console.log('Result: ', '===== Envio Correcto del PDF ====='); //return object success

        })
        .catch((erro) => {
          console.error('Error when sending: ', erro); //return object error
        });
      } catch(err) { console.error('PDF ERRROR == ',err)}

      // xml
      try{
        media = await MessageMedia.fromUrl(dataMsj.url_comprobante_xml, {unsafeMime: true});
        media.mimetype = "application/xml";
  	    media.filename = dataMsj.nombre_file+'.xml';
        await _client
        .sendMessage(
          numberPhone,
          media
        )
        .then((result) => {
          console.log('Result: ', '===== Envio Correcto PDF ====='); //return object success
        })
        .catch((erro) => {
          console.error('Error when sending: ', erro); //return object error
        });
      } catch(err) { console.error('XML ERRROR == ',err)}

      // return;
    }

    try {
    await _client
      .sendMessage(numberPhone, dataMsj.msj)
      .then((result) => {
        console.log('Result: ', '===== Envio Correcto MSJ ====='); //return object success

        // ok verificacion de telfono
        if ( dataMsj.tipo === 1 ) {
          dataMsj.msj = true;
          socket.emit('mensaje-verificacion-telefono-rpt', dataMsj);
        }
      })
      .catch((erro) => {
        console.error('Error when sending: ', erro); //return object error

        // error verificacion de telfono
        if ( dataMsj.tipo === 1 ) {
          dataMsj.msj = false;
          socket.emit('mensaje-verificacion-telefono-rpt', dataMsj);
        }

      });     
    } catch(err) { console.error('MSJ ERRTOR == ',result)}
  }