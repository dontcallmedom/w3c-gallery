var express = require('express');
var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();
var app = express();
var fs = require('fs');

var eventQueue = [];


app.configure(function(){
    // Reading command line options
    var argv = require("optimist")
	.options('c', {
	    alias: 'config',
	default:'config.ini'}).argv;
    
    // Reading configuration file
    var config = require('iniparser').parseSync(argv.c);

    // checking whether storage directory exists and is writeable
    var storageDir = config.storage.directory;
    try {
	fs.writeFileSync(storageDir + ".test");
    } catch (e) {
	throw new Error(storageDir + " not writable");
    }

    // Connecting to Mongo database
    var mongoose = require('mongoose');
    mongoose.connect(config.mongo.host, config.mongo.dbname);
    var db = mongoose.connection;
    db.on('error', function (err) { throw new Error('MongoDb connection failed: ' + err) });

    // and loading schemas for it
    var Picture = require('./model.js')(storageDir).Picture();

    emitter.setMaxListeners(0);
    app.use(express.logger());
    app.set('port', process.env.PORT || 3000);
    app.use(express.bodyParser());
    app.use(express.static(__dirname + '/public', { maxAge: 86400}));
    app.use(errorHandler);
});

// Run on port 80 when in production mode
app.configure('production', function(){
    app.use(express.errorHandler()); 
    app.set('port', process.env.PORT || 80);
});

app.get('/', function(req, res) {
    fs.readFile(__dirname + '/public/index.html', 'utf8', function(err, content){
        res.send(content);
    });
});

app.post('/gallery', function(req, res, next) {
    var picture = new mongoose.model('Picture')();
    // uuid generation from http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
    picture.slug = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {var r = Math.random()*16|0,v=c=='x'?r:r&0x3|0x8;return v.toString(16);});
    picture.attach('image', req.files.image, function(err) { 
	if (err) return next(err);
	picture.save(function(err) {
	    if (err) return next(err);
	    if (req.xhr) {
		res.status(201);
		res.setHeader("Location",picture.path);
		res.send({picture:{url:picture.path}});
	    } else {
		res.send('Post has been saved with file!');
	    }
	});
    })    
});

app.all('/gallery.:format?', function(req, res) {
    switch (req.params.format) {
	// When json, generate suitable data
    case 'json':
	Picture.find({}).sort('-added').exec(
	    function(err, pictures) {
		res.send(pictures);
	    });
	break;
    default:
	fs.readFile(__dirname + '/public/gallery.html', 'utf8', function(err, content){
            res.send(content);
	});
    }
});

app.get('/stream', function(req, res) {
    res.setHeader("Content-Type", 'text/event-stream');
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.writeHead(200);
    // avoid timeout
    setInterval(function() { res.write(":\n"); }, 30000);
    emitter.on("addpicture", function(url, id) {
	res.write("data: " + JSON.stringify({'url': url})+ "\n");
	res.write("id: " + id + "\n\n");
    });
});

function errorHandler (err, req, res, next) {
    res.status(500);
    if (req.xhr) {
	res.send({error: err});
    } else {
	res.send(err);
    }
}

app.listen(app.set('port'));
console.log("Express server listening on port %d in %s mode", app.set('port'), app.settings.env);