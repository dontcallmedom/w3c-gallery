var express = require('express');
var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();
var app = express();
module.exports.app = app;
var fs = require('fs');

var eventQueue = [];
var Picture;

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
    module.exports.db = mongoose;
    var db = mongoose.connection;
    db.on('error', function (err) { throw new Error('MongoDb connection failed: ' + err) });

    // and loading schemas for it
    Picture = require('./model.js')(storageDir).Picture;

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
    var picture = Picture();

    picture.attach('image', req.files.image, function(err) { 
	if (err) return next(err);
	picture.save(function(err) {
	    if (err) return next(err);
	    eventQueue.push({url: picture.path});
	    emitter.emit("addpicture", picture.path, eventQueue.length);
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

app.get('/photos/:id', function(req, res) {
    Picture.findOne({_id: req.params.id}, function(err, pic) {
	if (pic) {
	    fs.readFile(pic.path, function(err, content){
		if (err) {
		    res.status(410);
		    res.send("Could not find saved picture " + pic._id + " on storage");
		} else {
		    if (pic.format) {
			res.setHeader("Content-Type", "image/" + pic.format.toLowerCase());
		    } else {
			res.setHeader("Content-Type", "image/jpeg");
		    }
		    res.send(content);
		}
	    });
	} else {
	    res.status(404);
	    res.send("Unknown picture " + req.params.id);
	}
    });
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

if (require.main === module) {
    app.listen(app.set('port'));a
    console.log("Express server listening on port %d in %s mode", app.set('port'), app.settings.env);
}

