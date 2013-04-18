
repMiddleware = function (req, res, next) {
	try {
		var rep = require('url').parse(req.url, true).query.repo;
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

dirMiddleware = function (req, res, next) {
	try {
		var dir = 'z' + require('crypto').randomBytes(4).readUInt32LE(0),
		    end = res.end;
		res.end = function(chunk, encoding) {
			res.end = end;
			require('rimraf')(req.dir, function() {
				res.end(chunk, encoding);
			})
		}
		require('fs').mkdir(dir, function(e) {
			req.dir = dir;
			next();
		})
	}
	catch (e) {
		res.end(e.toString());
	}
}

var app = require('connect')()
	.use(repMiddleware)
	.use(dirMiddleware)
	.use(function(req, res){
		require('child_process').exec("git clone " + req.rep + " repo", {cwd: req.dir}, function(err, stdout, stderr) {

			console.log(err, stdout, stderr);

			var deploy = JSON.parse(require('fs').readFileSync(req.dir + "/repo/deployment.json"));

			console.log(deploy);

			install(deploy.strategy, req.dir, function(err, strategy) {
				if (err) {
					res.writeHead(400);
					res.end(err.toString());
					return;
				}
				strategy(req.dir + "/repo", deploy, function(err, msg) {
					res.writeHead(200);
					res.end(msg);
				});
			});
		})
	}).listen(80);

var install = function(strategy, dir, cb) {
	try {
		var npm = require("npm");
		// https://npmjs.org/api/npm.html
		npm.load({}, function(err, npm) {
			// npm object loaded
			try {
				npm.commands.install([strategy], function(err, modules) {
					// ignore err, on err try locally
					try {
						// force a reload on require
						// http://nodejs.org/docs/latest/api/globals.html#globals_require_cache
						delete require.cache[modules[0][0].split("@")[0]];
						// require
						cb(null, require(modules[0][0].split("@")[0]));
					} catch (ex) {
						cb(ex);
					}
				})
			// on exception try locally
			} catch(ex) {
				try {
					// force a reload on require
					// http://nodejs.org/docs/latest/api/globals.html#globals_require_cache
					delete require.cache[modules[0][0].split("@")[0]];
					// require
					cb(null, require(modules[0][0].split("@")[0]));
				} catch (ex) {
					cb(ex);
				}
			}
		})
	} catch(ex) {
		cb(ex);
	}
}