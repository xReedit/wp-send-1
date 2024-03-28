var config = require('./config');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia  } = require('whatsapp-web.js');
const io = require('socket.io-client');
var _client = null; // venom-bot
let socket;

var reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

/// socket
socket = io.connect(config.URL_SCOKET_PROD, {query: config.query});

async function connect() {
  socket = await io.connect(config.URL_SCOKET_PROD, {query: config.query});
}


socket.on('connect_error', (e) => { console.log(e);  connect(); });

socket.on('disconnect', function() {
  console.log("Socket disconnected.");
});

// client session wsp
const client = new Client({
    // session: session,
    // puppeteer: {headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']}, //ubuntu
    // authStrategy: new LocalAuth()
    puppeteer: { args: ["--no-sandbox", "--disable-dev-shm-usage"] },
    authStrategy: new LocalAuth()
});

client.on('disconnected', (reason) => {
  console.log('Client was logged out', reason);
  reconnected();
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
    try {
      const numPhones = data.telefono.split(',');
      numPhones.map(n => {
        data.telefono = n;
        SendMsj(data);
      });
    } catch(err) { console.error('TELEFONO ERRROR == ',data)}
  }  else {
    SendMsj(data);
  } 
});

/// socket


client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
    reconnectAttempts = 0;
});

client.on('auth_failure', (error) => {
	console.log('Client ERROR! == ', error);
  reconnected();
})

client.on('ready', () => {
    console.log('Client is ready!');
    reconnectAttempts = 0; 
    start(client);   
});

client.initialize();
// client session wsp

function reconnected() {
  reconnectAttempts++;
  if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
    client.initialize(); // try to reconnect
  } else {
    socket.emit('error-ws-api-comprobantes', {message: 'Requiere Atencion. No se pudo conectar al servidor de WhatsApp, por favor reinicie el servicio de WhatsApp en el servidor'});
    reconnectAttempts = 0;
  }
}

function start(client) {
    _client = client;
 }

 // send msj
 async function SendMsj(dataMsj) {    
    if ( !_client ) { console.log('not _client', _client); return; }
    if ( !dataMsj.telefono ) {return; }
    if ( dataMsj.telefono.length < 9 ) {return; }

    let numTelefonoSend = dataMsj.telefono.replace(/ /g, '');
    numTelefonoSend = numTelefonoSend.replace(/\+/g, '');    
    numTelefonoSend = numTelefonoSend.trim()
    dataMsj.telefono = numTelefonoSend;
    
    // const numberPhone = dataMsj.telefono.length === 9 ? `51${dataMsj.telefono}@c.us` : `${dataMsj.telefono}@c.us`;

    let numberPhone = validarNumeroTelefono(dataMsj.telefono);
    if (!numberPhone) { return; }
    console.log('telefono valido == ', numberPhone);
    numberPhone = `${numberPhone}@c.us`;



    // if (dataMsj.tipo === 2) { return; }

    if (dataMsj.tipo === 0) { // quitamos el # hastag de la url // mientras actualize servidor
        dataMsj.msj = dataMsj.msj.replace('#/', '');
    }

    if (dataMsj.tipo === 5) { // time line
        console.log('=== time line ===== ', dataMsj); 
        return;
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
          reconnected();
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
          console.log('Result: ', '===== Envio Correcto XML ====='); //return object success
        })
        .catch((erro) => {
          reconnected()
          console.error('Error when sending: ', erro); //return object error
        });
      } catch(err) { console.error('XML ERRROR == ',err)}

      // return;


      setTimeout(function() {
        sendMensajeNoYapeRobot(numberPhone)
      }, 2000);
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
    } catch(err) { 
      reconnected();
      console.error('MSJ ERRTOR == ',result)}
  }

  async function sendMensajeNoYapeRobot(numberPhone) {
    // try { 
    // const _msj = `¡ATENCION!, este es un mensaje automático enviado a través de nuestro servicio de bot 🤖. Por favor, NO REALIZE NINGUNA TRANSACCION a este número y tampoco responda a este mensaje ya que no llegará a un representante de servicio al cliente. Si necesitas ayuda o tienes alguna pregunta, contáctanos a través de papaya.com.pe. ¡Gracias!`
    // await _client
    //   .sendMessage(numberPhone, _msj)
    //   .then((result) => {
    //     console.log('Result: ', '===== Envio Correcto MSJ ====='); //return object success
    //   })
    //   .catch((erro) => {
    //     console.error('Error when sending: ', erro); //return object error
    //   });     
    // } catch(err) { console.error('MSJ ERRTOR == ',result)}
  }

  // elabora una funcion para determinar si el numero es valido + si viene con codigo de pais quitarlo solo si es +51
  function validarNumeroTelefono(num) {
    let numTelefono = num.replace(/ /g, '');
    numTelefono = numTelefono.replace(/\+/g, '');
    numTelefono = numTelefono.trim()

    // verificar si el numero de telefono es valido que no sea mayor a 12 digitos y que no tenga caracteres extraños como letras
    if (numTelefono.length > 12 || !/^\d+$/.test(numTelefono)) {
      return false;
    }            

    // si tiene nueve digitos agregarle el codigo de pais +51
    if (numTelefono.length === 9) {
      numTelefono = `51${numTelefono}`;
    }


    return numTelefono;
  }