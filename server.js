
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var net = require('net');
var _ = require('underscore');

//var logger = require('morgan');
var log = require('./modules/log')(module);
var logInput = require('./modules/logInput')(module);
var config = require('./modules/config');
var parser = require('./modules/parser');
//var db = require('./modules/db');

//  =========   Express endpoints
//app.use(logger('dev')); // ������� ��� ������� �� ��������� � �������
app.use(express.static('public'));

app.get('/', function(req, res){
  //res.send('<h1>Hello world</h1>');
  res.sendFile(__dirname + '/public/map.html'); // NOTE: but index.html always has priority, and rendered instead..
});

//  =========   Messaging
io.on('connection', function(socket){
    
  //console.log('a user connected');
  log.info('socket.io connected');
  
  socket.on('disconnect', function(){
    //console.log('user disconnected');
    log.info('socket.io disconnected');
  });

    /*
     //    @see http://socket.io/get-started/chat/
     Here are some ideas to improve the application:

     Broadcast a message to connected users when someone connects or disconnects
     Add support for nicknames
     Don�t send the same message to the user that sent it himself. Instead, append the message directly as soon as he presses enter.
     Add �{user} is typing� functionality
     Show who�s online
     Add private messaging
     */
    socket.on('map message', function (msg) {
        //console.log('map message: ' + msg );
        //console.log('map message: ' + msg.type + ' text: ' + msg.text + ' lat: ' + msg.lat + ' lng: ' + msg.lng );
        log.info('map message: ' + msg);

        io.emit('map message', msg);
    });
  
});

//  =========   HTTP
var portHttp = config.get('http:port');
http.listen(portHttp, function(){
  log.info('HTTP listening on *:' + portHttp);
});

