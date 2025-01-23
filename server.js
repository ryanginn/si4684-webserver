const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline'); 
const log = require("./functions/log");
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const portName = 'COM8';
const baudRate = 1000000; 
const serialPort = new SerialPort({
    path: portName,
    baudRate: baudRate
});

process.on('SIGTERM', shutDown);


let dls = "";
let signals = 0.0;
let ensemblename = "";
let services = [];

const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

app.use(express.static('public'));
app.set('view engine', 'pug')


server.listen(3000, () => {
  log.log("Server started at port 3000");
  log.log("Trying to connect port " + portName);
});

function shutDown() {
  process.exit(1);
}

process.on('SIGTERM', shutDown);


serialPort.on("open", function() {
  serialPort.write("SERVICE=1")
  serialPort.write("ENABLE=1", function(error) {
      if(error) {
          log.log("Port " + portName + " failed to connect, " + error);
      } else {
          log.log("Port " + portName + " successfully connected");
      }
  }); 
  

});
serialPort.on('data', (data) => {
    const msgStr = data.toString();
    console.log(msgStr)
    if(msgStr.startsWith("$")) {
        if(msgStr.includes("$D=RT")) {
            const matchingLines = msgStr.split('\n').filter(line => line.includes('$D=RT='));
            const afterSecondEqual = matchingLines.toString().split('=')[2]; 

            log.log("DLS Recieved: "+ afterSecondEqual);

            dls = afterSecondEqual;
        } else if(msgStr.includes("$M=SLIDESHOW=")) {
            log.log("Slideshow Recieved: "+ msgStr);
        } else if(msgStr.includes("$S=SIGNAL=")) {
            const matchingLines = msgStr.split('\n').filter(line => line.includes('$S=SIGNAL='));
            const afterSecondEqual = matchingLines.toString().split('=')[2].split(",")[0]; 
            signals = parseFloat(afterSecondEqual);
        } else if(msgStr.includes("$L=")) {
            const matchingLines = msgStr.split('\n').filter(line => line.includes('$L=')).toString();
            const modifiedString = matchingLines.replace("$L=", "").toString();
            const splitArray = modifiedString.split(',');
            const nonNumericItems = splitArray.filter(item => {
                return !/^\d+$/.test(item);
            });
            services = [];
            nonNumericItems.slice(3).forEach(item => {
              services.push(item);
            });
            ensemblename = nonNumericItems[2].split(";")[0];
            log.log("Ensemble Recieved: "+ ensemblename);
        }
    }
});

serialPort.on('error', (err) => {
  log.log('Serial port error: ' + err);
});

io.on('connection', (socket) => {
  console.log('New client connected');
  socket.on('changeChannel', (socket) => {
    log.log("Recieved change channel to ID: "+socket["channelId"])
    serialPort.write("SERVICE="+socket["channelId"])
  })
  setInterval(() => {
    socket.emit('signalData', {
      signals,
      dls,
      ensemblename,
      services
    });
  }, 300);
  
  setTimeout(() => {
    io.to(socket.id).emit('services', {
      services
    });
  }, 1500);
});


function shutDown() {
  serialPort.write("ENABLE=0");
  process.exit(1);
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});