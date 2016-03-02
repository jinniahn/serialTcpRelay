/**
 * Serail TCP Relay server.
 *
 * [Device] ---(serial)---[THIS]----(tcp)---[PC*]
 *
 */

var net=require('net');
var tcpServer = net.createServer();
var _ = require('underscore');
var readline = require('readline');
var Buffer = require('buffer').Buffer;
var s = require('underscore.string');

// options
var serial_port = "/dev/tty.usbmodem1421";
var serial_baudrate = 9600;
var serial_dataBits = 8;  // 8, 7, 6, or 5.
var serial_stopbits = 1;  // 1 or 2.
var serial_parity = 'none'; // 'none', 'even', 'mark', 'odd', 'space'

var tcp_port = 4001;

var argv = require('minimist')(process.argv.slice(1));

// update parameter
if(argv.p) { tcp_port = parseInt(argv.p); }
if(argv.b) { serial_baudrate = parseInt(argv.b); }
if(argv.s) { serial_stopbits = parseInt(argv.s); }
if(argv.d) { serial_port = argv.d; }
if(argv.help) { print_usage_and_exit(); }

// validate parameter
if( !serial_port || serial_port.trim() == '' ) {
    print_usage_and_exit();
}

function print_usage_and_exit() {
    console.log();    
    console.log("serialTcpServer [options]");
    console.log("options: ");
    console.log("   -d <serial_port_path>    : serial port path");
    console.log("   -p <tcp_port>            : tcp port");
    console.log();
    process.exit(0);
}

// sockets
var sockets = [];

//Serial Port
var serialport = require("serialport");
var SerialPort = serialport.SerialPort;
var serialPort = new SerialPort(serial_port, {
    baudrate: serial_baudrate,
    dataBits: serial_dataBits,
    stopBits: serial_stopbits,
    parity: serial_parity
    //parser: serialport.parsers.readline("\n")	
}, false);

var connection_timer = null;

var openSerial = function () {
    serialPort.open( function (error) {
	if ( error ) {
	    console.log('failed to open: '+error);
	    return;
	}

	console.log('opened device : ' + serial_port);


	// clear timer for tring to connect
	if(connection_timer) {
	    clearInterval(connection_timer);
	    connection_timer=null;
	}

	// print error
	serialPort.on('error', function(err) {
	    if(err){
		console.log(err);
	    }
	});

	// start to connect when it is closed
	serialPort.on('close', function() {
	    console.log('close');
	    connection_timer = setInterval(function() {
		openSerial();
	    }, 1000);
	});

	// data
	serialPort.on('line', function(line) {
	    _.each(sockets, function(socket){
		socket.write(line+"\n");
	    });    
	});

	// data
	serialPort.on('data', function(data) {
	    _.each(sockets, function(socket){
		socket.write(data);
	    }.bind(this));
	});
    });
};


// connect device
connection_timer = setInterval(function() {
    openSerial();
}, 1000);




//
// TCP server
//

tcpServer.on('listening',function(){
    console.log('TCP Serial Relay Server is listening on port', tcp_port);
});

tcpServer.on('connection',function(socket){
    console.log('client is connected from ' + socket.address()["address"]);    
    sockets.push(socket);
    socket.on('data',function(data){
	console.log('from sever: ' + data);
	serialPort.write(data);
    });

    socket.on('close', function() {
	console.log('client is close');
	sockets = _.without(sockets, socket);
    });

    socket.on('error', function(err) {
	sockets = _.without(sockets, socket);		
	console.log(err);
    });
});

tcpServer.on('close',function(){
    sockets = [];
    console.log('Server is now closed');
});

tcpServer.on('error',function(err){
    console.log('Error occured:',err.message);
});

tcpServer.listen(tcp_port);
