function bytes2number(bytes, offset) {
  return bytes[offset] | (bytes[offset+1] << 8) | (bytes[offset+2] << 16) | (bytes[offset+3] << 24);
}

function Decoder(bytes, port) {
  // Decode an uplink message from a buffer
  // (array) of bytes to an object of fields.
  var decoded = {
    events: []
  };
  
  for (var i = 0; i < bytes.length; i+= 9) {
    switch(bytes[i]) {
      case 1:
        var pressedAt = bytes2number(bytes, i+1);
        var duration = bytes2number(bytes, i+5);
        decoded.events.push({ type: 'button', pressed_at: pressedAt, duration: duration });
      
        break;
      case 6:
        var pressedAt = bytes2number(bytes, i+1);
        var value = bytes[i+5];
        decoded.events.push({ type: 'switch', pressed_at: pressedAt, value: value });
        break;
      case 9:
        var pressedAt = bytes2number(bytes, i+1);
        var value = bytes[i+5] | (bytes[i+6] << 8);
        decoded.events.push({ type: 'meter', pressed_at: pressedAt, value: value });
        break;

      default:
    }
  }
  return decoded;
}

var SerialPort = require("serialport");

const args = process.argv.slice(2);
const tty = args[0] || "/dev/tty.usbmodem1421";
console.log(`Using TTY: ${tty}`);

var port = new SerialPort(tty, {
  baudRate: 9600,
  parser: SerialPort.parsers.byteLength(9)
});

port.on('data', function (data) {
  let parsed = Decoder(data, 1);
  parsed.device_id = 'the-one'

  postEvents(parsed);

});

const querystring = require('querystring'), http = require('http');

function postEvents(data) {
  const postData = JSON.stringify(data);
  console.log(postData);

  const options = {
    hostname: 'fidgit.fun',
    port: 80,
    path: '/api/events',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
      }
  };

  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    if (res.statusCode > 399) {
      console.log('retrying');
      setTimeout(function() { postEvents(data) }, 1000);
      return
    }
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      console.log(`BODY: ${chunk}`);
    });
  });

  req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
    setTimeout(function() { postEvents(data) }, 1000);
  });

  // write data to request body
  req.write(postData);
  req.end();
}
