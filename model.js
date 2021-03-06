var mongoose = require('mongoose');

var PictureSchema = new mongoose.Schema({
    added: {type: Date , default: Date.now()},
    title: String
});

require('mongoose-attachments-localfs');
var attachments = require('mongoose-attachments');

module.exports = function(storageDirectory) {
    PictureSchema.plugin(attachments, {
	directory: storageDirectory,
	storage: {
	    providerName: 'localfs'
	},
	properties: {
	    image: {
		styles: {
		    original: {'$format': 'jpg'},
		    thumb: {
			thumbnail: '300x300^',
			gravity: 'center',
			extent: '100x100',
			'$format': 'jpg'}
		}
	    }
	}
    });
     mongoose.model('Picture', PictureSchema);
    return {
	Picture: mongoose.model('Picture')
    };
};
