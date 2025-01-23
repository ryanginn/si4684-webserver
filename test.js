const { SerialPort } = require('serialport');
const log = require("./functions/log");

const portName = "COM8";
const serialPort = new SerialPort({
    path: portName,
    baudRate: 1000000
});

log.log("Trying to connect to COM Port "+portName)

function shutDown() {
    serialPort.write("ENABLE=0");
    process.exit(1);
}

process.on('SIGTERM', shutDown);

let dls = "";
let signal = 0.0;
let image = "";
let ensemblename = "";

serialPort.on("open", function() {
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

    if(msgStr.startsWith("$")) {
        if(msgStr.includes("$D=RT")) {
            const matchingLines = msgStr.split('\n').filter(line => line.includes('$D=RT='));
            const afterSecondEqual = matchingLines.toString().split('=')[2]; 

            log.log("DLS Recieved: "+ afterSecondEqual);

            dls = afterSecondEqual;
        } else if(msgStr.includes("$S=SIGNAL=")) {
            const matchingLines = msgStr.split('\n').filter(line => line.includes('$S=SIGNAL='));
            const afterSecondEqual = matchingLines.toString().split('=')[2].split(",")[0]; 
            signal = parseFloat(afterSecondEqual);
        } else if(msgStr.includes("$L=")) {
            const matchingLines = msgStr.split('\n').filter(line => line.includes('$L=')).toString();
            const modifiedString = matchingLines.replace("$L=", "").toString();
            const splitArray = modifiedString.split(',');
            const nonNumericItems = splitArray.filter(item => {
                return !/^\d+$/.test(item);
            });

            ensemblename = nonNumericItems[2].split(";")[0];

            log.log("List recieved: "+splitArray)
        }
    }

});