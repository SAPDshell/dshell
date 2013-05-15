repMiddleware = function (req, res, next) {
	try {
		var rep = require('url').parse(req.url, true).query.repo;
		if(rep) {
			req.rep = rep;
			next();
		}
		else {
			res.write("Deployment Shell v1.0.0\n");
			res.write("Copyright 2013 SAP Labs, LLC\n");
			res.write("\n");
			res.write("- Dominik Tornow <dominik.tornow@sap.com>\n");
			res.write("- Joerg Latza <joerg.latza@sap.com>\n");
			res.end();
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
			require('child_process').exec("rmdir " + dir + "/S /Q", function(err, stdout, stderr) {
				res.end(chunk, encoding);
			});
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
    // .use(require('connect').static('strategies'))
    .use(require('connect').basicAuth(function(username, password) {
    	// that's right, sue me >:) !!!
    	global.username = username.toLowerCase(); 
    	global.password = password; 
    	return true
    }))
	.use(repMiddleware)
	.use(dirMiddleware)
	.use(function(req, res){
		require('child_process').exec("git clone " + req.rep + " repo", {cwd: req.dir}, function(err, stdout, stderr) {

			res.write("Deployment Shell v1.0.0\n");
			res.write("Copyright 2013 SAP Labs, LLC\n");
			res.write("\n");
			res.write("- Dominik Tornow <dominik.tornow@sap.com>\n");
			res.write("- Joerg Latza <joerg.latza@sap.com>\n");
			res.write("\n");

			if(err || stderr) {
				res.write("ERROR\n");
				res.write("=====\n");
				res.write("Cannot git clone " + req.rep + "\n");
				res.write(err.toString());
				res.write(stderr.toString());
				res.end();
				return;
			}

			var deploy = {};

			try {
				deploy = JSON.parse(require('fs').readFileSync(req.dir + "/repo/deployment.json"));
			} catch(ex) {
				res.write("ERROR\n");
				res.write("=====\n");
				res.write("Cannot access or decode deploment descriptor\n");
				res.write(ex.toString());
				res.end();
				return;
			}

			res.write("DEPLOYMENT DESCRIPTOR\n");
			res.write("=====================\n");
			res.write("\n");
			res.write(JSON.stringify(deploy));
			res.write("\n");

			try {
				require(deploy.strategy)(req.dir + "/repo", deploy, function(err, msg) {
					if(err) {
						res.write("ERROR\n");
						res.write("=====\n");
						res.write("Deployment failed\n");
						res.write(err.toString());
						res.end();
						return;
					}
					res.write("SUCCESS\n");
					res.write("=======\n");
					res.write("\n");
					res.end(msg);
				});
			} catch(ex) {
				res.write("ERROR\n");
				res.write("=====\n");
				res.write("\n");
				res.write("Cannot require or execute " + deploy.strategy + "\n");
				res.write("\n");
				res.write(ex.toString());
				res.end();
				return;
			}
		})
	}).listen(1237);
