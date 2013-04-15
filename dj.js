var sys = require('sys'),
	url = require('url'),
	exec = require('child_process').exec,
	http = require('http'),
	connect = require('connect'),
	rimraf = require('rimraf')

var crypto = require('crypto');
var fs = require('fs');

repMiddleware = function worseThanUselessMiddleware(req, res, next) {
	try {
		var rep = url.parse(req.url, true).query.repo;
		if(rep) {
			req.rep = rep;
			next();
		}
		else {
			res.end("No repo");
		}
	} catch (e) {
		res.end(e.toString());
	}
}

dirMiddleware = function worseThanUselessMiddleware(req, res, next) {
	try {
		var dir = 'z' + crypto.randomBytes(4).readUInt32LE(0),
		    end = res.end;
		// res.end = function(chunk, encoding) {
		// 	res.end = end;
		// 	rimraf(req.dir, function() {
		// 		res.end(chunk, encoding);
		// 	})
		// }
		fs.mkdir(dir, function(e) {
			req.dir = dir;
			next();
		})
	}
	catch (e) {
		res.end(e.toString());
	}
}

var app = connect()
	.use(repMiddleware)
	.use(dirMiddleware)
	.use(function(req, res){
		exec("git clone " + req.rep + " repo", {cwd: req.dir}, function(err, stdout, stderr) {

			console.log(err, stdout, stderr)

			var deploy = JSON.parse(fs.readFileSync(req.dir + "/repo/deployment.json"));

			console.log(deploy)

			install(deploy.strategy, req.dir, function(err, strategy) {
				if (err) {
					res.writeHead(400);
					res.end(err.toString());
					return;
				}
				console.log("call strategy", strategy);
				strategy(req.dir + "/repo", deploy, function(err, msg) {
					res.writeHead(200, {
						'Content-Type': 'text/plain'
					});
					res.end(msg);
				});
			});
		})
	}).listen(8080);

var install = function(strategy, dir, cb) {
	var npm = require("npm")
	// https://npmjs.org/api/npm.html
	npm.load({}, function(err, npm) {
		// npm object loaded
		npm.commands.install([strategy], function(err, modules) {
			if(err) {
				cb(err)
			}
			try {
				console.log(modules[0][0].split("@")[0])
				cb(null, require(modules[0][0].split("@")[0]));
			} catch (ex) {
				cb(ex);
			}
		})
	})
}