//  =========   TCP - tested OK !
var portTcp = config.get('tcp:port'); // 8888
var tcp = net.createServer( function(socket) {
    
    var client = 'host ' + socket.remoteAddress + ':' + socket.remotePort;
    log.info('TCP  connected ' + client);
    
    //	no need, date should be kept as Buffer (binary).
	//socket.setEncoding('utf8'); // to convert Buffer -> String
    
    tcp.getConnections(function(err, count) {
        if (err) {
            //console.log('ERROR of counting active TCP connections');
            //log.error('Internal error(%d): %s',res.statusCode,err.message);
            log.error('ERROR of counting active TCP connections');
            return;
        }
        //server.maxConnections # Set this property to reject connections when the server's connection count gets high. 
        //console.log('TCP active connections: ' + count );// + ' of max: ' + tcp.maxConnections); // undefined
        log.info( 'TCP active connections: ' + count );
    });
	
    /*
    //  ???
    setTimeout(function () {
        socket.destroy();
    }, 20000);	
    */
   
	/*
    //socket.write('Welcome to the Telnet server!\n');
    socket.on('connect', function() {
        var hex = 0x01;
        var buff = new Buffer( 1);
        buff.writeUInt8(hex, 0);

        socket.write( buff, function() {
            console.log( buff, 'flushed');
        });		
    });
    */
   
    socket.on('data', function(data) 
	{
        log.info( 'tcp ' + client + '  passed data:\n' + data );
        logInput.info( '' + data );
		
        //log.debug( 'is data of String type ? ' + _.isString(data) );
        //log.debug( 'data instanceof Buffer ? ' + (data instanceof Buffer) );
	
        //socket.write('echoing: ' + data); // tested - ok !
		
        /*
        //  TODO:   why ?? remove these..
        if (data == 'exit\n') {
            log.info('exit command received: ' + socket.remoteAddress + ':' + socket.remotePort + '\n');
            socket.destroy();
        }
        */


        /*
        TODO:
           parser adapters support
           detect input type data
           add support for BiTrek devices *without* DB usage
        */

        //  process data
        var parsedData = parser.parse(socket, data); // (data instanceof Buffer) == true
  		log.debug( 'parsed data:\n' + parsedData);
		
        if (!parsedData) {	//	null || undefined
			log.error( "Data wasn't parsed. Procession stopped." );
			
			/*
			//	TODO:	is this required ?
			if (parsedData == null) {
				//socket.write( 0);
				//socket.end();
			}
			*/
	   
			return;
        }

        //	TODO:   add support for BiTrek devices *without* DB usage
		//	check if this is IMEI packet
        //if ((parsedMaps) && !(parsedMaps instanceof Array)) {
        if (_.isString(parsedData)) {
			
			//	#1	check IMEI in DB.
			//	#2	mark socket with IMEI id.
			//	#3	if imei not found, then socket.imei == undefined, so refuse socket connection, like:
//			if (!socket.imei) {
//				socket.write(0);
//				socket.end();
//			}
			
			//db.checkIMEI(socket, parsedData); //socket.imei = parsedData; // made inside checkIMEI() if found.
			return;	//	no need further 'data' procession 
			
            /*
             if (checkIMEI( parsedMaps) == 1) {
             //socket.write( "1");//String.fromCharCode(01));//'\u0001'.charCodeAt(0));
             //socket.write( "1", "utf8");
             socket.sendMessage( '1');
             console.log( 'Ok');
             //socket.end( '1');
             //socket.destroy();
             } else {
             //socket.write( 0);
             //socket.end();
             }
             */
        }
		
        var parsedMaps;
        if (_.isArray(parsedData)) {
			parsedMaps = parsedData;
		}
		
		if (!parsedMaps) {
			log.error('Wrong parsed data format. Procession stopped.');
			return;
		}
			
		for (var index in parsedMaps) // this approach is safe, in case parsedMaps == null.
		{
			var mapData = parsedMaps[ index ];
			var deviceId = mapData['IMEI']; 

			if (deviceId) {
				//  utcDate,utcTime
				var utcDateTime = mapData['utcDateTime'];
				//var utcDate = mapData['utcDate'];
				//var utcTime = mapData['utcTime'];
				//var utcDate = new Date(mapData['utcDate']);
				//var utcTime = new Date(mapData['utcTime']);
				//var utcDateTime = new Date(parseInt(mapData['utcDate']) + parseInt(mapData['utcTime']));
				//log.debug('date: ' + utcDate + ' time: ' + utcTime);
				//log.debug('date & time as Date: ' + utcDateTime); // OUTPUT: date & time as Date: 1377818379000
				//log.debug('date&time as String: ' + utcDateTime.toString()); // the same !

				var lat = mapData['latitude'];
				var lng = mapData['longitude'];

				var objUI = {
					type: 'marker', 
					deviceId: deviceId,
					utcDateTime: new Date( utcDateTime).toUTCString(),
					altitude: mapData['altitude'], // Unit: meter
					speed: mapData['speed'], // unit: km/hr
					//speedKnots: mapData['speedKnots'], // unit: Knots
					heading: mapData['heading'], // unit: degree
					//reportType: mapData['reportType'], - see: tr-600_development_document_v0_7.pdf -> //4=Motion mode static report //5 = Motion mode moving report //I=SOS alarm report //j= ACC report
					lat: lat, 
					lng: lng
				};            
				io.emit( 'map message', objUI ); // broadcasting using 'emit' to every socket.io client
				log.debug('gps position broadcasted -> map UI');

				var objData = {
					number: deviceId,
					message: data,
					//type: 'marker', 
					//utcDate: utcDate,
					//utcTime: utcTime,
					utcTime: new Date( utcDateTime),
					_timestamp: new Date( utcDateTime),
					altitude: mapData['altitude'], // Unit: meter
					speed: mapData['speed'], // unit: km/hr
					heading: mapData['heading'], // unit: degree
					//reportType: mapData['reportType'], - see: tr-600_development_document_v0_7.pdf -> //4=Motion mode static report //5 = Motion mode moving report //I=SOS alarm report //j= ACC report
					longitude: lng,
					latitude: lat
				};

				/*
                try {
					//	TODO:	use socket.imei for keeping binary protocol procession.
					if (deviceId != '354660042226111' && deviceId != '354660042226112' && deviceId != '354660042226113' && deviceId != '354660042226114' && deviceId != '354660042226115' && 
					    deviceId != '354660042226116' && deviceId != '354660042226117' && deviceId != '354660042226118' && deviceId != '354660042226119' && deviceId != '354660042226120') {
						db.save_into_db(objData);   
					}
						
					log.debug('data passed -> DB');
				} catch (e) {
					log.error(e);
				}
				*/
			}
		}

        //socket.write( 1);
        //socket.end();

    });

    socket.on('close', function() {
        //console.log('TCP disconnected ' + client);
        log.info( 'TCP disconnected ' + client );
    });
    
    socket.on('error', function( err ) {
        //console.log('TCP ERROR: ' + err);
        log.error('TCP: ', err);
    });

    //socket.end( "1");
    //socket.end();
	
}).listen( portTcp, function() { 
    //console.log('TCP  listening on *:8888');
    log.info( 'TCP  listening on *:' + portTcp );
});
